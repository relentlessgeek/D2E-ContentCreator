import OpenAI from 'openai';
import db from '../db';
import { Prompt } from '../types';

// Lazy-initialized OpenAI client (initialized on first use after env vars are loaded)
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new OpenAIConfigError('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Custom error types for better error categorization
export class OpenAIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIConfigError';
  }
}

export class OpenAIRateLimitError extends Error {
  public retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.name = 'OpenAIRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class OpenAIAPIError extends Error {
  public statusCode: number;
  public isRetryable: boolean;

  constructor(message: string, statusCode: number, isRetryable: boolean = false) {
    super(message);
    this.name = 'OpenAIAPIError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export class OpenAITimeoutError extends Error {
  constructor(message: string = 'OpenAI request timed out') {
    super(message);
    this.name = 'OpenAITimeoutError';
  }
}

// Error categorization helper
export function categorizeError(error: unknown): {
  message: string;
  isRetryable: boolean;
  errorCode: string;
  retryAfter?: number;
} {
  if (error instanceof OpenAIConfigError) {
    return {
      message: error.message,
      isRetryable: false,
      errorCode: 'CONFIG_ERROR',
    };
  }

  if (error instanceof OpenAIRateLimitError) {
    return {
      message: error.message,
      isRetryable: true,
      errorCode: 'RATE_LIMITED',
      retryAfter: error.retryAfter,
    };
  }

  if (error instanceof OpenAITimeoutError) {
    return {
      message: error.message,
      isRetryable: true,
      errorCode: 'TIMEOUT',
    };
  }

  if (error instanceof OpenAIAPIError) {
    return {
      message: error.message,
      isRetryable: error.isRetryable,
      errorCode: `API_ERROR_${error.statusCode}`,
    };
  }

  if (error instanceof OpenAI.APIError) {
    const isRetryable = error.status === 429 || error.status === 500 || error.status === 502 || error.status === 503;
    return {
      message: error.message,
      isRetryable,
      errorCode: `OPENAI_${error.status}`,
      retryAfter: error.status === 429 ? 60 : undefined,
    };
  }

  // Network or unknown errors
  if (error instanceof Error) {
    const isNetworkError = error.message.includes('ECONNREFUSED') ||
                          error.message.includes('ETIMEDOUT') ||
                          error.message.includes('ENOTFOUND') ||
                          error.message.includes('fetch failed');
    return {
      message: error.message,
      isRetryable: isNetworkError,
      errorCode: isNetworkError ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
    };
  }

  return {
    message: 'An unknown error occurred',
    isRetryable: false,
    errorCode: 'UNKNOWN_ERROR',
  };
}

// Sleep helper for backoff
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate exponential backoff with jitter
function calculateBackoff(attempt: number, baseDelay: number = 1000, maxDelay: number = 60000): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (0-25% of the delay)
  const jitter = exponentialDelay * Math.random() * 0.25;
  return Math.floor(exponentialDelay + jitter);
}

// Template variable replacement
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

// Get a prompt template by name
export function getPromptTemplate(name: string): Prompt | null {
  const prompt = db.prepare('SELECT * FROM prompts WHERE name = ?').get(name) as Prompt | undefined;
  return prompt || null;
}

// Options for OpenAI calls
export interface OpenAICallOptions {
  maxTokens?: number;
  temperature?: number;
  jsonResponse?: boolean;
  maxRetries?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: Error, nextRetryIn: number) => void;
}

// Call OpenAI API with a prompt (with retry logic)
export async function callOpenAI(
  promptName: string,
  variables: Record<string, string | number>,
  options: OpenAICallOptions = {}
): Promise<string> {
  const prompt = getPromptTemplate(promptName);

  if (!prompt) {
    throw new OpenAIConfigError(`Prompt template "${promptName}" not found`);
  }

  const filledPrompt = replaceTemplateVariables(prompt.template, variables);

  const {
    maxTokens = 4096,
    temperature = 0.7,
    jsonResponse = false,
    maxRetries = 3,
    timeout = 120000, // 2 minutes default
    onRetry,
  } = options;

  console.log(`[OpenAI] Calling API with prompt: ${promptName}`);
  console.log(`[OpenAI] Variables:`, variables);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const openai = getOpenAIClient();

      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: filledPrompt,
            },
          ],
          max_tokens: maxTokens,
          temperature,
          ...(jsonResponse && { response_format: { type: 'json_object' } }),
        }, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const content = response.choices[0]?.message?.content;

        if (!content) {
          throw new OpenAIAPIError('No content in OpenAI response', 500, true);
        }

        console.log(`[OpenAI] Response received, length: ${content.length} chars`);

        return content;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is an abort error (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new OpenAITimeoutError(`Request timed out after ${timeout}ms`);
      }

      // Check for rate limiting
      if (error instanceof OpenAI.APIError && error.status === 429) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10);
        lastError = new OpenAIRateLimitError(error.message, retryAfter);
      }

      // Categorize the error to determine if we should retry
      const { isRetryable, retryAfter } = categorizeError(lastError);

      if (!isRetryable || attempt >= maxRetries) {
        console.error(`[OpenAI] Non-retryable error or max retries reached: ${lastError.message}`);
        throw lastError;
      }

      // Calculate backoff time
      const backoffTime = retryAfter ? retryAfter * 1000 : calculateBackoff(attempt);
      console.log(`[OpenAI] Attempt ${attempt + 1} failed, retrying in ${backoffTime}ms: ${lastError.message}`);

      // Call the onRetry callback if provided
      onRetry?.(attempt + 1, lastError, backoffTime);

      await sleep(backoffTime);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error in callOpenAI');
}

// Parse JSON response safely
export function parseJsonResponse<T>(response: string): T {
  try {
    // Try to extract JSON if it's wrapped in markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error('[OpenAI] Failed to parse JSON response:', response.substring(0, 500));
    throw new OpenAIAPIError('Failed to parse JSON response from OpenAI', 500, false);
  }
}

// Strip markdown code fences from content (GPT sometimes wraps content in ```markdown ... ```)
export function stripMarkdownCodeFences(content: string): string {
  // Check if the content starts with a markdown code fence
  const markdownFenceMatch = content.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)```\s*$/);
  if (markdownFenceMatch) {
    return markdownFenceMatch[1].trim();
  }

  // Also handle case where it might be at the start but not end, or have extra content
  const startFence = /^```(?:markdown|md)?\s*\n/;
  const endFence = /\n```\s*$/;

  let result = content;
  if (startFence.test(result)) {
    result = result.replace(startFence, '');
  }
  if (endFence.test(result)) {
    result = result.replace(endFence, '');
  }

  return result;
}

// Count words in text
export function countWords(text: string): number {
  return text
    .replace(/[#*_`~\[\]()]/g, '') // Remove markdown syntax
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

// Validate API key is configured
export function isApiKeyConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-api-key-here';
}

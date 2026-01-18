const API_BASE = '/api';

export interface Prompt {
  id: number;
  name: string;
  description: string;
  template: string;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  lesson_count: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: number;
  topic_id: number;
  lesson_number: number;
  title: string;
  description: string | null;
  file_path: string | null;
  podcast_file_path: string | null;
  word_count: number;
  podcast_word_count: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TopicWithLessons extends Topic {
  lessons: Lesson[];
}

// Health check
export async function checkHealth(): Promise<{ status: string; timestamp: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('API health check failed');
  return res.json();
}

// Prompts
export async function getPrompts(): Promise<Prompt[]> {
  const res = await fetch(`${API_BASE}/prompts`);
  if (!res.ok) throw new Error('Failed to fetch prompts');
  return res.json();
}

export async function getPrompt(id: number): Promise<Prompt> {
  const res = await fetch(`${API_BASE}/prompts/${id}`);
  if (!res.ok) throw new Error('Failed to fetch prompt');
  return res.json();
}

export async function updatePrompt(id: number, data: { template: string; description?: string }): Promise<Prompt> {
  const res = await fetch(`${API_BASE}/prompts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update prompt');
  return res.json();
}

// Topics
export async function getTopics(): Promise<Topic[]> {
  const res = await fetch(`${API_BASE}/topics`);
  if (!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

export async function getTopic(id: number): Promise<TopicWithLessons> {
  const res = await fetch(`${API_BASE}/topics/${id}`);
  if (!res.ok) throw new Error('Failed to fetch topic');
  return res.json();
}

export async function createTopic(title: string): Promise<Topic> {
  const res = await fetch(`${API_BASE}/topics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create topic');
  }
  return res.json();
}

export async function deleteTopic(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/topics/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete topic');
}

export interface GenerationResult {
  message: string;
  breakdown: {
    description: string;
    lessonCount: number;
    lessons: { number: number; title: string; description: string }[];
  } | null;
  status: {
    topic: Topic;
    lessons: Lesson[];
    progress: {
      total: number;
      completed: number;
      failed: number;
      current: number | null;
      step: 'breakdown' | 'content' | 'podcast' | 'complete';
    };
  };
}

export async function generateTopic(id: number): Promise<GenerationResult> {
  const res = await fetch(`${API_BASE}/topics/${id}/generate`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start generation');
  }
  return res.json();
}

export interface RetryResult {
  message: string;
  lessonsToRetry: number;
  status: {
    topic: Topic;
    lessons: Lesson[];
    progress: {
      total: number;
      completed: number;
      failed: number;
      current: number | null;
      step: 'breakdown' | 'content' | 'podcast' | 'complete';
    };
  };
}

export async function retryTopic(id: number): Promise<RetryResult> {
  const res = await fetch(`${API_BASE}/topics/${id}/retry`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to retry generation');
  }
  return res.json();
}

export interface TopicStatus {
  topic: Topic;
  lessons: Lesson[];
  progress: {
    total: number;
    completed: number;
    failed: number;
    current: number | null;
    step: 'breakdown' | 'content' | 'podcast' | 'complete';
  };
}

export async function getTopicStatus(id: number): Promise<TopicStatus> {
  const res = await fetch(`${API_BASE}/topics/${id}/status`);
  if (!res.ok) throw new Error('Failed to fetch topic status');
  return res.json();
}

// Lessons
export async function getLessonContent(id: number): Promise<{ content: string; word_count: number }> {
  const res = await fetch(`${API_BASE}/lessons/${id}/content`);
  if (!res.ok) throw new Error('Failed to fetch lesson content');
  return res.json();
}

export async function getPodcastContent(id: number): Promise<{ content: string; word_count: number }> {
  const res = await fetch(`${API_BASE}/lessons/${id}/podcast`);
  if (!res.ok) throw new Error('Failed to fetch podcast content');
  return res.json();
}

// Standalone Lessons
export interface StandaloneLesson {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  file_path: string | null;
  podcast_file_path: string | null;
  word_count: number;
  podcast_word_count: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export async function getStandaloneLessons(): Promise<StandaloneLesson[]> {
  const res = await fetch(`${API_BASE}/standalone-lessons`);
  if (!res.ok) throw new Error('Failed to fetch standalone lessons');
  return res.json();
}

export async function getStandaloneLesson(id: number): Promise<StandaloneLesson> {
  const res = await fetch(`${API_BASE}/standalone-lessons/${id}`);
  if (!res.ok) throw new Error('Failed to fetch standalone lesson');
  return res.json();
}

export async function createStandaloneLesson(title: string, description: string): Promise<StandaloneLesson> {
  const res = await fetch(`${API_BASE}/standalone-lessons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create standalone lesson');
  }
  return res.json();
}

export async function deleteStandaloneLesson(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/standalone-lessons/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete standalone lesson');
}

export async function generateStandaloneLesson(id: number): Promise<{ message: string; lesson: StandaloneLesson }> {
  const res = await fetch(`${API_BASE}/standalone-lessons/${id}/generate`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start generation');
  }
  return res.json();
}

export async function getStandaloneLessonContent(id: number): Promise<{ content: string; word_count: number }> {
  const res = await fetch(`${API_BASE}/standalone-lessons/${id}/content`);
  if (!res.ok) throw new Error('Failed to fetch standalone lesson content');
  return res.json();
}

export async function getStandalonePodcastContent(id: number): Promise<{ content: string; word_count: number }> {
  const res = await fetch(`${API_BASE}/standalone-lessons/${id}/podcast`);
  if (!res.ok) throw new Error('Failed to fetch standalone podcast content');
  return res.json();
}

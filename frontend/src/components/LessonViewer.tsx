import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLessonContent, getPodcastContent, Lesson } from '../services/api';
import MarkdownRenderer from './MarkdownRenderer';

interface LessonViewerProps {
  lesson: Lesson;
  totalLessons: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

type TabType = 'content' | 'podcast';

export default function LessonViewer({
  lesson,
  totalLessons,
  onPrevious,
  onNext,
  onClose,
}: LessonViewerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('content');

  const { data: contentData, isLoading: contentLoading, error: contentError } = useQuery({
    queryKey: ['lesson-content', lesson.id],
    queryFn: () => getLessonContent(lesson.id),
    enabled: lesson.status === 'completed' && activeTab === 'content',
  });

  const { data: podcastData, isLoading: podcastLoading, error: podcastError } = useQuery({
    queryKey: ['lesson-podcast', lesson.id],
    queryFn: () => getPodcastContent(lesson.id),
    enabled: lesson.status === 'completed' && activeTab === 'podcast',
  });

  const isLoading = activeTab === 'content' ? contentLoading : podcastLoading;
  const error = activeTab === 'content' ? contentError : podcastError;
  const content = activeTab === 'content' ? contentData?.content : podcastData?.content;
  const wordCount = activeTab === 'content' ? contentData?.word_count : podcastData?.word_count;

  const hasPrevious = lesson.lesson_number > 1;
  const hasNext = lesson.lesson_number < totalLessons;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 font-mono text-sm">
              Lesson {lesson.lesson_number} of {totalLessons}
            </span>
            <h2 className="text-lg font-semibold text-gray-900">{lesson.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b flex-shrink-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'content'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Lesson Content
                {lesson.word_count > 0 && (
                  <span className="text-xs text-gray-400">({lesson.word_count.toLocaleString()} words)</span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('podcast')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'podcast'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Podcast Summary
                {lesson.podcast_word_count > 0 && (
                  <span className="text-xs text-gray-400">({lesson.podcast_word_count.toLocaleString()} words)</span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {lesson.status !== 'completed' && (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>Content not yet generated</p>
              <p className="text-sm mt-1">Status: {lesson.status}</p>
            </div>
          )}

          {lesson.status === 'completed' && isLoading && (
            <div className="text-center py-12 text-gray-500">
              <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p>Loading content...</p>
            </div>
          )}

          {lesson.status === 'completed' && error && (
            <div className="text-center py-12 text-red-500">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p>Failed to load content</p>
              <p className="text-sm mt-1">{(error as Error).message}</p>
            </div>
          )}

          {lesson.status === 'completed' && !isLoading && !error && content && (
            <MarkdownRenderer content={content} />
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t flex items-center justify-between flex-shrink-0 bg-gray-50">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              hasPrevious
                ? 'text-gray-700 hover:bg-gray-200'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          <div className="text-sm text-gray-500">
            {wordCount && `${wordCount.toLocaleString()} words`}
          </div>

          <button
            onClick={onNext}
            disabled={!hasNext}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              hasNext
                ? 'text-gray-700 hover:bg-gray-200'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            Next
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

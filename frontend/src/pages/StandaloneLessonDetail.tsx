import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  getStandaloneLesson,
  getStandaloneLessonContent,
  getStandalonePodcastContent,
  generateStandaloneLesson,
} from '../services/api';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    generating: 'bg-purple-100 text-purple-700',
    completed: 'bg-teal-100 text-teal-700',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function StandaloneLessonDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'lesson' | 'podcast'>('lesson');

  const { data: lesson, isLoading, error } = useQuery({
    queryKey: ['standalone-lesson', id],
    queryFn: () => getStandaloneLesson(Number(id)),
    enabled: !!id,
    refetchInterval: (query) => query.state.data?.status === 'generating' ? 3000 : false,
  });

  const { data: lessonContent } = useQuery({
    queryKey: ['standalone-lesson-content', id],
    queryFn: () => getStandaloneLessonContent(Number(id)),
    enabled: !!id && lesson?.status === 'completed',
  });

  const { data: podcastContent } = useQuery({
    queryKey: ['standalone-podcast-content', id],
    queryFn: () => getStandalonePodcastContent(Number(id)),
    enabled: !!id && lesson?.status === 'completed',
  });

  const generateMutation = useMutation({
    mutationFn: () => generateStandaloneLesson(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standalone-lesson', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading lesson...
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load lesson.</p>
        <Link to="/" className="text-teal-600 hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/" className="text-gray-500 hover:text-gray-700 mt-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-gray-600 mt-1">{lesson.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            <StatusBadge status={lesson.status} />
            {lesson.word_count > 0 && (
              <span>{lesson.word_count.toLocaleString()} words</span>
            )}
            {lesson.podcast_word_count > 0 && (
              <span>Podcast: {lesson.podcast_word_count.toLocaleString()} words</span>
            )}
          </div>
        </div>
      </div>

      {/* Pending - Generate Button */}
      {lesson.status === 'pending' && (
        <div className="bg-gradient-to-r from-teal-50 to-purple-50 border border-teal-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-teal-900 mb-2">
            Ready to Generate Content
          </h2>
          <p className="text-teal-700 mb-4">
            Click the button below to generate the lesson content and podcast summary.
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-6 py-2 bg-gradient-to-r from-teal-500 to-purple-500 text-white rounded-lg hover:from-teal-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generateMutation.isPending && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {generateMutation.isPending ? 'Starting...' : 'Generate Content'}
          </button>
        </div>
      )}

      {/* Generating - Progress */}
      {lesson.status === 'generating' && (
        <div className="bg-gradient-to-r from-teal-50 to-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <h2 className="text-lg font-semibold text-purple-900">
              Generating Content...
            </h2>
          </div>
          <p className="text-purple-700 mt-2">
            Creating lesson content and podcast summary. This may take a few minutes.
          </p>
        </div>
      )}

      {/* Failed - Retry */}
      {lesson.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            Generation Failed
          </h2>
          {lesson.last_error && (
            <p className="text-red-700 mb-3 text-sm bg-red-100 rounded px-3 py-2">
              {lesson.last_error}
            </p>
          )}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {generateMutation.isPending && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {generateMutation.isPending ? 'Retrying...' : 'Retry Generation'}
          </button>
        </div>
      )}

      {/* Completed - Content Viewer */}
      {lesson.status === 'completed' && (
        <div className="bg-white rounded-lg shadow">
          {/* Tabs */}
          <div className="border-b flex">
            <button
              onClick={() => setActiveTab('lesson')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'lesson'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Lesson Content
              {lessonContent && (
                <span className="ml-2 text-xs text-gray-400">
                  ({lessonContent.word_count.toLocaleString()} words)
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('podcast')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'podcast'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Podcast Script
              {podcastContent && (
                <span className="ml-2 text-xs text-gray-400">
                  ({podcastContent.word_count.toLocaleString()} words)
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'lesson' && lessonContent && (
              <div className="prose prose-teal max-w-none">
                <ReactMarkdown>{lessonContent.content}</ReactMarkdown>
              </div>
            )}
            {activeTab === 'podcast' && podcastContent && (
              <div className="prose prose-purple max-w-none">
                <ReactMarkdown>{podcastContent.content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File Paths Info */}
      {lesson.status === 'completed' && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-teal-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Content generated successfully!</span>
          </div>
          <p className="text-sm text-teal-700 mt-1">
            Files saved to: <code className="bg-teal-100 px-1 rounded">generated-content/{lesson.file_path}</code>
          </p>
        </div>
      )}
    </div>
  );
}

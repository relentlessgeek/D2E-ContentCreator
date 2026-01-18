import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTopic, generateTopic, getTopicStatus, retryTopic, Lesson, TopicStatus } from '../services/api';
import { useSSE, SSEEvent } from '../hooks/useSSE';
import LessonViewer from '../components/LessonViewer';
import GenerationProgress from '../components/GenerationProgress';

function LessonStatusBadge({ status, retryCount }: { status: Lesson['status']; retryCount?: number }) {
  const colors = {
    pending: 'bg-gray-100 text-gray-600',
    generating: 'bg-blue-100 text-blue-700 animate-pulse',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex items-center gap-1">
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
        {status}
      </span>
      {status === 'failed' && retryCount !== undefined && retryCount > 0 && (
        <span className="text-xs text-gray-500">
          (retry {retryCount}/3)
        </span>
      )}
    </div>
  );
}

export default function TopicDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedLessonIndex, setSelectedLessonIndex] = useState<number | null>(null);
  const [currentLessonTitle, setCurrentLessonTitle] = useState<string | undefined>();

  const { data: topic, isLoading, error } = useQuery({
    queryKey: ['topic', id],
    queryFn: () => getTopic(Number(id)),
    enabled: !!id,
  });

  // SSE for real-time updates when generating
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    console.log('[SSE Event]', event.type, event.data);

    switch (event.type) {
      case 'connected': {
        // Initial status received
        const status = event.data.currentStatus as TopicStatus | undefined;
        if (status) {
          queryClient.setQueryData(['topic', id], {
            ...status.topic,
            lessons: status.lessons,
          });
        }
        break;
      }
      case 'breakdown_complete':
        // Refresh to get the new lessons
        queryClient.invalidateQueries({ queryKey: ['topic', id] });
        break;
      case 'lesson_start':
        setCurrentLessonTitle(event.data.lessonTitle as string);
        // Update lesson status to generating
        queryClient.setQueryData(['topic', id], (old: typeof topic) => {
          if (!old) return old;
          return {
            ...old,
            lessons: old.lessons.map(l =>
              l.lesson_number === event.data.lessonNumber
                ? { ...l, status: 'generating' as const }
                : l
            ),
          };
        });
        break;
      case 'lesson_content_complete':
        // Update lesson with word count
        queryClient.setQueryData(['topic', id], (old: typeof topic) => {
          if (!old) return old;
          return {
            ...old,
            lessons: old.lessons.map(l =>
              l.lesson_number === event.data.lessonNumber
                ? { ...l, word_count: event.data.wordCount as number }
                : l
            ),
          };
        });
        break;
      case 'lesson_podcast_complete':
        // Update lesson with podcast word count
        queryClient.setQueryData(['topic', id], (old: typeof topic) => {
          if (!old) return old;
          return {
            ...old,
            lessons: old.lessons.map(l =>
              l.lesson_number === event.data.lessonNumber
                ? { ...l, podcast_word_count: event.data.wordCount as number }
                : l
            ),
          };
        });
        break;
      case 'lesson_complete':
        // Mark lesson as completed
        queryClient.setQueryData(['topic', id], (old: typeof topic) => {
          if (!old) return old;
          return {
            ...old,
            lessons: old.lessons.map(l =>
              l.lesson_number === event.data.lessonNumber
                ? { ...l, status: 'completed' as const, last_error: null }
                : l
            ),
          };
        });
        setCurrentLessonTitle(undefined);
        break;
      case 'lesson_error':
        // Mark lesson as failed with error
        queryClient.setQueryData(['topic', id], (old: typeof topic) => {
          if (!old) return old;
          return {
            ...old,
            lessons: old.lessons.map(l =>
              l.lesson_number === event.data.lessonNumber
                ? {
                    ...l,
                    status: 'failed' as const,
                    last_error: event.data.error as string,
                    retry_count: (l.retry_count || 0) + 1,
                  }
                : l
            ),
          };
        });
        break;
      case 'generation_complete':
        // Mark topic as completed
        queryClient.setQueryData(['topic', id], (old: typeof topic) => {
          if (!old) return old;
          return {
            ...old,
            status: 'completed' as const,
            last_error: null,
          };
        });
        queryClient.invalidateQueries({ queryKey: ['topics'] });
        setCurrentLessonTitle(undefined);
        break;
      case 'generation_error':
        // Mark topic as failed
        queryClient.setQueryData(['topic', id], (old: typeof topic) => {
          if (!old) return old;
          return {
            ...old,
            status: 'failed' as const,
            last_error: event.data.error as string,
          };
        });
        queryClient.invalidateQueries({ queryKey: ['topics'] });
        setCurrentLessonTitle(undefined);
        break;
    }
  }, [id, queryClient, topic]);

  const { isConnected: sseConnected, error: sseError } = useSSE(
    topic?.status === 'generating' ? Number(id) : null,
    {
      enabled: topic?.status === 'generating',
      onEvent: handleSSEEvent,
    }
  );

  // Fallback: Poll for status when SSE is not connected and generating
  const { data: statusData } = useQuery({
    queryKey: ['topic-status', id],
    queryFn: () => getTopicStatus(Number(id)),
    enabled: !!id && topic?.status === 'generating' && !sseConnected,
    refetchInterval: 3000,
  });

  // Update topic data from polling when SSE is not available
  useEffect(() => {
    if (!sseConnected && statusData) {
      if (statusData.topic.status !== topic?.status) {
        queryClient.invalidateQueries({ queryKey: ['topic', id] });
        queryClient.invalidateQueries({ queryKey: ['topics'] });
      }
      if (statusData.lessons.some((l, i) =>
        l.status !== topic?.lessons[i]?.status ||
        l.word_count !== topic?.lessons[i]?.word_count
      )) {
        queryClient.setQueryData(['topic', id], {
          ...statusData.topic,
          lessons: statusData.lessons,
        });
      }
    }
  }, [statusData, topic, id, queryClient, sseConnected]);

  const generateMutation = useMutation({
    mutationFn: () => generateTopic(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', id] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => retryTopic(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', id] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading topic...
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load topic.</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  const progress = statusData?.progress || {
    total: topic.lessons.length,
    completed: topic.lessons.filter(l => l.status === 'completed').length,
    failed: topic.lessons.filter(l => l.status === 'failed').length,
    current: topic.lessons.find(l => l.status === 'generating')?.lesson_number || null,
    step: 'content' as const,
  };

  const selectedLesson = selectedLessonIndex !== null ? topic.lessons[selectedLessonIndex] : null;

  const handleLessonClick = (index: number) => {
    const lesson = topic.lessons[index];
    if (lesson.status === 'completed') {
      setSelectedLessonIndex(index);
    }
  };

  // Check if there are retryable lessons
  const hasRetryableLessons = topic.lessons.some(
    l => (l.status === 'failed' || l.status === 'pending') && (l.retry_count || 0) < 3
  );

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
          <h1 className="text-2xl font-bold">{topic.title}</h1>
          {topic.description && (
            <p className="text-gray-600 mt-1">{topic.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              topic.status === 'completed' ? 'bg-green-100 text-green-800' :
              topic.status === 'generating' ? 'bg-blue-100 text-blue-800' :
              topic.status === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {topic.status}
            </span>
            <span>{topic.lesson_count} lessons</span>
          </div>
        </div>
      </div>

      {/* Generate Button for Pending Topics */}
      {topic.status === 'pending' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            Ready to Generate Content
          </h2>
          <p className="text-blue-700 mb-4">
            Click the button below to analyze this topic, create lessons, and generate full content using AI.
            This process will create detailed lessons (2700-3300 words each) and podcast summaries (1000-1200 words each).
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generateMutation.isPending && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {generateMutation.isPending ? 'Starting...' : 'Generate All Content'}
          </button>
          {generateMutation.error && (
            <p className="mt-3 text-red-600 text-sm">
              {generateMutation.error.message}
            </p>
          )}
        </div>
      )}

      {/* Generation Progress */}
      {topic.status === 'generating' && (
        <GenerationProgress
          progress={progress}
          lessons={topic.lessons}
          currentLessonTitle={currentLessonTitle}
          sseConnected={sseConnected}
          sseError={sseError}
        />
      )}

      {/* Completed Status */}
      {topic.status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">All content generated successfully!</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Click on any lesson below to view its content. Files are also saved to: <code className="bg-green-100 px-1 rounded">generated-content/{topic.slug}/</code>
          </p>
        </div>
      )}

      {/* Failed Status */}
      {topic.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            Generation Failed
          </h2>
          {topic.last_error && (
            <p className="text-red-700 mb-3 text-sm bg-red-100 rounded px-3 py-2">
              {topic.last_error}
            </p>
          )}
          <p className="text-red-700 mb-4">
            {hasRetryableLessons
              ? 'Some lessons failed to generate. Completed lessons have been preserved. Click retry to continue.'
              : 'All retry attempts have been exhausted. You may need to delete and recreate this topic.'}
          </p>
          {hasRetryableLessons && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {retryMutation.isPending && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {retryMutation.isPending ? 'Retrying...' : 'Retry Failed Lessons'}
            </button>
          )}
          {retryMutation.error && (
            <p className="mt-3 text-red-600 text-sm">
              {retryMutation.error.message}
            </p>
          )}
        </div>
      )}

      {/* Lessons List */}
      {topic.lessons.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Lessons ({topic.lessons.length})</h2>
            {topic.status === 'completed' && (
              <p className="text-sm text-gray-500 mt-1">Click on a lesson to view its content</p>
            )}
          </div>
          <ul className="divide-y">
            {topic.lessons.map((lesson, index) => (
              <li
                key={lesson.id}
                onClick={() => handleLessonClick(index)}
                className={`p-4 ${
                  lesson.status === 'completed'
                    ? 'hover:bg-blue-50 cursor-pointer'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-mono text-sm">
                        {String(lesson.lesson_number).padStart(2, '0')}
                      </span>
                      <span className={`font-medium ${
                        lesson.status === 'completed' ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {lesson.title}
                      </span>
                      <LessonStatusBadge status={lesson.status} retryCount={lesson.retry_count} />
                    </div>
                    {lesson.description && (
                      <p className="text-sm text-gray-500 mt-1 ml-8">
                        {lesson.description}
                      </p>
                    )}
                    {/* Error message for failed lessons */}
                    {lesson.status === 'failed' && lesson.last_error && (
                      <p className="text-xs text-red-500 mt-1 ml-8 bg-red-50 rounded px-2 py-1">
                        Error: {lesson.last_error}
                      </p>
                    )}
                    {(lesson.word_count > 0 || lesson.podcast_word_count > 0) && (
                      <div className="text-xs text-gray-400 mt-2 ml-8 flex gap-4">
                        {lesson.word_count > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {lesson.word_count.toLocaleString()} words
                          </span>
                        )}
                        {lesson.podcast_word_count > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            {lesson.podcast_word_count.toLocaleString()} words
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {lesson.status === 'completed' && (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lesson Viewer Modal */}
      {selectedLesson && (
        <LessonViewer
          lesson={selectedLesson}
          totalLessons={topic.lessons.length}
          onPrevious={() => {
            if (selectedLessonIndex !== null && selectedLessonIndex > 0) {
              const prevIndex = selectedLessonIndex - 1;
              if (topic.lessons[prevIndex].status === 'completed') {
                setSelectedLessonIndex(prevIndex);
              }
            }
          }}
          onNext={() => {
            if (selectedLessonIndex !== null && selectedLessonIndex < topic.lessons.length - 1) {
              const nextIndex = selectedLessonIndex + 1;
              if (topic.lessons[nextIndex].status === 'completed') {
                setSelectedLessonIndex(nextIndex);
              }
            }
          }}
          onClose={() => setSelectedLessonIndex(null)}
        />
      )}
    </div>
  );
}

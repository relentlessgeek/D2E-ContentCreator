import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getTopics,
  createTopic,
  deleteTopic,
  checkHealth,
  Topic,
  getStandaloneLessons,
  createStandaloneLesson,
  deleteStandaloneLesson,
  generateStandaloneLesson,
  StandaloneLesson,
} from '../services/api';

function StatusBadge({ status }: { status: Topic['status'] | StandaloneLesson['status'] }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    generating: 'bg-purple-100 text-purple-700',
    completed: 'bg-teal-100 text-teal-700',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

export default function Home() {
  const [newTopic, setNewTopic] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonDescription, setNewLessonDescription] = useState('');
  const queryClient = useQueryClient();

  const { data: health, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
  });

  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ['topics'],
    queryFn: getTopics,
  });

  const { data: standaloneLessons, isLoading: standaloneLessonsLoading } = useQuery({
    queryKey: ['standalone-lessons'],
    queryFn: getStandaloneLessons,
  });

  const createMutation = useMutation({
    mutationFn: createTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      setNewTopic('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });

  const createStandaloneMutation = useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) =>
      createStandaloneLesson(title, description),
    onSuccess: (lesson) => {
      queryClient.invalidateQueries({ queryKey: ['standalone-lessons'] });
      setNewLessonTitle('');
      setNewLessonDescription('');
      // Auto-start generation
      generateStandaloneMutation.mutate(lesson.id);
    },
  });

  const deleteStandaloneMutation = useMutation({
    mutationFn: deleteStandaloneLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standalone-lessons'] });
    },
  });

  const generateStandaloneMutation = useMutation({
    mutationFn: generateStandaloneLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standalone-lessons'] });
    },
  });

  // Poll for standalone lessons that are generating
  useQuery({
    queryKey: ['standalone-lessons'],
    queryFn: getStandaloneLessons,
    refetchInterval: standaloneLessons?.some(l => l.status === 'generating') ? 3000 : false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTopic.trim()) {
      createMutation.mutate(newTopic.trim());
    }
  };

  const handleStandaloneLessonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLessonTitle.trim()) {
      createStandaloneMutation.mutate({
        title: newLessonTitle.trim(),
        description: newLessonDescription.trim(),
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* API Status */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">API Status</h2>
        {healthLoading && <p className="text-gray-400">Checking...</p>}
        {healthError && (
          <p className="text-red-600">
            Backend not responding. Make sure the server is running on port 3001.
          </p>
        )}
        {health && (
          <p className="text-teal-600">
            Connected - v{health.version}
          </p>
        )}
      </div>

      {/* Create New Topic */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Module and Lessons</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter a topic to generate a full module with 3-12 lessons automatically structured.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Enter a business/entrepreneurship topic..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={!newTopic.trim() || createMutation.isPending}
            className="px-6 py-2 bg-gradient-to-r from-teal-500 to-purple-500 text-white rounded-lg hover:from-teal-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Module'}
          </button>
        </form>
        {createMutation.error && (
          <p className="mt-2 text-red-600 text-sm">
            {createMutation.error.message}
          </p>
        )}
      </div>

      {/* Create Single Lesson */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Create Single Lesson</h2>
        <p className="text-sm text-gray-500 mb-4">
          Create a standalone lesson with a specific title and description.
        </p>
        <form onSubmit={handleStandaloneLessonSubmit} className="space-y-4">
          <input
            type="text"
            value={newLessonTitle}
            onChange={(e) => setNewLessonTitle(e.target.value)}
            placeholder="Lesson title (e.g., 'How to Write a Business Plan')"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <textarea
            value={newLessonDescription}
            onChange={(e) => setNewLessonDescription(e.target.value)}
            placeholder="Brief description of what this lesson should cover (optional but recommended)..."
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
          />
          <button
            type="submit"
            disabled={!newLessonTitle.trim() || createStandaloneMutation.isPending}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-teal-500 text-white rounded-lg hover:from-purple-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createStandaloneMutation.isPending ? 'Creating...' : 'Create Lesson'}
          </button>
        </form>
        {createStandaloneMutation.error && (
          <p className="mt-2 text-red-600 text-sm">
            {createStandaloneMutation.error.message}
          </p>
        )}
      </div>

      {/* Topics List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Your Modules</h2>
        </div>

        {topicsLoading && (
          <div className="p-6 text-gray-400">Loading modules...</div>
        )}

        {topics && topics.length === 0 && (
          <div className="p-6 text-gray-500 text-center">
            No modules yet. Create your first module above!
          </div>
        )}

        {topics && topics.length > 0 && (
          <ul className="divide-y">
            {topics.map((topic) => (
              <li key={topic.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex-1">
                  <Link
                    to={`/topic/${topic.id}`}
                    className="text-teal-600 hover:text-teal-700 hover:underline font-medium"
                  >
                    {topic.title}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <StatusBadge status={topic.status} />
                    <span>{topic.lesson_count} lessons</span>
                    <span>Created {new Date(topic.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this module?')) {
                      deleteMutation.mutate(topic.id);
                    }
                  }}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Standalone Lessons List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Your Standalone Lessons</h2>
        </div>

        {standaloneLessonsLoading && (
          <div className="p-6 text-gray-400">Loading lessons...</div>
        )}

        {standaloneLessons && standaloneLessons.length === 0 && (
          <div className="p-6 text-gray-500 text-center">
            No standalone lessons yet. Create your first lesson above!
          </div>
        )}

        {standaloneLessons && standaloneLessons.length > 0 && (
          <ul className="divide-y">
            {standaloneLessons.map((lesson) => (
              <li key={lesson.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex-1">
                  <Link
                    to={`/standalone-lesson/${lesson.id}`}
                    className="text-purple-600 hover:text-purple-700 hover:underline font-medium"
                  >
                    {lesson.title}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <StatusBadge status={lesson.status} />
                    {lesson.word_count > 0 && (
                      <span>{lesson.word_count.toLocaleString()} words</span>
                    )}
                    <span>Created {new Date(lesson.created_at).toLocaleDateString()}</span>
                  </div>
                  {lesson.description && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-1">{lesson.description}</p>
                  )}
                  {lesson.status === 'failed' && lesson.last_error && (
                    <p className="text-xs text-red-500 mt-1">{lesson.last_error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {lesson.status === 'generating' && (
                    <span className="flex items-center gap-1 text-purple-600 text-sm">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </span>
                  )}
                  {lesson.status === 'failed' && (
                    <button
                      onClick={() => generateStandaloneMutation.mutate(lesson.id)}
                      disabled={generateStandaloneMutation.isPending}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this lesson?')) {
                        deleteStandaloneMutation.mutate(lesson.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getTopics, createTopic, deleteTopic, checkHealth, Topic } from '../services/api';

function StatusBadge({ status }: { status: Topic['status'] }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    generating: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
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
  const queryClient = useQueryClient();

  const { data: health, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
  });

  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ['topics'],
    queryFn: getTopics,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTopic.trim()) {
      createMutation.mutate(newTopic.trim());
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
          <p className="text-green-600">
            Connected - v{health.version}
          </p>
        )}
      </div>

      {/* Create New Topic */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Learning Content</h2>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Enter a business/entrepreneurship topic..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newTopic.trim() || createMutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Topic'}
          </button>
        </form>
        {createMutation.error && (
          <p className="mt-2 text-red-600 text-sm">
            {createMutation.error.message}
          </p>
        )}
      </div>

      {/* Topics List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Your Topics</h2>
        </div>

        {topicsLoading && (
          <div className="p-6 text-gray-400">Loading topics...</div>
        )}

        {topics && topics.length === 0 && (
          <div className="p-6 text-gray-500 text-center">
            No topics yet. Create your first topic above!
          </div>
        )}

        {topics && topics.length > 0 && (
          <ul className="divide-y">
            {topics.map((topic) => (
              <li key={topic.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex-1">
                  <Link
                    to={`/topic/${topic.id}`}
                    className="text-blue-600 hover:underline font-medium"
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
                    if (confirm('Are you sure you want to delete this topic?')) {
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
    </div>
  );
}

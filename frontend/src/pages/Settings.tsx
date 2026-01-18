import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPrompts, updatePrompt, Prompt } from '../services/api';

function PromptEditor({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const [template, setTemplate] = useState(prompt.template);
  const [description, setDescription] = useState(prompt.description);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () => updatePrompt(prompt.id, { template, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Edit Prompt: {prompt.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Available variables: {'{{topic}}'}, {'{{lesson_number}}'}, {'{{total_lessons}}'}, {'{{lesson_title}}'}, {'{{lesson_description}}'}, {'{{lesson_content}}'}
            </p>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {updateMutation.error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm">
            {updateMutation.error.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const { data: prompts, isLoading, error } = useQuery({
    queryKey: ['prompts'],
    queryFn: getPrompts,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure the prompts used to generate learning content.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">System Prompts</h2>
          <p className="text-sm text-gray-500 mt-1">
            These prompts are sent to ChatGPT to generate content. Edit them to customize the output.
          </p>
        </div>

        {isLoading && (
          <div className="p-6 text-gray-400">Loading prompts...</div>
        )}

        {error && (
          <div className="p-6 text-red-600">
            Failed to load prompts. Make sure the backend is running.
          </div>
        )}

        {prompts && (
          <ul className="divide-y">
            {prompts.map((prompt) => (
              <li key={prompt.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {prompt.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{prompt.description}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Last updated: {new Date(prompt.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingPrompt(prompt)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">OpenAI API Key</h2>
        <p className="text-sm text-gray-500 mb-4">
          Your API key is stored in the <code className="bg-gray-100 px-1 rounded">.env</code> file
          on the server. Edit that file to change your API key.
        </p>
        <code className="block bg-gray-100 p-3 rounded text-sm">
          OPENAI_API_KEY=your-api-key-here
        </code>
      </div>

      {editingPrompt && (
        <PromptEditor
          prompt={editingPrompt}
          onClose={() => setEditingPrompt(null)}
        />
      )}
    </div>
  );
}

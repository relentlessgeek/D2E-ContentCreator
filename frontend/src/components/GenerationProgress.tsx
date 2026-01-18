import { Lesson } from '../services/api';

interface GenerationProgressProps {
  progress: {
    total: number;
    completed: number;
    failed: number;
    current: number | null;
    step: 'breakdown' | 'content' | 'podcast' | 'complete';
  };
  lessons: Lesson[];
  currentLessonTitle?: string;
  sseConnected?: boolean;
  sseError?: string | null;
}

function ProgressBar({ completed, total, failed }: { completed: number; total: number; failed: number }) {
  const completedPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const failedPercent = total > 0 ? Math.round((failed / total) * 100) : 0;

  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div className="flex h-full">
        <div
          className="bg-teal-500 h-full transition-all duration-500"
          style={{ width: `${completedPercent}%` }}
        />
        <div
          className="bg-red-400 h-full transition-all duration-500"
          style={{ width: `${failedPercent}%` }}
        />
      </div>
    </div>
  );
}

function StepIndicator({ step, isActive, isComplete }: { step: string; isActive: boolean; isComplete: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${
      isComplete ? 'text-teal-600' : isActive ? 'text-purple-600' : 'text-gray-400'
    }`}>
      {isComplete ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ) : isActive ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="currentColor" fillOpacity="0.3" />
        </svg>
      )}
      <span className={isActive ? 'font-medium' : ''}>{step}</span>
    </div>
  );
}

export default function GenerationProgress({
  progress,
  lessons,
  currentLessonTitle,
  sseConnected = false,
  sseError = null,
}: GenerationProgressProps) {
  const currentLesson = lessons.find(l => l.lesson_number === progress.current);
  const displayTitle = currentLessonTitle || currentLesson?.title || 'Unknown';

  const getStepLabel = () => {
    if (progress.step === 'breakdown') return 'Analyzing topic structure...';
    if (progress.step === 'content') return `Writing lesson content...`;
    if (progress.step === 'podcast') return `Creating podcast summary...`;
    return 'Generation complete';
  };

  const getDetailedStatus = () => {
    if (progress.step === 'breakdown') {
      return 'Breaking down topic into lessons';
    }
    if (progress.current) {
      if (progress.step === 'content') {
        return `Lesson ${progress.current}: ${displayTitle} - Writing content (~2700-3300 words)`;
      }
      if (progress.step === 'podcast') {
        return `Lesson ${progress.current}: ${displayTitle} - Creating podcast (~1000-1200 words)`;
      }
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-r from-teal-50 to-purple-50 border border-purple-200 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <h2 className="text-lg font-semibold text-purple-900">
            Generating Content...
          </h2>
        </div>

        {/* SSE Connection Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-teal-500' : 'bg-yellow-500'}`} />
          <span className="text-xs text-gray-500">
            {sseConnected ? 'Live updates' : 'Polling'}
          </span>
        </div>
      </div>

      {/* SSE Error */}
      {sseError && (
        <div className="text-sm text-yellow-700 bg-yellow-100 rounded px-3 py-2">
          {sseError}
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-purple-700">
          <span>{getStepLabel()}</span>
          <span>
            {progress.completed} / {progress.total} completed
            {progress.failed > 0 && (
              <span className="text-red-600 ml-1">({progress.failed} failed)</span>
            )}
          </span>
        </div>
        <ProgressBar completed={progress.completed} total={progress.total} failed={progress.failed} />
      </div>

      {/* Current Operation Details */}
      {getDetailedStatus() && (
        <div className="bg-white/50 rounded-lg px-4 py-3 border border-purple-100">
          <div className="text-sm text-purple-800 font-medium">
            {getDetailedStatus()}
          </div>
        </div>
      )}

      {/* Step Progress */}
      <div className="flex items-center gap-6 pt-2">
        <StepIndicator
          step="Breakdown"
          isActive={progress.step === 'breakdown'}
          isComplete={progress.total > 0}
        />
        <div className="h-px flex-1 bg-gray-300" />
        <StepIndicator
          step="Content"
          isActive={progress.step === 'content'}
          isComplete={progress.completed > 0 || progress.step === 'podcast' || progress.step === 'complete'}
        />
        <div className="h-px flex-1 bg-gray-300" />
        <StepIndicator
          step="Podcasts"
          isActive={progress.step === 'podcast'}
          isComplete={progress.step === 'complete'}
        />
      </div>

      {/* Lesson Progress List */}
      {lessons.length > 0 && (
        <div className="pt-4 border-t border-purple-200">
          <h3 className="text-sm font-medium text-purple-900 mb-2">Lesson Progress</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {lessons.map(lesson => (
              <div
                key={lesson.id}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                  lesson.status === 'completed' ? 'bg-teal-100 text-teal-700' :
                  lesson.status === 'generating' ? 'bg-purple-100 text-purple-700' :
                  lesson.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}
              >
                {lesson.status === 'completed' && (
                  <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {lesson.status === 'generating' && (
                  <svg className="w-3 h-3 flex-shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {lesson.status === 'failed' && (
                  <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                {lesson.status === 'pending' && (
                  <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="6" fill="currentColor" fillOpacity="0.3" />
                  </svg>
                )}
                <span className="truncate">L{lesson.lesson_number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <p className="text-sm text-purple-600 pt-2">
        This may take several minutes depending on the number of lessons.
        {sseConnected ? ' Progress updates in real-time.' : ' Page refreshes every 3 seconds.'}
      </p>
    </div>
  );
}

'use client';

interface LoadingProgressProps {
  status: string;
  progress?: number;
  message?: string;
}

interface Stage {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const STAGES: Record<string, Stage> = {
  queued: {
    id: 'queued',
    label: 'Queued',
    icon: '⏳',
    description: 'Your job is queued and will start soon...',
  },
  generating_code: {
    id: 'generating_code',
    label: 'Generating Code',
    icon: '⚙️',
    description: 'Analyzing your prompt and generating Manim code...',
  },
  rendering: {
    id: 'rendering',
    label: 'Rendering',
    icon: '🎬',
    description: 'Rendering your 3D animation in sandbox...',
  },
};

export default function LoadingProgress({
  status,
  progress = 0,
  message,
}: LoadingProgressProps) {
  const stage = STAGES[status] || STAGES.queued;
  const displayProgress = Math.min(100, Math.max(0, progress || 0));
  const stagesList = Object.values(STAGES);
  const currentStageIndex = stagesList.findIndex((s) => s.id === status);

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      {/* Stage Timeline */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {stagesList.map((s, index) => {
            const isActive = s.id === status;
            const isCompleted = index < currentStageIndex;

            return (
              <div key={s.id} className="flex flex-col items-center flex-1 relative">
                {/* Stage Circle */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold transition-all z-10 ${
                    isActive
                      ? 'bg-blue-600 text-white scale-110 shadow-lg'
                      : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? '✓' : s.icon}
                </div>
                <p
                  className={`mt-2 text-sm font-medium text-center ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </p>

                {/* Connecting Line */}
                {index < stagesList.length - 1 && (
                  <div
                    className={`absolute top-6 left-1/2 h-0.5 transition-colors ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                    style={{
                      width: 'calc(100% + 24px)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Stage Info */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {stage.label}
        </h2>
        <p className="text-gray-600">
          {message || stage.description}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-medium text-gray-600">Progress</p>
          <p className="text-xs font-medium text-gray-600">{displayProgress}%</p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-blue-600"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>

      {/* Help Text */}
      <p className="text-sm text-gray-500 text-center">
        This may take a few moments. The page will update automatically.
      </p>
    </div>
  );
}

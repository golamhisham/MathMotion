'use client';

interface LoadingProgressProps {
  status: string;
  progress?: number;
  message?: string;
}

export default function LoadingProgress({
  status,
  progress,
  message,
}: LoadingProgressProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-8 text-center">
      {/* Animated spinner */}
      <div className="flex justify-center mb-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600" />
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Processing Your Animation
      </h2>

      <p className="text-gray-600 mb-4">
        {message ||
          (status === 'queued' && 'Your job is queued and will start soon...') ||
          (status === 'generating' &&
            'Generating Manim code from your prompt...') ||
          (status === 'rendering' && 'Rendering your animation...')}
      </p>

      {progress !== undefined && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <p className="text-sm text-gray-500">
        This may take a few moments. The page will update automatically.
      </p>
    </div>
  );
}

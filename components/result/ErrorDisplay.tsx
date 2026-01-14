'use client';

import { JobError } from '@/types';

interface ErrorDisplayProps {
  error: JobError;
  onRetry?: () => void;
}

export default function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Generation Failed
        </h2>

        <p className="text-gray-600 mb-4">{error.message}</p>

        {error.stage && (
          <p className="text-sm text-gray-500 mb-4">
            Failed during: <span className="font-medium capitalize">
              {error.stage.replace(/_/g, ' ')}
            </span>
          </p>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>

      {error.logs && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            View Error Logs
          </summary>
          <pre className="mt-2 bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
            {error.logs}
          </pre>
        </details>
      )}
    </div>
  );
}

'use client';

import { JobError } from '@/types';

interface ErrorDisplayProps {
  error: JobError;
  onRetry?: () => void;
  onAutoFix?: () => void;
  attemptNumber?: number;
  maxAttempts?: number;
  autoFixAttemptCount?: number;
}

export default function ErrorDisplay({
  error,
  onRetry,
  onAutoFix,
  attemptNumber = 1,
  maxAttempts = 3,
  autoFixAttemptCount = 0,
}: ErrorDisplayProps) {
  const canRetry = onRetry && attemptNumber < maxAttempts;
  const attemptsRemaining = maxAttempts - attemptNumber;
  const isLastAttempt = attemptNumber === maxAttempts;

  // Auto-fix only available for validation and runtime errors, not timeout/network/api errors
  const isAutoFixableError = error.type === 'validation' || error.type === 'runtime_error';
  const canAutoFix = onAutoFix && autoFixAttemptCount < 2 && isAutoFixableError;

  // Type-specific messages
  const getErrorTypeLabel = () => {
    switch (error.type) {
      case 'validation':
        return 'Validation Error';
      case 'runtime_error':
        return 'Runtime Error';
      case 'timeout':
        return 'Timeout Error';
      case 'network_error':
        return 'Network Error';
      case 'api_error':
        return 'Service Error';
      default:
        return 'Error';
    }
  };

  const getErrorTypeDescription = () => {
    switch (error.type) {
      case 'validation':
        return 'The generated code contains validation errors.';
      case 'runtime_error':
        return 'The code failed during runtime with a Manim error.';
      case 'timeout':
        return 'The job took too long and was cancelled.';
      case 'network_error':
        return 'A network error prevented the operation from completing.';
      case 'api_error':
        return 'The service encountered a configuration error.';
      default:
        return 'An unexpected error occurred.';
    }
  };

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
          {getErrorTypeLabel()}
        </h2>

        <div className="mb-4 inline-block px-3 py-1 bg-gray-100 rounded-full">
          <p className="text-sm font-medium text-gray-700">
            Attempt {attemptNumber} of {maxAttempts}
          </p>
        </div>

        <p className="text-sm text-gray-500 mb-2">
          {getErrorTypeDescription()}
        </p>

        <p className="text-gray-600 mb-4">{error.message}</p>

        {error.stage && (
          <p className="text-sm text-gray-500 mb-4">
            Failed during: <span className="font-medium capitalize">
              {error.stage.replace(/_/g, ' ')}
            </span>
          </p>
        )}

        {isLastAttempt && (
          <p className="text-sm text-orange-600 mb-4">
            This is your last attempt with the current prompt.
          </p>
        )}

        {autoFixAttemptCount >= 2 && isAutoFixableError && (
          <p className="text-sm text-orange-600 mb-4">
            Auto-fix attempts exhausted. Please modify your prompt and try again.
          </p>
        )}

        {!isAutoFixableError && onAutoFix && (
          <p className="text-sm text-gray-600 mb-4">
            Auto-fix is not available for this error type. Please modify your prompt and try again.
          </p>
        )}

        {error.type === 'timeout' && (
          <p className="text-sm text-blue-600 mb-4">
            Consider simplifying your animation or reducing the duration.
          </p>
        )}

        {error.type === 'network_error' && (
          <p className="text-sm text-blue-600 mb-4">
            Please check your internet connection and try again.
          </p>
        )}

        {error.type === 'api_error' && (
          <p className="text-sm text-blue-600 mb-4">
            The service is experiencing issues. Please try again in a few moments.
          </p>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          {canAutoFix && (
            <button
              onClick={onAutoFix}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Fix Errors (Auto-fix {autoFixAttemptCount + 1} of 2)
            </button>
          )}

          {canRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again ({attemptsRemaining} remaining)
            </button>
          )}
        </div>

        {!canRetry && attemptNumber >= maxAttempts && (
          <p className="text-sm text-red-600">
            No more attempts available. Please modify your prompt and start fresh.
          </p>
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

'use client';

import { useState } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  prompt: string;
}

export default function VideoPlayer({ videoUrl, prompt }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoadedData = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `manim-animation-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Animation Preview
      </h2>

      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
              <p className="text-white">Loading video...</p>
            </div>
          </div>
        )}

        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-900 to-red-800 z-10">
            <div className="text-center text-white">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-lg font-medium">Failed to load video</p>
              <p className="text-sm mt-2 text-red-200">
                The video file may be missing or corrupted
              </p>
            </div>
          </div>
        ) : (
          <video
            controls
            className="w-full h-full bg-gray-900"
            onLoadedData={handleLoadedData}
            onError={handleError}
            preload="metadata"
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleDownload}
          disabled={hasError}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          Download Animation
        </button>
        <p className="text-sm text-gray-500">
          {prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt}
        </p>
      </div>
    </div>
  );
}

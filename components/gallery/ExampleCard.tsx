'use client';

import { GalleryExample } from '@/types';

interface ExampleCardProps {
  example: GalleryExample;
  onClick: (example: GalleryExample) => void;
  isLoading: boolean;
}

export default function ExampleCard({
  example,
  onClick,
  isLoading,
}: ExampleCardProps) {
  return (
    <button
      onClick={() => onClick(example)}
      disabled={isLoading}
      className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-left w-full"
    >
      <h3 className="text-xl font-semibold text-gray-900 mb-3">
        {example.title}
      </h3>

      <div className="flex items-center justify-between">
        <span className="text-sm text-blue-600 font-medium">
          {example.stylePreset}
        </span>

        {isLoading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
        ) : (
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </div>
    </button>
  );
}

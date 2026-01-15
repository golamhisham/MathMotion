'use client';

import { useEffect, useState } from 'react';
import { GalleryExample } from '@/types';
import { galleryCache } from '@/lib/services/galleryCache';

interface ExampleCardProps {
  example: GalleryExample;
  onClick: (example: GalleryExample) => void;
  isLoading: boolean;
  isCached?: boolean;
}

export default function ExampleCard({
  example,
  onClick,
  isLoading,
  isCached = false,
}: ExampleCardProps) {
  const [cached, setCached] = useState(isCached);

  useEffect(() => {
    // Check cache status on mount (client-side only)
    const hasCached = galleryCache.isCached(example.id);
    setCached(hasCached);
  }, [example.id]);

  return (
    <button
      onClick={() => onClick(example)}
      disabled={isLoading}
      className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-left w-full relative"
    >
      {/* Cache indicator badge */}
      {cached && (
        <div className="absolute top-3 right-3 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <svg
            className="w-3 h-3"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Cached
        </div>
      )}

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
            className={`w-5 h-5 ${cached ? 'text-green-500' : 'text-gray-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={cached ? 'M13 10V3L4 14h7v7l9-11h-7z' : 'M9 5l7 7-7 7'}
            />
          </svg>
        )}
      </div>
    </button>
  );
}

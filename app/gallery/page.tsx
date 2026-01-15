'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GALLERY_EXAMPLES } from '@/lib/constants';
import { GalleryExample } from '@/types';
import ExampleCard from '@/components/gallery/ExampleCard';
import { galleryCache } from '@/lib/services/galleryCache';

export default function GalleryPage() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExampleClick = async (example: GalleryExample) => {
    // Clear any previous errors
    setError(null);

    // Set loading state for this specific card
    setLoadingId(example.id);

    try {
      // Check if we have a cached result for this example
      const cachedJob = galleryCache.getCachedJob(example.id);
      if (cachedJob) {
        // Use cached job - instant navigation
        console.log(`[Gallery] Using cached result for ${example.id}`);
        router.push(`/result/${cachedJob.id}`);
        return;
      }

      // No cache - submit new job
      console.log(`[Gallery] Submitting new job for ${example.id}`);
      const response = await fetch('/api/jobs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: example.prompt,
          stylePreset: example.stylePreset,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit job');
      }

      const { job } = await response.json();

      // Cache the new job result
      galleryCache.setCachedJob(example.id, example.prompt, example.stylePreset, job);

      // Navigate to result page
      router.push(`/result/${job.id}`);
    } catch (err) {
      console.error('Gallery submission error:', err);
      setError('Failed to generate animation. Please try again.');
      setLoadingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto py-8">
        {/* Header with Back Link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Home
          </Link>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            Example Gallery
          </h1>
          <p className="text-lg text-gray-600">
            Explore curated mathematical animations. Click any example to generate.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {GALLERY_EXAMPLES.map((example) => (
            <ExampleCard
              key={example.id}
              example={example}
              onClick={handleExampleClick}
              isLoading={loadingId === example.id}
            />
          ))}
        </div>

        {/* Footer Info */}
        <div className="text-center mt-12 text-sm text-gray-600">
          Click any card to instantly generate that animation
        </div>
      </div>
    </main>
  );
}

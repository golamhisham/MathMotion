'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useJobPolling } from '@/lib/hooks/useJobPolling';
import JobStatusBadge from '@/components/result/JobStatusBadge';
import LoadingProgress from '@/components/result/LoadingProgress';
import VideoPlayer from '@/components/result/VideoPlayer';
import CodeDisplay from '@/components/result/CodeDisplay';
import ErrorDisplay from '@/components/result/ErrorDisplay';
import { galleryCache } from '@/lib/services/galleryCache';

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default function ResultPage({ params }: PageProps) {
  const { jobId } = use(params);
  const { job, loading, error } = useJobPolling(jobId);
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerateGalleryExample = async () => {
    if (!job) return;

    setRegenerating(true);
    try {
      // Find which gallery example this job matches
      const { GALLERY_EXAMPLES } = await import('@/lib/constants');
      const matchingExample = GALLERY_EXAMPLES.find(
        (ex) => ex.prompt === job.prompt && ex.stylePreset === job.stylePreset
      );

      if (matchingExample) {
        // Clear cache for this example
        galleryCache.clearCacheForExample(matchingExample.id);
        console.log(`[Result] Cleared cache for gallery example: ${matchingExample.id}`);
      }

      // Create a new job with fresh generation
      const response = await fetch('/api/jobs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: job.prompt,
          stylePreset: job.stylePreset,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/result/${data.job.id}`);
      } else {
        console.error('Regeneration failed:', response.statusText);
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const handleRetry = async () => {
    if (!job) return;

    try {
      const response = await fetch('/api/jobs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: job.prompt,
          stylePreset: job.stylePreset,
          parentJobId: job.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/result/${data.job.id}`);
      } else {
        console.error('Retry failed:', response.statusText);
      }
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleAutoFix = async () => {
    if (!job) return;

    try {
      const response = await fetch('/api/jobs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoFixJobId: job.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/result/${data.job.id}`);
      } else {
        console.error('Auto-fix failed:', response.statusText);
      }
    } catch (error) {
      console.error('Auto-fix failed:', error);
    }
  };

  // Initial loading state
  if (loading && !job) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading job status...</p>
          </div>
        </div>
      </main>
    );
  }

  // Error fetching job
  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              Error Loading Job
            </h2>
            <p className="text-red-700">{error}</p>
            <Link
              href="/"
              className="inline-block mt-4 text-blue-600 hover:text-blue-800"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto pt-8 pb-12">
        {/* Header */}
        <div className="mb-6">
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

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Animation Result
              </h1>
              <p className="text-gray-600 italic">
                &ldquo;{job.prompt}&rdquo;
              </p>
            </div>
            <JobStatusBadge status={job.status} />
          </div>
        </div>

        {/* Content based on status */}
        <div className="space-y-6">
          {/* Loading/Processing State */}
          {(job.status === 'queued' ||
            job.status === 'generating_code' ||
            job.status === 'rendering') && (
              <LoadingProgress
                status={job.status}
                progress={job.progress}
                message={job.progressMessage}
              />
            )}

          {/* Success State */}
          {job.status === 'done' && job.output && (
            <>
              <VideoPlayer
                videoUrl={job.output.videoUrl}
                prompt={job.prompt}
              />
              <CodeDisplay
                code={job.output.code}
                explanation={job.output.explanation}
              />

              {/* Regenerate Button for Gallery Examples */}
              <div className="text-center mt-6">
                <button
                  onClick={handleRegenerateGalleryExample}
                  disabled={regenerating}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Regenerate
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Error State */}
          {job.status === 'failed' && job.error && (
            <>
              <ErrorDisplay
                error={job.error}
                onRetry={handleRetry}
                onAutoFix={handleAutoFix}
                attemptNumber={job.attemptNumber}
                maxAttempts={job.maxAttempts}
                autoFixAttemptCount={job.autoFixAttemptCount}
              />

              {/* Link to previous attempt */}
              {job.parentJobId && (
                <div className="mt-6 text-center">
                  <Link
                    href={`/result/${job.parentJobId}`}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View previous attempt
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* Job Metadata */}
        <div className="mt-8 p-4 bg-white rounded-lg shadow-md">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-600">Job ID</dt>
              <dd className="font-mono text-gray-900">{job.id}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Style Preset</dt>
              <dd className="text-gray-900">{job.stylePreset}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Created</dt>
              <dd className="text-gray-900">
                {new Date(job.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-gray-600">Last Updated</dt>
              <dd className="text-gray-900">
                {new Date(job.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}

'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useJobPolling } from '@/lib/hooks/useJobPolling';
import JobStatusBadge from '@/components/result/JobStatusBadge';
import LoadingProgress from '@/components/result/LoadingProgress';
import VideoPlayer from '@/components/result/VideoPlayer';
import CodeDisplay from '@/components/result/CodeDisplay';
import ErrorDisplay from '@/components/result/ErrorDisplay';

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default function ResultPage({ params }: PageProps) {
  const { jobId } = use(params);
  const { job, loading, error } = useJobPolling(jobId);
  const router = useRouter();

  const handleRetry = async () => {
    if (!job) return;

    try {
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
      }
    } catch (error) {
      console.error('Retry failed:', error);
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
            job.status === 'generating' ||
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
            </>
          )}

          {/* Error State */}
          {job.status === 'failed' && job.error && (
            <ErrorDisplay error={job.error} onRetry={handleRetry} />
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

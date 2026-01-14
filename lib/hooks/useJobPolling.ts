'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Job } from '@/types';
import { POLLING_INTERVAL_MS, TERMINAL_JOB_STATES } from '@/lib/constants';

interface UseJobPollingResult {
  job: Job | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useJobPolling(jobId: string): UseJobPollingResult {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchJob = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch job: ${response.statusText}`);
      }

      const data = await response.json();

      if (mountedRef.current) {
        setJob(data.job);
        setError(null);

        // Stop polling if terminal state reached
        if (TERMINAL_JOB_STATES.includes(data.job.status)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [jobId]);

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchJob();

    // Start polling
    intervalRef.current = setInterval(fetchJob, POLLING_INTERVAL_MS);

    // Cleanup
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchJob]);

  return { job, loading, error, refetch: fetchJob };
}

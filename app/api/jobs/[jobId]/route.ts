import { NextRequest, NextResponse } from 'next/server';
import { jobRepository } from '@/lib/jobRepository';
import { timeoutDetector } from '@/lib/services/timeoutDetector';
import { TERMINAL_JOB_STATES } from '@/lib/constants';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = await jobRepository.findJobById(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check for timeout only if job is still processing
    if (!TERMINAL_JOB_STATES.includes(job.status)) {
      const timeoutCheck = timeoutDetector.checkForTimeout(job);

      if (timeoutCheck.isTimedOut) {
        // Mark job as failed with timeout error
        await jobRepository.failJob(
          jobId,
          timeoutCheck.error!.message,
          timeoutCheck.error!.logs,
          timeoutCheck.error!.stage,
          timeoutCheck.error!.type
        );

        // Fetch updated job to return failed state
        const updatedJob = await jobRepository.findJobById(jobId);
        return NextResponse.json({ job: updatedJob });
      }
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

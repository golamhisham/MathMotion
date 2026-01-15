import { Job } from '@/types';
import { JOB_TIMEOUT_MS } from '@/lib/constants';

interface TimeoutCheckResult {
  isTimedOut: boolean;
  error?: {
    message: string;
    logs: string;
    stage: 'code_generation' | 'rendering';
    type: 'timeout';
  };
}

export class TimeoutDetector {
  checkForTimeout(job: Job): TimeoutCheckResult {
    const now = Date.now();

    switch (job.status) {
      case 'queued':
        if (job.queuedAt) {
          const elapsed = now - new Date(job.queuedAt).getTime();
          if (elapsed > JOB_TIMEOUT_MS.queued) {
            return {
              isTimedOut: true,
              error: {
                message: 'Job failed to start processing. The system may be experiencing issues. Please try again.',
                logs: `Timeout detected:\n- Status: queued\n- Started: ${job.queuedAt}\n- Duration: ${Math.floor(elapsed / 1000)}s\n- Threshold: 30s`,
                stage: 'code_generation',
                type: 'timeout',
              },
            };
          }
        }
        break;

      case 'generating_code':
        if (job.codeGenerationStartedAt) {
          const elapsed = now - new Date(job.codeGenerationStartedAt).getTime();
          if (elapsed > JOB_TIMEOUT_MS.generating_code) {
            return {
              isTimedOut: true,
              error: {
                message: 'Code generation took too long and was cancelled. The AI service may be slow or unresponsive. Please try again.',
                logs: `Timeout detected:\n- Status: generating_code\n- Started: ${job.codeGenerationStartedAt}\n- Duration: ${Math.floor(elapsed / 1000)}s\n- Threshold: 180s`,
                stage: 'code_generation',
                type: 'timeout',
              },
            };
          }
        }
        break;

      case 'rendering':
        if (job.renderingStartedAt) {
          const elapsed = now - new Date(job.renderingStartedAt).getTime();
          if (elapsed > JOB_TIMEOUT_MS.rendering) {
            return {
              isTimedOut: true,
              error: {
                message: 'Rendering took too long and was cancelled. Try simplifying your animation or reducing the duration.',
                logs: `Timeout detected:\n- Status: rendering\n- Started: ${job.renderingStartedAt}\n- Duration: ${Math.floor(elapsed / 1000)}s\n- Threshold: 90s`,
                stage: 'rendering',
                type: 'timeout',
              },
            };
          }
        }
        break;
    }

    return { isTimedOut: false };
  }
}

export const timeoutDetector = new TimeoutDetector();

import { NextRequest, NextResponse } from 'next/server';
import { JobStatus, StylePreset } from '@/types';
import { jobRepository } from '@/lib/jobRepository';
import { manimCodeGenerator } from '@/lib/services/manimCodeGenerator';
import { manimRenderer } from '@/lib/services/manimRenderer';
import { autoFixGenerator } from '@/lib/services/autoFixGenerator';
import { rateLimiter, getClientIP } from '@/lib/services/rateLimiter';
import { promptCache } from '@/lib/services/promptCache';

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request);
    const limitCheck = rateLimiter.checkLimit(clientIP, 'jobSubmission');

    // Return rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', '10');
    headers.set('X-RateLimit-Remaining', limitCheck.remaining.toString());
    headers.set('X-RateLimit-Reset', limitCheck.resetTime.toString());

    if (!limitCheck.allowed) {
      const retryAfter = limitCheck.retryAfter || 60;
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers),
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { prompt, stylePreset, parentJobId, autoFixJobId } = body;

    // Validate input for regular/retry jobs
    if (!autoFixJobId && (!prompt || !stylePreset)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check prompt cache for regular (non-auto-fix, non-retry) jobs
    if (!autoFixJobId && !parentJobId && prompt && stylePreset) {
      const cachedJob = promptCache.getCachedJob(prompt, stylePreset);
      if (cachedJob && cachedJob.status === 'done' && cachedJob.output) {
        // Return cache hit immediately with metadata
        console.log(
          `[PromptCache] Cache hit for prompt (${prompt.length} chars) with style ${stylePreset}`
        );

        // Create a new cache hit job record pointing to original
        const now = new Date().toISOString();
        const cacheHitJob = await jobRepository.createJob({
          status: 'done',
          prompt: cachedJob.prompt,
          stylePreset: cachedJob.stylePreset,
          createdAt: now,
          updatedAt: now,
          attemptNumber: 1,
          maxAttempts: 3,
          autoFixAttemptCount: 0,
          output: cachedJob.output,
          isCacheHit: true,
          cachedFromJobId: cachedJob.id,
          progress: 100,
        } as any);

        return NextResponse.json({ job: cacheHitJob }, {
          status: 201,
          headers: Object.fromEntries(headers),
        });
      }
    }

    // Handle auto-fix job creation
    if (autoFixJobId) {
      const originalJob = await jobRepository.findJobById(autoFixJobId);
      if (!originalJob) {
        return NextResponse.json(
          { error: 'Original job not found' },
          { status: 404 }
        );
      }

      // Check if auto-fix can be attempted
      if (originalJob.autoFixAttemptCount >= 2) {
        return NextResponse.json(
          { error: 'Auto-fix attempts exhausted' },
          { status: 400 }
        );
      }

      if (!originalJob.error || !originalJob.output?.code) {
        return NextResponse.json(
          { error: 'Cannot auto-fix: missing error or code information' },
          { status: 400 }
        );
      }

      // Create auto-fix job
      const now = new Date().toISOString();
      const job = await jobRepository.createJob({
        status: 'queued',
        prompt: originalJob.prompt,
        stylePreset: originalJob.stylePreset,
        createdAt: now,
        updatedAt: now,
        queuedAt: now,
        attemptNumber: originalJob.attemptNumber,
        parentJobId: originalJob.parentJobId,
        maxAttempts: originalJob.maxAttempts,
        autoFixAttemptCount: originalJob.autoFixAttemptCount + 1,
        isAutoFixJob: true,
        originalFailedJobId: autoFixJobId,
        lastFailedCode: originalJob.output.code,
        lastErrorLogs: originalJob.error.logs,
        progress: 0,
      } as any);

      // Start async auto-fix processing
      processAutoFixJob(
        job.id,
        originalJob.output.code,
        originalJob.error.logs || 'No error logs available',
        originalJob.prompt,
        originalJob.stylePreset
      ).catch((error: any) => {
        console.error('Fatal error in processAutoFixJob:', error);
      });

      return NextResponse.json({ job }, {
        status: 201,
        headers: Object.fromEntries(headers),
      });
    }

    // Handle regular/retry job creation
    let attemptNumber = 1;
    let parentJob = null;

    if (parentJobId) {
      parentJob = await jobRepository.findJobById(parentJobId);
      if (!parentJob) {
        return NextResponse.json(
          { error: 'Parent job not found' },
          { status: 404 }
        );
      }
      if (!jobRepository.canRetry(parentJob)) {
        return NextResponse.json(
          { error: 'No more retry attempts available' },
          { status: 400 }
        );
      }
      attemptNumber = parentJob.attemptNumber + 1;
    }

    // Create new job in database
    const now = new Date().toISOString();
    const job = await jobRepository.createJob({
      status: 'queued',
      prompt,
      stylePreset,
      createdAt: now,
      updatedAt: now,
      queuedAt: now,
      attemptNumber,
      parentJobId: parentJobId || undefined,
      maxAttempts: 3,
      autoFixAttemptCount: 0,
      progress: 0,
    } as any);

    // Start async processing (don't await)
    processJob(job.id, prompt, stylePreset, parentJobId).catch((error) => {
      console.error('Fatal error in processJob:', error);
    });

    return NextResponse.json({ job }, {
      status: 201,
      headers: Object.fromEntries(headers),
    });
  } catch (error) {
    console.error('Error submitting job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Real job processing with LLM code generation
async function processJob(
  jobId: string,
  prompt: string,
  stylePreset: StylePreset,
  parentJobId?: string
) {
  try {
    // Phase 1: Transition to 'generating_code'
    await updateJobStatus(
      jobId,
      'generating_code',
      25,
      'Analyzing prompt and generating Manim code...'
    );

    // Phase 2: Generate code using LLM
    console.log(`[ProcessJob] Generating code for job ${jobId}`);
    const generationResult = await manimCodeGenerator.generateCode({
      prompt,
      stylePreset,
    });

    // Handle generation failure
    if (!generationResult.success) {
      const errorDetails = generationResult.error!;

      let errorMessage = errorDetails.message;
      let errorLogs = errorDetails.details || '';

      // Add user-friendly messages based on error type
      if (errorDetails.type === 'rate_limit') {
        errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
      } else if (errorDetails.type === 'api_error') {
        errorMessage = 'Service configuration error. Please contact support.';
        console.error('OpenRouter API error:', errorDetails.details);
      } else if (errorDetails.type === 'network') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (errorDetails.type === 'validation') {
        // Check if it's security-related validation
        const isSecurity =
          errorDetails.details?.includes('Forbidden') ||
          errorDetails.details?.includes('unsafe') ||
          errorDetails.details?.includes('not allowed');

        if (isSecurity) {
          errorMessage =
            'Code contains unauthorized operations. The generated code was blocked for security reasons.';
        } else {
          errorMessage =
            'Generated code failed validation. Please try rephrasing your prompt.';
        }
      }

      console.log(`[ProcessJob] Code generation failed for job ${jobId}: ${errorDetails.type}`);
      await failJob(jobId, errorMessage, errorLogs, 'code_generation', errorDetails.type as any);
      return;
    }

    // Phase 3: Update job with generated code and explanation
    console.log(
      `[ProcessJob] Successfully generated ${generationResult.code!.length} chars of code for job ${jobId}`
    );
    await jobRepository.updateJobWithCode(jobId, generationResult.code!, generationResult.explanation);

    // Phase 4: Transition to 'rendering'
    await updateJobStatus(
      jobId,
      'rendering',
      50,
      'Rendering 3D scene in sandbox...'
    );

    // Phase 5: Render code using Docker + Manim
    console.log(`[ProcessJob] Starting Docker rendering for job ${jobId}`);

    // Fetch current job to get generated code
    const currentJob = await jobRepository.findJobById(jobId);
    if (!currentJob || !currentJob.output?.code) {
      console.error(`[ProcessJob] No code found for job ${jobId}`);
      await failJob(
        jobId,
        'Rendering failed: no code found',
        'Job code missing or not persisted',
        'rendering',
        'unknown'
      );
      return;
    }

    // Execute Manim rendering
    const renderResult = await manimRenderer.renderCode({
      jobId,
      code: currentJob.output.code,
    });

    // Handle rendering result
    if (renderResult.success) {
      console.log(`[ProcessJob] Rendering successful for job ${jobId}`);
      console.log(`[ProcessJob] Video URL: ${renderResult.videoUrl}`);

      // Update job with video URL
      const completedJob = await jobRepository.completeJobWithVideo(jobId, renderResult.videoUrl!);

      // Cache the completed job result (for non-retry, non-auto-fix jobs)
      if (completedJob && !parentJobId) {
        promptCache.setCachedJob(prompt, stylePreset, completedJob);
      }
    } else {
      const errorDetails = renderResult.error!;
      let errorMessage = 'Rendering failed. Please try again.';
      let errorType: 'validation' | 'runtime_error' | 'timeout' | 'network_error' | 'api_error' | 'unknown' = 'unknown';

      // User-friendly error messages based on error type
      if (errorDetails.type === 'timeout') {
        errorMessage = 'Rendering took too long and was cancelled. Try simplifying your animation.';
        errorType = 'timeout';
      } else if (errorDetails.type === 'runtime_error') {
        errorMessage = 'Manim encountered an error while rendering. Check your code syntax.';
        errorType = 'runtime_error';
      } else if (errorDetails.type === 'docker_error') {
        errorMessage = 'Rendering system error. Please try again.';
        errorType = 'unknown';
      } else if (errorDetails.type === 'file_error') {
        errorMessage = 'Failed to save video file. Please try again.';
        errorType = 'unknown';
      }

      console.log(`[ProcessJob] Rendering failed for job ${jobId}: ${errorDetails.type}`);
      await failJob(
        jobId,
        errorMessage,
        renderResult.logs || errorDetails.details,
        'rendering',
        errorType
      );
    }
  } catch (error) {
    console.error(`[ProcessJob] Unexpected error in processJob for ${jobId}:`, error);
    await failJob(
      jobId,
      'An unexpected error occurred. Please try again.',
      error instanceof Error ? error.message : 'Unknown error',
      'code_generation',
      'unknown'
    );
  }
}

function updateJobStatus(
  jobId: string,
  status: JobStatus,
  progress: number,
  message?: string
) {
  return jobRepository
    .updateJobStatus(jobId, status, progress, message)
    .catch((error) => {
      console.error('Error updating job status:', error);
      throw error;
    });
}

function failJob(
  jobId: string,
  errorMessage?: string,
  errorLogs?: string,
  errorStage?: 'code_generation' | 'rendering' | 'validation',
  errorType?: 'validation' | 'runtime_error' | 'timeout' | 'network_error' | 'api_error' | 'unknown'
) {
  return jobRepository
    .failJob(jobId, errorMessage, errorLogs, errorStage, errorType)
    .catch((error: any) => {
      console.error('Error failing job:', error);
      throw error;
    });
}

// Auto-fix job processing
async function processAutoFixJob(
  jobId: string,
  failedCode: string,
  errorLogs: string,
  originalPrompt: string,
  originalStylePreset: StylePreset
) {
  try {
    // Phase 1: Attempt to fix the code
    await updateJobStatus(
      jobId,
      'generating_code',
      25,
      'Attempting to fix the code using error logs...'
    );

    console.log(`[ProcessAutoFixJob] Generating fixed code for job ${jobId}`);
    const fixResult = await autoFixGenerator.generateFixedCode({
      previousCode: failedCode,
      errorLogs,
    });

    // Handle fix failure
    if (!fixResult.success) {
      const errorDetails = fixResult.error!;
      let errorMessage = 'Auto-fix failed. Code could not be automatically repaired.';
      let errorType: 'validation' | 'runtime_error' | 'timeout' | 'network_error' | 'api_error' | 'unknown' = 'unknown';

      if (errorDetails.type === 'validation') {
        errorMessage =
          'Generated code failed validation. Try using regular retry and modifying your prompt.';
        errorType = 'validation';
      } else if (errorDetails.type === 'rate_limit') {
        errorType = 'api_error';
      } else if (errorDetails.type === 'network') {
        errorType = 'network_error';
      }

      console.log(
        `[ProcessAutoFixJob] Auto-fix generation failed for job ${jobId}: ${errorDetails.type}`
      );
      await failJob(jobId, errorMessage, errorDetails.details, 'code_generation', errorType);
      return;
    }

    // Phase 2: Update job with fixed code and explanation
    console.log(
      `[ProcessAutoFixJob] Successfully generated fixed code for job ${jobId}`
    );
    await jobRepository.updateJobWithCode(jobId, fixResult.code!, fixResult.explanation);

    // Phase 3: Transition to rendering
    await updateJobStatus(
      jobId,
      'rendering',
      50,
      'Rendering fixed 3D scene in sandbox...'
    );

    // Phase 4: Render the fixed code
    console.log(`[ProcessAutoFixJob] Starting Docker rendering for job ${jobId}`);

    const currentJob = await jobRepository.findJobById(jobId);
    if (!currentJob || !currentJob.output?.code) {
      console.error(`[ProcessAutoFixJob] No code found for job ${jobId}`);
      await failJob(
        jobId,
        'Rendering failed: no code found',
        'Job code missing or not persisted',
        'rendering',
        'unknown'
      );
      return;
    }

    // Execute Manim rendering
    const renderResult = await manimRenderer.renderCode({
      jobId,
      code: currentJob.output.code,
    });

    // Handle rendering result
    if (renderResult.success) {
      console.log(`[ProcessAutoFixJob] Rendering successful for job ${jobId}`);
      console.log(`[ProcessAutoFixJob] Video URL: ${renderResult.videoUrl}`);

      // Update job with video URL
      const completedJob = await jobRepository.completeJobWithVideo(jobId, renderResult.videoUrl!);

      // Cache the completed job result
      if (completedJob) {
        promptCache.setCachedJob(originalPrompt, originalStylePreset, completedJob);
      }
    } else {
      const errorDetails = renderResult.error!;
      let errorMessage = 'Rendering failed. Try regular retry and modify your prompt.';
      let errorType: 'validation' | 'runtime_error' | 'timeout' | 'network_error' | 'api_error' | 'unknown' = 'unknown';

      if (errorDetails.type === 'timeout') {
        errorMessage =
          'Rendering took too long. Try simplifying your animation or modifying your prompt.';
        errorType = 'timeout';
      } else if (errorDetails.type === 'runtime_error') {
        errorMessage = 'Manim encountered an error. Try regular retry with a different approach.';
        errorType = 'runtime_error';
      }

      console.log(`[ProcessAutoFixJob] Rendering failed for job ${jobId}: ${errorDetails.type}`);
      await failJob(
        jobId,
        errorMessage,
        renderResult.logs || errorDetails.details,
        'rendering',
        errorType
      );
    }
  } catch (error) {
    console.error(`[ProcessAutoFixJob] Unexpected error for ${jobId}:`, error);
    await failJob(
      jobId,
      'An unexpected error occurred during auto-fix. Please try regular retry.',
      error instanceof Error ? error.message : 'Unknown error',
      'code_generation',
      'unknown'
    );
  }
}


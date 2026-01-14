import { NextRequest, NextResponse } from 'next/server';
import { JobStatus, StylePreset } from '@/types';
import { jobRepository } from '@/lib/jobRepository';
import { manimCodeGenerator } from '@/lib/services/manimCodeGenerator';
import { manimRenderer } from '@/lib/services/manimRenderer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, stylePreset } = body;

    // Validate input
    if (!prompt || !stylePreset) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create new job in database
    const job = await jobRepository.createJob({
      status: 'queued',
      prompt,
      stylePreset,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0,
    } as any);

    // Start async processing (don't await)
    processJob(job.id, prompt, stylePreset).catch((error) => {
      console.error('Fatal error in processJob:', error);
    });

    return NextResponse.json({ job }, { status: 201 });
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
  stylePreset: StylePreset
) {
  try {
    // Phase 1: Transition to 'generating'
    await updateJobStatus(
      jobId,
      'generating',
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
      await failJob(jobId, errorMessage, errorLogs, 'code_generation');
      return;
    }

    // Phase 3: Update job with generated code
    console.log(
      `[ProcessJob] Successfully generated ${generationResult.code!.length} chars of code for job ${jobId}`
    );
    await jobRepository.updateJobWithCode(jobId, generationResult.code!);

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
        'rendering'
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
      await jobRepository.completeJobWithVideo(jobId, renderResult.videoUrl!);
    } else {
      const errorDetails = renderResult.error!;
      let errorMessage = 'Rendering failed. Please try again.';

      // User-friendly error messages based on error type
      if (errorDetails.type === 'timeout') {
        errorMessage = 'Rendering took too long and was cancelled. Try simplifying your animation.';
      } else if (errorDetails.type === 'runtime_error') {
        errorMessage = 'Manim encountered an error while rendering. Check your code syntax.';
      } else if (errorDetails.type === 'docker_error') {
        errorMessage = 'Rendering system error. Please try again.';
      } else if (errorDetails.type === 'file_error') {
        errorMessage = 'Failed to save video file. Please try again.';
      }

      console.log(`[ProcessJob] Rendering failed for job ${jobId}: ${errorDetails.type}`);
      await failJob(
        jobId,
        errorMessage,
        renderResult.logs || errorDetails.details,
        'rendering'
      );
    }
  } catch (error) {
    console.error(`[ProcessJob] Unexpected error in processJob for ${jobId}:`, error);
    await failJob(
      jobId,
      'An unexpected error occurred. Please try again.',
      error instanceof Error ? error.message : 'Unknown error',
      'code_generation'
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
  errorStage?: 'code_generation' | 'rendering' | 'validation'
) {
  return jobRepository
    .failJob(jobId, errorMessage, errorLogs, errorStage)
    .catch((error) => {
      console.error('Error failing job:', error);
      throw error;
    });
}


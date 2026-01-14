import { ObjectId } from 'mongodb';
import { getDatabase } from './mongodb';
import { Job, JobStatus } from '@/types';

const COLLECTION_NAME = 'jobs';

export class JobRepository {
  private async getCollection() {
    const db = await getDatabase();
    return db.collection<Job>(COLLECTION_NAME);
  }

  async createJob(jobData: Omit<Job, 'id'>): Promise<Job> {
    try {
      const collection = await this.getCollection();
      const result = await collection.insertOne({
        ...jobData,
      } as any);

      return {
        ...jobData,
        id: result.insertedId.toString(),
      };
    } catch (error) {
      console.error('Error creating job:', error);
      throw error;
    }
  }

  async findJobById(jobId: string): Promise<Job | null> {
    try {
      const collection = await this.getCollection();

      // Validate ObjectId format
      if (!ObjectId.isValid(jobId)) {
        return null;
      }

      const job = await collection.findOne({
        _id: new ObjectId(jobId),
      });

      if (!job) {
        return null;
      }

      // Convert MongoDB document to Job type
      return this.documentToJob(job);
    } catch (error) {
      console.error('Error finding job:', error);
      throw error;
    }
  }

  private isValidTransition(
    currentStatus: JobStatus,
    newStatus: JobStatus
  ): boolean {
    const validTransitions: Record<JobStatus, JobStatus[]> = {
      queued: ['generating', 'failed'],
      generating: ['rendering', 'failed'],
      rendering: ['done', 'failed'],
      done: [],
      failed: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress?: number,
    progressMessage?: string
  ): Promise<Job | null> {
    try {
      const collection = await this.getCollection();

      if (!ObjectId.isValid(jobId)) {
        return null;
      }

      // Fetch current job to validate transition
      const currentJob = await this.findJobById(jobId);
      if (!currentJob) {
        return null;
      }

      // Validate status transition
      if (!this.isValidTransition(currentJob.status, status)) {
        console.error(
          `Invalid status transition: ${currentJob.status} → ${status}`
        );
        throw new Error(
          `Invalid status transition from ${currentJob.status} to ${status}`
        );
      }

      const updateData: any = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (progress !== undefined) {
        updateData.progress = progress;
      }

      if (progressMessage !== undefined) {
        updateData.progressMessage = progressMessage;
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(jobId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        return null;
      }

      return this.documentToJob(result);
    } catch (error) {
      console.error('Error updating job status:', error);
      throw error;
    }
  }

  async updateJobWithCode(jobId: string, code: string): Promise<Job | null> {
    try {
      const collection = await this.getCollection();

      if (!ObjectId.isValid(jobId)) {
        return null;
      }

      // Fetch current job to ensure it's in 'generating' status
      const currentJob = await this.findJobById(jobId);
      if (!currentJob || currentJob.status !== 'generating') {
        console.error(
          `Cannot update code for job ${jobId} with status ${currentJob?.status}`
        );
        return null;
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(jobId) },
        {
          $set: {
            'output.code': code,
            updatedAt: new Date().toISOString(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        return null;
      }

      return this.documentToJob(result);
    } catch (error) {
      console.error('Error updating job with code:', error);
      throw error;
    }
  }

  async completeJobWithVideo(jobId: string, videoUrl: string): Promise<Job | null> {
    try {
      const collection = await this.getCollection();

      if (!ObjectId.isValid(jobId)) {
        return null;
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(jobId) },
        {
          $set: {
            status: 'done' as JobStatus,
            updatedAt: new Date().toISOString(),
            'output.videoUrl': videoUrl,
            progress: 100,
          },
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        return null;
      }

      return this.documentToJob(result);
    } catch (error) {
      console.error('Error completing job with video:', error);
      throw error;
    }
  }

  async completeJob(jobId: string): Promise<Job | null> {
    // Default to mock URL if called without video URL (backwards compatibility)
    return this.completeJobWithVideo(
      jobId,
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    );
  }

  async failJob(
    jobId: string,
    errorMessage?: string,
    errorLogs?: string,
    errorStage?: 'code_generation' | 'rendering' | 'validation'
  ): Promise<Job | null> {
    try {
      const collection = await this.getCollection();

      if (!ObjectId.isValid(jobId)) {
        return null;
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(jobId) },
        {
          $set: {
            status: 'failed' as JobStatus,
            updatedAt: new Date().toISOString(),
            error: {
              message:
                errorMessage ||
                'Animation generation failed. Please check your prompt and try again.',
              logs:
                errorLogs ||
                'Manim encountered an error during rendering. This could be due to invalid mathematical syntax or unsupported operations.',
              stage: errorStage || 'rendering',
              timestamp: new Date().toISOString(),
            },
            progress: 0,
          },
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        return null;
      }

      return this.documentToJob(result);
    } catch (error) {
      console.error('Error failing job:', error);
      throw error;
    }
  }

  private documentToJob(doc: any): Job {
    return {
      id: doc._id.toString(),
      status: doc.status,
      prompt: doc.prompt,
      stylePreset: doc.stylePreset,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      output: doc.output,
      error: doc.error,
      progress: doc.progress,
      progressMessage: doc.progressMessage,
    };
  }
}

// Export singleton instance
export const jobRepository = new JobRepository();

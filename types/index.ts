export type StylePreset = '3Blue1Brown' | 'Classic' | 'Minimalist' | 'Dark';

export interface GenerationFormData {
  prompt: string;
  stylePreset: StylePreset;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Job-related types
export type JobStatus = 'queued' | 'generating' | 'rendering' | 'done' | 'failed';

export interface JobOutput {
  videoUrl: string;
  code: string;
  explanation?: string;
}

export interface JobError {
  message: string;
  logs?: string;
  stage?: 'code_generation' | 'rendering' | 'validation';
  timestamp?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  prompt: string;
  stylePreset: StylePreset;
  createdAt: string;
  updatedAt: string;
  output?: JobOutput;
  error?: JobError;
  progress?: number;
  progressMessage?: string;
}

export interface JobApiResponse {
  job: Job;
}

// Gallery-related types
export interface GalleryExample {
  id: string;
  title: string;
  prompt: string;
  stylePreset: StylePreset;
}

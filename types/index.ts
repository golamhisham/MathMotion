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
export type JobStatus = 'queued' | 'generating_code' | 'rendering' | 'done' | 'failed';

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
  type?: 'validation' | 'runtime_error' | 'timeout' | 'network_error' | 'api_error' | 'unknown';
}

export interface Job {
  id: string;
  status: JobStatus;
  prompt: string;
  stylePreset: StylePreset;
  createdAt: string;
  updatedAt: string;
  queuedAt?: string;
  codeGenerationStartedAt?: string;
  renderingStartedAt?: string;
  attemptNumber: number;
  parentJobId?: string;
  maxAttempts: number;
  autoFixAttemptCount: number;
  isAutoFixJob?: boolean;
  originalFailedJobId?: string;
  lastFailedCode?: string;
  lastErrorLogs?: string;
  output?: JobOutput;
  error?: JobError;
  progress?: number;
  progressMessage?: string;
  isCacheHit?: boolean;
  cachedFromJobId?: string;
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

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ManimRenderConfig {
  dockerImage: string;
  timeoutMs: number;
  memoryLimitMb: number;
  cpuLimit: number;
  tempDir: string;
  publicVideosDir: string;
}

export interface ManimRenderRequest {
  jobId: string;
  code: string;
}

export interface ManimRenderResult {
  success: boolean;
  videoUrl?: string;
  logs?: string;
  error?: {
    type: 'timeout' | 'runtime_error' | 'docker_error' | 'file_error';
    message: string;
    details: string;
  };
}

export class ManimRendererService {
  private config: ManimRenderConfig;

  constructor(config: ManimRenderConfig) {
    this.config = config;
  }

  async renderCode(request: ManimRenderRequest): Promise<ManimRenderResult> {
    const { jobId, code } = request;
    let tempDir: string | null = null;

    try {
      // Step 1: Create temporary directory for this job
      tempDir = this.createTempDirectory(jobId);

      // Step 2: Write code to scene.py file
      this.writeCodeFile(tempDir, code);

      // Step 3: Extract Scene class name from code
      const sceneName = this.extractSceneName(code);
      if (!sceneName) {
        return {
          success: false,
          error: {
            type: 'runtime_error',
            message: 'Could not find Scene class in code',
            details: 'Scene class name extraction failed',
          },
        };
      }

      // Step 4: Execute Docker container with Manim
      const { stdout, stderr } = await this.executeDocker(tempDir, sceneName);

      // Step 5: Find rendered MP4 file
      const videoPath = this.findRenderedVideo(tempDir);
      if (!videoPath) {
        return {
          success: false,
          logs: stdout + '\n' + stderr,
          error: {
            type: 'runtime_error',
            message: 'Video file not found after rendering',
            details: 'Manim execution completed but no MP4 file was produced',
          },
        };
      }

      // Step 6: Copy video to public directory
      const publicVideoUrl = this.copyVideoToPublic(videoPath, jobId);

      // Step 7: Cleanup temp directory
      this.cleanup(tempDir);

      // Success!
      return {
        success: true,
        videoUrl: publicVideoUrl,
        logs: stdout,
      };
    } catch (error) {
      // Cleanup on error
      if (tempDir) {
        this.cleanup(tempDir);
      }

      // Categorize error type
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('timeout')) {
        const timeoutSeconds = this.config.timeoutMs / 1000;
        return {
          success: false,
          error: {
            type: 'timeout',
            message: 'Rendering took too long and was cancelled',
            details: `Execution exceeded ${timeoutSeconds}-second timeout limit`,
          },
        };
      }

      if (errorMessage.includes('docker')) {
        return {
          success: false,
          error: {
            type: 'docker_error',
            message: 'Docker execution failed',
            details: errorMessage,
          },
        };
      }

      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        return {
          success: false,
          error: {
            type: 'file_error',
            message: 'File operation failed',
            details: errorMessage,
          },
        };
      }

      return {
        success: false,
        error: {
          type: 'runtime_error',
          message: 'Rendering failed with an error',
          details: errorMessage,
        },
      };
    }
  }

  private createTempDirectory(jobId: string): string {
    const tempBaseDir = this.config.tempDir;
    const jobTempDir = path.join(tempBaseDir, `mathmotion-${jobId}`);

    if (!fs.existsSync(tempBaseDir)) {
      fs.mkdirSync(tempBaseDir, { recursive: true });
    }

    if (!fs.existsSync(jobTempDir)) {
      fs.mkdirSync(jobTempDir, { recursive: true });
    }

    return jobTempDir;
  }

  private writeCodeFile(tempDir: string, code: string): string {
    const codeFilePath = path.join(tempDir, 'scene.py');
    fs.writeFileSync(codeFilePath, code, 'utf-8');
    return codeFilePath;
  }

  private extractSceneName(code: string): string | null {
    const match = code.match(/class\s+(\w+)\s*\(\s*Scene\s*\)/);
    return match ? match[1] : null;
  }

  private async executeDocker(
    tempDir: string,
    sceneName: string
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // Convert memory limit from MB to Docker format (e.g., 1024 -> 1g)
      const memoryLimitMb = this.config.memoryLimitMb;
      const memoryLimit = memoryLimitMb >= 1024
        ? `${Math.floor(memoryLimitMb / 1024)}g`
        : `${memoryLimitMb}m`;

      const dockerArgs = [
        'run',
        '--rm',
        '-v',
        `${tempDir}:/manim`,
        `--memory=${memoryLimit}`,           // Memory limit: configured via RENDER_MEMORY_LIMIT_MB
        `--cpus=${this.config.cpuLimit}`,    // CPU limit: configured via RENDER_CPU_LIMIT
        '--network=none',                    // Disable network access for security
        this.config.dockerImage,
        'manim',
        '-ql',                               // Low quality: 480p 15fps (MVP standard, fixed constraint)
        '/manim/scene.py',
        sceneName,
      ];

      const process = spawn('docker', dockerArgs);

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Timeout handler: terminates if execution exceeds configured timeout
      // Configured via RENDER_TIMEOUT_MS (default: 60000ms = 60 seconds)
      const timeout = setTimeout(() => {
        process.kill('SIGKILL');
        reject(new Error(`timeout: Docker execution exceeded ${this.config.timeoutMs / 1000} seconds`));
      }, this.config.timeoutMs);

      process.on('close', (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(
              `docker: Process exited with code ${code}\n${stderr}`
            )
          );
        }
      });

      process.on('error', (err) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `docker: Failed to spawn process: ${err.message}`
          )
        );
      });
    });
  }

  private findRenderedVideo(tempDir: string): string | null {
    const mediaDir = path.join(tempDir, 'media', 'videos');

    if (!fs.existsSync(mediaDir)) {
      return null;
    }

    const findMp4 = (dir: string): string | null => {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const found = findMp4(fullPath);
          if (found) return found;
        } else if (file.endsWith('.mp4')) {
          return fullPath;
        }
      }

      return null;
    };

    return findMp4(mediaDir);
  }

  private copyVideoToPublic(sourcePath: string, jobId: string): string {
    const videosDir = path.join(process.cwd(), 'public', 'videos');

    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    const destPath = path.join(videosDir, `${jobId}.mp4`);
    fs.copyFileSync(sourcePath, destPath);

    return `/videos/${jobId}.mp4`;
  }

  private cleanup(tempDir: string): void {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Failed to cleanup temp directory ${tempDir}:`, error);
    }
  }
}

// Export singleton instance
export const manimRenderer = new ManimRendererService({
  dockerImage: process.env.DOCKER_IMAGE || 'manimcommunity/manim:latest',
  timeoutMs: parseInt(process.env.RENDER_TIMEOUT_MS || '60000', 10),
  memoryLimitMb: parseInt(process.env.RENDER_MEMORY_LIMIT_MB || '1024', 10),
  cpuLimit: parseInt(process.env.RENDER_CPU_LIMIT || '2', 10),
  tempDir: process.env.TEMP_DIR || '/tmp/mathmotion',
  publicVideosDir: 'public/videos',
});

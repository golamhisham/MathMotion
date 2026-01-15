export interface AutoFixRequest {
  previousCode: string;
  errorLogs: string;
}

export interface AutoFixResult {
  success: boolean;
  code?: string;
  explanation?: string;
  error?: {
    type: string;
    message: string;
    details: string;
  };
}

export class AutoFixGeneratorService {
  private readonly OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly apiKey: string;
  private readonly model = 'mistralai/devstral-2512:free';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateFixedCode(request: AutoFixRequest): Promise<AutoFixResult> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(request.previousCode, request.errorLogs);

      const response = await fetch(this.OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenRouter API error:', errorData);

        if (response.status === 429) {
          return {
            success: false,
            error: {
              type: 'rate_limit',
              message: 'Rate limit exceeded. Please try again in a few moments.',
              details: 'OpenRouter API rate limit reached',
            },
          };
        }

        return {
          success: false,
          error: {
            type: 'api_error',
            message: 'Service configuration error. Please try again.',
            details: errorData.error?.message || 'Unknown API error',
          },
        };
      }

      const data = await response.json();
      const rawResponse = data.choices[0].message.content.trim();

      // Extract explanation and code if present
      const { explanation, code } = this.extractExplanationAndCode(rawResponse);

      // Validate the fixed code
      const validation = this.validateCode(code);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            type: 'validation',
            message: validation.reason!,
            details: 'Generated code failed validation',
          },
        };
      }

      return { success: true, code, explanation };
    } catch (error) {
      console.error('Error in generateFixedCode:', error);

      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          success: false,
          error: {
            type: 'network',
            message: 'Network error. Please check your connection and try again.',
            details: error.message,
          },
        };
      }

      return {
        success: false,
        error: {
          type: 'unknown',
          message: 'An unexpected error occurred. Please try again.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert Manim developer. You will be given:
1. A Manim Scene class that failed to render
2. The error logs from when it executed

Your task: Fix the code to resolve the error while preserving the original intent.

CRITICAL RULES:
- Output ONLY the corrected Python code
- Do NOT include explanations, comments, or markdown
- Preserve the original Scene class name
- Preserve the overall structure and logic
- Only modify what's necessary to fix the error
- Do NOT use camera.frame, camera.animate, or camera manipulation
- Keep animations simple and within 12 seconds total
- Keep all run_time values <= 5 seconds per animation step

If you cannot fix the error, start your response with:
# CANNOT_FIX: [explanation]

Then provide a minimal version of the code that might work.`;
  }

  private buildUserPrompt(previousCode: string, errorLogs: string): string {
    return `Fix this Manim code to resolve the following error:

ERROR LOGS:
${errorLogs}

ORIGINAL CODE:
${previousCode}

OUTPUT ONLY THE FIXED CODE:`;
  }

  private extractExplanationAndCode(rawResponse: string): { explanation: string; code: string } {
    const trimmed = rawResponse.trim();

    // Find the first occurrence of "from manim import *" or "class"
    const codeStartIndex = Math.min(
      trimmed.indexOf('from manim import *'),
      trimmed.indexOf('class ')
    );

    // Handle markdown fences that might wrap the code
    const markdownMatch = trimmed.match(/```(?:python)?\n?([\s\S]*?)\n?```/);
    if (markdownMatch) {
      const code = markdownMatch[1].trim();
      const beforeCode = trimmed.substring(0, trimmed.indexOf('```')).trim();
      return {
        explanation: beforeCode,
        code,
      };
    }

    if (codeStartIndex === -1 || codeStartIndex === 2147483647) {
      // No code pattern found, treat entire response as code
      return {
        explanation: '',
        code: trimmed,
      };
    }

    // Everything before code start is explanation
    const explanation = trimmed.substring(0, codeStartIndex).trim();
    const code = trimmed.substring(codeStartIndex).trim();

    return { explanation, code };
  }

  private validateCode(code: string): { isValid: boolean; reason?: string } {
    // Check for Scene class definition
    if (!/^\s*class\s+\w+\s*\(\s*Scene\s*\)/m.test(code)) {
      return {
        isValid: false,
        reason: 'Code must contain a Scene class definition',
      };
    }

    // Check for construct method
    if (!/def\s+construct\s*\(\s*self\s*\)/m.test(code)) {
      return {
        isValid: false,
        reason: 'Scene class must have a construct method',
      };
    }

    // Check for forbidden camera manipulations
    const forbiddenPatterns = [
      /\.camera\.frame/,
      /\.camera\.animate/,
      /camera\.add/,
      /self\.camera\s*=/,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(code)) {
        return {
          isValid: false,
          reason: 'Code contains forbidden camera manipulation',
        };
      }
    }

    return { isValid: true };
  }
}

// Export singleton instance
const apiKey = process.env.OPENROUTER_API_KEY || '';
export const autoFixGenerator = new AutoFixGeneratorService(apiKey);

import { StylePreset } from '@/types';

export interface ManimCodeGenerationConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ManimCodeGenerationRequest {
  prompt: string;
  stylePreset: StylePreset;
}

export type ErrorType = 'network' | 'validation' | 'api_error' | 'rate_limit';

export interface ManimCodeGenerationResult {
  success: boolean;
  code?: string;
  explanation?: string;
  error?: {
    type: ErrorType;
    message: string;
    details?: string;
  };
}

export class ManimCodeGeneratorService {
  private config: ManimCodeGenerationConfig;
  private readonly OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(config: ManimCodeGenerationConfig) {
    this.config = config;
  }

  async generateCode(
    request: ManimCodeGenerationRequest
  ): Promise<ManimCodeGenerationResult> {
    try {
      // Build the prompt
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(request.prompt, request.stylePreset);

      // Call OpenRouter API
      const rawResponse = await this.callOpenRouter(systemPrompt, userPrompt);

      // Extract explanation and code from response
      const { explanation, code } = this.extractExplanationAndCode(rawResponse);

      // Validate and clean the code
      const result = this.validateAndCleanCode(code);

      // Include explanation in result if code is valid
      if (result.success && explanation) {
        result.explanation = explanation;
      }

      return result;
    } catch (error) {
      // Handle network or API errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.startsWith('RATE_LIMIT:')) {
        return {
          success: false,
          error: {
            type: 'rate_limit',
            message: 'Rate limit exceeded',
            details: errorMessage.replace('RATE_LIMIT: ', ''),
          },
        };
      }

      if (errorMessage.startsWith('API_ERROR:')) {
        return {
          success: false,
          error: {
            type: 'api_error',
            message: 'OpenRouter API error',
            details: errorMessage.replace('API_ERROR: ', ''),
          },
        };
      }

      // Generic network errors
      return {
        success: false,
        error: {
          type: 'network',
          message: 'Network error while generating code',
          details: errorMessage,
        },
      };
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert Manim animation code generator. Your task is to generate valid Python code AND a brief explanation for Manim animations.

CRITICAL REQUIREMENTS:
1. Respond with EXACTLY TWO sections, separated by a blank line:
   SECTION 1: EXPLANATION (3-6 sentences describing what the animation shows and why)
   SECTION 2: CODE (valid Python code only - NO markdown code fences)
2. The EXPLANATION must be clear, readable, and reference what the animation demonstrates
3. The CODE must:
   - Contain exactly ONE class that inherits from Scene
   - Include "from manim import *" at the beginning
   - Have a construct(self) method that creates the animation
   - Be complete and executable
   - NOT include any text outside the code section

OUTPUT CONSTRAINTS (MANDATORY):
- Animation duration: MAXIMUM 12 seconds total
- Resolution: Fixed at 480p 15fps (do not attempt to change)
- Keep all run_time parameters <= 5 seconds per animation step
- Do not use high-quality rendering flags
- FORBIDDEN API CALLS: Do NOT use camera.frame, camera.animate, camera manipulation, or any camera configuration
- Keep animations simple using only: basic shapes (Circle, Square, Triangle, Rectangle, Line, Dot, Polygon), basic animations (FadeIn, FadeOut, GrowFromCenter, ShrinkToCenter, Rotate, Shift, ScaleInPlace, Write, Unwrite)
- Do NOT attempt to modify camera, resolution, frame_rate, or pixel dimensions

RESPONSE FORMAT EXAMPLE:
---
This animation demonstrates the concept of rotating a square. We create a square shape and animate it rotating 360 degrees around its center. The rotation happens smoothly over 2 seconds, showing how geometric shapes can be transformed in mathematical visualizations.

from manim import *

class RotatingSquare(Scene):
    def construct(self):
        square = Square()
        self.add(square)
        self.play(Rotate(square, angle=2*PI, run_time=2))
        self.wait(1)
---

Now generate the response with explanation followed by code:`;
  }

  private buildUserPrompt(userPrompt: string, stylePreset: StylePreset): string {
    const styleGuidelines: Record<StylePreset, string> = {
      '3Blue1Brown': `
Style Guidelines: Use rich, vibrant colors (BLUE, YELLOW, GREEN, RED). Include smooth transformations with run_time parameters. Add text annotations using Tex or MathTex. Use ReplacementTransform, FadeIn, FadeOut for professional animations. Consider camera movements for emphasis.`,
      'Classic': `
Style Guidelines: Use traditional mathematical colors (BLACK background, WHITE objects). Keep animations clean and straightforward. Use Write, Create, ShowCreation animations. Minimal embellishments - focus on clarity.`,
      'Minimalist': `
Style Guidelines: Use monochromatic or very limited color palette. Keep geometric shapes simple. Use sparse text and annotations. Focus on essential movements only. Clean and modern aesthetic.`,
      'Dark': `
Style Guidelines: Use dark background with neon/bright accents (PINK, CYAN, PURPLE, ORANGE). High contrast colors for visual impact. Modern, tech-inspired aesthetics. Bold and vibrant animations.`,
    };

    return `Create a Manim animation that matches this description:

User Request: ${userPrompt}

${styleGuidelines[stylePreset]}

Remember: Output the explanation first, then a blank line, then the Python code. No markdown or extra text outside these two sections.`;
  }

  private extractExplanationAndCode(rawResponse: string): { explanation: string; code: string } {
    const trimmed = rawResponse.trim();

    // Find the first occurrence of "from manim import *"
    const codeStartIndex = trimmed.indexOf('from manim import *');

    if (codeStartIndex === -1) {
      // No code found, treat entire response as potential code
      return {
        explanation: '',
        code: trimmed,
      };
    }

    // Everything before the code start is the explanation
    const explanation = trimmed.substring(0, codeStartIndex).trim();

    // Everything from the code start onwards is the code
    const code = trimmed.substring(codeStartIndex).trim();

    return { explanation, code };
  }

  private async callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(this.OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mathmotion.app',
        'X-Title': 'MathMotion',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parse errors
      }

      if (response.status === 429) {
        throw new Error('RATE_LIMIT: OpenRouter rate limit exceeded. Please try again later.');
      }
      if (response.status === 401) {
        throw new Error('API_ERROR: Invalid OpenRouter API key. Please check configuration.');
      }

      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`API_ERROR: OpenRouter API error: ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('API_ERROR: Empty response from OpenRouter API');
    }

    return content;
  }

  private validateAndCleanCode(rawCode: string): ManimCodeGenerationResult {
    // Step 1: Strip markdown code fences
    let cleanCode = rawCode.trim();

    // Remove ```python or ``` wrappers
    const markdownRegex = /^```(?:python)?\n?([\s\S]*?)\n?```$/;
    const markdownMatch = cleanCode.match(markdownRegex);
    if (markdownMatch) {
      cleanCode = markdownMatch[1].trim();
    }

    // Step 2: Validate required import
    const hasImport = /from\s+manim\s+import\s+\*/m.test(cleanCode);
    if (!hasImport) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Generated code missing required "from manim import *" import',
          details: 'The LLM did not include the mandatory Manim import statement',
        },
      };
    }

    // Step 3: Validate exactly ONE Scene class
    const sceneClassRegex = /class\s+(\w+)\s*\(\s*Scene\s*\)\s*:/g;
    const matches = [...cleanCode.matchAll(sceneClassRegex)];

    if (matches.length === 0) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'No Scene class found in generated code',
          details: 'The code must contain exactly one class that inherits from Scene',
        },
      };
    }

    if (matches.length > 1) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: `Multiple Scene classes found (${matches.length}). Expected exactly one.`,
          details: `Found classes: ${matches.map(m => m[1]).join(', ')}`,
        },
      };
    }

    // Step 4: Validate construct method
    const hasConstruct = /def\s+construct\s*\(\s*self\s*\)\s*:/m.test(cleanCode);
    if (!hasConstruct) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Scene class missing required construct(self) method',
          details: 'Every Manim Scene must have a construct method',
        },
      };
    }

    // Step 5: Basic syntax check - ensure balanced braces
    const openParens = (cleanCode.match(/\(/g) || []).length;
    const closeParens = (cleanCode.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Syntax error: Unbalanced parentheses in generated code',
          details: `Found ${openParens} opening and ${closeParens} closing parentheses`,
        },
      };
    }

    // Step 6: Validate imports (whitelist + blacklist)
    const importValidation = this.validateImports(cleanCode);
    if (!importValidation.isValid) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Code contains forbidden imports',
          details: importValidation.reason,
        },
      };
    }

    // Step 7: Detect forbidden function calls
    const callValidation = this.validateForbiddenCalls(cleanCode);
    if (!callValidation.isValid) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Code contains forbidden operations',
          details: callValidation.reason,
        },
      };
    }

    // Step 8: Detect dangerous patterns
    const patternValidation = this.validateDangerousPatterns(cleanCode);
    if (!patternValidation.isValid) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Code contains potentially unsafe patterns',
          details: patternValidation.reason,
        },
      };
    }

    // Step 9: Enforce output constraints (duration and resolution)
    const constraintValidation = this.validateOutputConstraints(cleanCode);
    if (!constraintValidation.isValid) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Code violates output constraints',
          details: constraintValidation.reason,
        },
      };
    }

    // All validations passed
    return {
      success: true,
      code: cleanCode,
    };
  }

  private validateImports(code: string): { isValid: boolean; reason?: string } {
    // Whitelist: Only allow manim imports
    const allowedImports = [
      /^from\s+manim\s+import\s+\*/m,
      /^import\s+manim/m,
      /^from\s+manim\.\w+\s+import/m,
    ];

    // Blacklist: Dangerous imports
    const forbiddenImports = [
      { pattern: /import\s+os\b/, message: 'os module (file system access)' },
      { pattern: /from\s+os\s+import/, message: 'os module (file system access)' },
      { pattern: /import\s+sys\b/, message: 'sys module (system access)' },
      { pattern: /from\s+sys\s+import/, message: 'sys module (system access)' },
      { pattern: /import\s+subprocess\b/, message: 'subprocess module (command execution)' },
      { pattern: /from\s+subprocess\s+import/, message: 'subprocess module (command execution)' },
      { pattern: /import\s+socket\b/, message: 'socket module (network access)' },
      { pattern: /from\s+socket\s+import/, message: 'socket module (network access)' },
      { pattern: /import\s+requests\b/, message: 'requests module (network access)' },
      { pattern: /import\s+urllib/, message: 'urllib module (network access)' },
      { pattern: /import\s+pickle\b/, message: 'pickle module (arbitrary code execution)' },
      { pattern: /import\s+marshal\b/, message: 'marshal module (arbitrary code execution)' },
      { pattern: /import\s+ctypes\b/, message: 'ctypes module (low-level system access)' },
      { pattern: /import\s+__builtin/, message: '__builtin module (builtin overrides)' },
      { pattern: /import\s+builtins\b/, message: 'builtins module (builtin overrides)' },
    ];

    // Check for forbidden imports
    for (const forbidden of forbiddenImports) {
      if (forbidden.pattern.test(code)) {
        return {
          isValid: false,
          reason: `Forbidden import detected: ${forbidden.message}. Only Manim imports are allowed.`,
        };
      }
    }

    // Extract all import statements
    const importRegex = /^(?:from\s+[\w.]+\s+)?import\s+[\w.,\s*]+/gm;
    const imports = code.match(importRegex) || [];

    // Check if all imports are allowed
    for (const importStmt of imports) {
      const isAllowed = allowedImports.some(pattern => pattern.test(importStmt));
      if (!isAllowed) {
        // Check if it's a manim import (more lenient matching)
        if (!/manim/i.test(importStmt)) {
          return {
            isValid: false,
            reason: `Unauthorized import detected: "${importStmt}". Only Manim library imports are permitted.`,
          };
        }
      }
    }

    return { isValid: true };
  }

  private validateForbiddenCalls(code: string): { isValid: boolean; reason?: string } {
    const forbiddenCalls = [
      { pattern: /\beval\s*\(/, message: 'eval() - arbitrary code execution' },
      { pattern: /\bexec\s*\(/, message: 'exec() - arbitrary code execution' },
      { pattern: /\bcompile\s*\(/, message: 'compile() - dynamic code compilation' },
      { pattern: /\b__import__\s*\(/, message: '__import__() - dynamic imports' },
      { pattern: /\bopen\s*\(/, message: 'open() - file system access' },
      { pattern: /\bfile\s*\(/, message: 'file() - file system access' },
      { pattern: /\binput\s*\(/, message: 'input() - user input not supported' },
      { pattern: /\braw_input\s*\(/, message: 'raw_input() - user input not supported' },
      { pattern: /\bglobals\s*\(/, message: 'globals() - namespace manipulation' },
      { pattern: /\blocals\s*\(/, message: 'locals() - namespace manipulation' },
      { pattern: /\bvars\s*\(/, message: 'vars() - namespace manipulation' },
      { pattern: /\bdir\s*\(/, message: 'dir() - introspection not needed' },
      { pattern: /\bgetattr\s*\(/, message: 'getattr() - dynamic attribute access' },
      { pattern: /\bsetattr\s*\(/, message: 'setattr() - dynamic attribute modification' },
      { pattern: /\bdelattr\s*\(/, message: 'delattr() - dynamic attribute deletion' },
      { pattern: /\b__dict__\b/, message: '__dict__ - object introspection' },
      { pattern: /\b__class__\b/, message: '__class__ - class manipulation' },
      { pattern: /\b__bases__\b/, message: '__bases__ - inheritance manipulation' },
    ];

    for (const forbidden of forbiddenCalls) {
      if (forbidden.pattern.test(code)) {
        return {
          isValid: false,
          reason: `Forbidden function call detected: ${forbidden.message}. This operation is not allowed in animation code.`,
        };
      }
    }

    return { isValid: true };
  }

  private validateDangerousPatterns(code: string): { isValid: boolean; reason?: string } {
    const dangerousPatterns = [
      {
        pattern: /(os|sys|subprocess)\.\w+/,
        message: 'Direct module method calls on restricted modules',
      },
      {
        pattern: /with\s+open\s*\(/,
        message: 'File context managers (with open)',
      },
      {
        pattern: /\bwith\s+file\s*\(/,
        message: 'File context managers (with file)',
      },
      {
        pattern: /lambda.*(?:eval|exec|__import__|compile)/,
        message: 'Lambda functions with dangerous operations',
      },
      {
        pattern: /\[.*for.*in.*\].*(?:eval|exec)/,
        message: 'List comprehensions with code execution',
      },
    ];

    for (const dangerous of dangerousPatterns) {
      if (dangerous.pattern.test(code)) {
        return {
          isValid: false,
          reason: `Potentially unsafe pattern detected: ${dangerous.message}. Please revise your prompt.`,
        };
      }
    }

    return { isValid: true };
  }

  private validateOutputConstraints(code: string): { isValid: boolean; reason?: string } {
    // Check for camera.frame and other forbidden camera manipulations
    const forbiddenCameraPatterns = [
      { pattern: /\.camera\.frame/, message: 'camera.frame manipulation not allowed' },
      { pattern: /\.camera\.animate/, message: 'camera.animate not allowed' },
      { pattern: /camera\.add/, message: 'camera configuration not allowed' },
      { pattern: /self\.camera\s*=/, message: 'camera assignment not allowed' },
    ];

    for (const pattern of forbiddenCameraPatterns) {
      if (pattern.pattern.test(code)) {
        return {
          isValid: false,
          reason: `${pattern.message}. Do not use camera manipulation in your prompt.`,
        };
      }
    }

    // Check for resolution/quality override attempts
    const qualityOverridePatterns = [
      { pattern: /-qm/, message: 'Medium quality (-qm) not allowed, use -ql' },
      { pattern: /-qh/, message: 'High quality (-qh) not allowed, use -ql' },
      { pattern: /quality\s*=\s*"[^"]*[mh]/, message: 'Quality override not allowed' },
      { pattern: /frame_rate\s*=/, message: 'Frame rate modification not allowed' },
      { pattern: /pixel_height/, message: 'Resolution modification not allowed' },
      { pattern: /pixel_width/, message: 'Resolution modification not allowed' },
    ];

    for (const pattern of qualityOverridePatterns) {
      if (pattern.pattern.test(code)) {
        return {
          isValid: false,
          reason: `${pattern.message}. Resolution is fixed at 480p 15fps.`,
        };
      }
    }

    // Check for excessive run_time values (heuristic check for duration)
    // Looking for run_time > 5 seconds in individual animations
    const largeRunTimePattern = /run_time\s*=\s*([0-9]+(?:\.[0-9]+)?)/g;
    let match;
    while ((match = largeRunTimePattern.exec(code)) !== null) {
      const runTime = parseFloat(match[1]);
      if (runTime > 5) {
        return {
          isValid: false,
          reason: `Animation step duration (${runTime}s) exceeds maximum of 5 seconds per step. Keep animations short and keep total under 12 seconds.`,
        };
      }
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const manimCodeGenerator = new ManimCodeGeneratorService({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  model: 'mistralai/devstral-2512:free',
  temperature: 0.7,
  maxTokens: 2000,
});

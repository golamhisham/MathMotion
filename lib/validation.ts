import { ValidationResult } from '@/types';

export function validatePrompt(prompt: string): ValidationResult {
  const trimmedPrompt = prompt.trim();

  if (trimmedPrompt.length === 0) {
    return {
      isValid: false,
      error: 'Please enter a prompt to generate an animation',
    };
  }

  if (trimmedPrompt.length > 1000) {
    return {
      isValid: false,
      error: 'Prompt must be less than 1000 characters',
    };
  }

  return { isValid: true };
}

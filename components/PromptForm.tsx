'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StylePreset, GenerationFormData } from '@/types';
import { DEFAULT_STYLE_PRESET } from '@/lib/constants';
import { validatePrompt } from '@/lib/validation';
import PromptTextarea from './PromptTextarea';
import StylePresetDropdown from './StylePresetDropdown';
import GenerateButton from './GenerateButton';

export default function PromptForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [stylePreset, setStylePreset] = useState<StylePreset>(DEFAULT_STYLE_PRESET);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError(undefined);

    // Validate prompt
    const validation = validatePrompt(prompt);

    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    // Form is valid - prepare data
    const formData: GenerationFormData = {
      prompt: prompt.trim(),
      stylePreset,
    };

    try {
      setLoading(true);

      // Call API to create job
      const response = await fetch('/api/jobs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit job');
      }

      const { job } = await response.json();

      // Navigate to result page
      router.push(`/result/${job.id}`);
    } catch (err) {
      setError('Failed to submit animation request. Please try again.');
      console.error('Submission error:', err);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6">
      <PromptTextarea
        value={prompt}
        onChange={setPrompt}
        error={error}
      />

      <StylePresetDropdown
        value={stylePreset}
        onChange={setStylePreset}
      />

      <div className="flex justify-end">
        <GenerateButton
          onClick={() => {}}
          disabled={loading}
          loading={loading}
        />
      </div>
    </form>
  );
}

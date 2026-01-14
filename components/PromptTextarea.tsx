'use client';

import { ChangeEvent } from 'react';

interface PromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function PromptTextarea({
  value,
  onChange,
  error
}: PromptTextareaProps) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="w-full">
      <label
        htmlFor="prompt"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Animation Prompt
      </label>
      <textarea
        id="prompt"
        value={value}
        onChange={handleChange}
        placeholder="Describe the math animation you want to create..."
        rows={6}
        className={`w-full px-4 py-3 rounded-lg border ${
          error
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
        } focus:ring-2 focus:outline-none transition-colors resize-none`}
        aria-invalid={!!error}
        aria-describedby={error ? 'prompt-error' : undefined}
      />
      {error && (
        <p id="prompt-error" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

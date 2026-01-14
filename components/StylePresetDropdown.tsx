'use client';

import { ChangeEvent } from 'react';
import { StylePreset } from '@/types';
import { STYLE_PRESETS } from '@/lib/constants';

interface StylePresetDropdownProps {
  value: StylePreset;
  onChange: (value: StylePreset) => void;
}

export default function StylePresetDropdown({
  value,
  onChange
}: StylePresetDropdownProps) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as StylePreset);
  };

  return (
    <div className="w-full">
      <label
        htmlFor="stylePreset"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Style Preset
      </label>
      <select
        id="stylePreset"
        value={value}
        onChange={handleChange}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors bg-white"
      >
        {STYLE_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
      </select>
    </div>
  );
}

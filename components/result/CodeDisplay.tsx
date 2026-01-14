'use client';

import { useState, useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-python';

interface CodeDisplayProps {
  code: string;
  explanation?: string;
}

export default function CodeDisplay({ code, explanation }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Generated Manim Code
        </h2>
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
        >
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>

      {explanation && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-700">{explanation}</p>
        </div>
      )}

      <div className="relative">
        <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <code
            ref={codeRef}
            className="language-python text-sm"
          >
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}

'use client';

interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function GenerateButton({
  onClick,
  disabled = false,
  loading = false
}: GenerateButtonProps) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      {loading ? 'Generating...' : 'Generate Animation'}
    </button>
  );
}

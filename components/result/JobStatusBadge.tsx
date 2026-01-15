'use client';

import { JobStatus } from '@/types';
import { JOB_STATUS_CONFIG } from '@/lib/constants';

interface JobStatusBadgeProps {
  status: JobStatus;
}

export default function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const config = JOB_STATUS_CONFIG[status];

  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
        colorClasses[config.color as keyof typeof colorClasses]
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full mr-2 ${
          status === 'generating_code' || status === 'rendering'
            ? 'animate-pulse bg-current'
            : 'bg-current'
        }`}
      />
      {config.label}
    </span>
  );
}

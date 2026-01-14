import { StylePreset, JobStatus, GalleryExample } from '@/types';

export const STYLE_PRESETS: StylePreset[] = [
  '3Blue1Brown',
  'Classic',
  'Minimalist',
  'Dark',
];

export const DEFAULT_STYLE_PRESET: StylePreset = '3Blue1Brown';

// Polling configuration
export const POLLING_INTERVAL_MS = 3000;
export const TERMINAL_JOB_STATES: JobStatus[] = ['done', 'failed'];

// Job status display configuration
export const JOB_STATUS_CONFIG = {
  queued: { label: 'Queued', color: 'gray' },
  generating: { label: 'Generating Code', color: 'blue' },
  rendering: { label: 'Rendering Video', color: 'purple' },
  done: { label: 'Complete', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
} as const;

// Gallery examples
export const GALLERY_EXAMPLES: GalleryExample[] = [
  {
    id: 'pythagorean-theorem',
    title: 'Pythagorean Theorem Proof',
    prompt: 'Create an animated proof of the Pythagorean theorem using visual squares on each side of a right triangle. Show how the area of squares on the two shorter sides equals the area of the square on the hypotenuse.',
    stylePreset: '3Blue1Brown',
  },
  {
    id: 'unit-circle',
    title: 'Unit Circle & Trigonometry',
    prompt: 'Animate the unit circle showing how sine and cosine values change as a point moves around the circle. Include the angle measure and coordinate values updating in real-time.',
    stylePreset: '3Blue1Brown',
  },
  {
    id: 'derivative-visualization',
    title: 'Understanding Derivatives',
    prompt: 'Visualize the derivative as the slope of a tangent line. Show a function curve with a secant line between two points that gradually become closer until it becomes the tangent line.',
    stylePreset: 'Classic',
  },
  {
    id: 'fourier-series',
    title: 'Fourier Series Approximation',
    prompt: 'Demonstrate how adding sine waves of different frequencies can approximate a square wave. Show the first 5 terms of the Fourier series being added together step by step.',
    stylePreset: 'Dark',
  },
  {
    id: 'matrix-transformation',
    title: 'Linear Transformation Matrices',
    prompt: 'Show how a 2x2 matrix transforms a grid of points in 2D space. Animate the transformation smoothly and highlight how basis vectors change.',
    stylePreset: '3Blue1Brown',
  },
  {
    id: 'limits-epsilon-delta',
    title: 'Epsilon-Delta Definition of Limits',
    prompt: 'Visualize the epsilon-delta definition of a limit. Show how for any epsilon band around the limit value, there exists a delta interval around the point where the function stays within epsilon.',
    stylePreset: 'Minimalist',
  },
  {
    id: 'fibonacci-spiral',
    title: 'Fibonacci Spiral Construction',
    prompt: 'Animate the construction of the Fibonacci spiral by drawing squares with Fibonacci number side lengths and connecting their corners with quarter-circle arcs.',
    stylePreset: 'Classic',
  },
  {
    id: 'riemann-sums',
    title: 'Riemann Sum Integration',
    prompt: 'Show how Riemann sums approximate the integral of a function. Start with a few rectangles and gradually increase the number to show convergence to the true area under the curve.',
    stylePreset: '3Blue1Brown',
  },
  {
    id: 'complex-plane',
    title: 'Complex Number Multiplication',
    prompt: 'Visualize complex number multiplication in the complex plane. Show how multiplying by a complex number is equivalent to rotation and scaling. Demonstrate with z * (1 + i).',
    stylePreset: 'Dark',
  },
  {
    id: 'prime-spirals',
    title: 'Prime Number Spiral Pattern',
    prompt: 'Create the Ulam spiral by arranging integers in a spiral pattern and highlighting the prime numbers. Show the unexpected diagonal patterns that emerge in the prime distribution.',
    stylePreset: 'Minimalist',
  },
];

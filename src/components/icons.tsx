import type { Sense } from '../content/guardians';

const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;

export function SenseIcon({ sense }: { sense: Sense }) {
  switch (sense) {
    case 'sight':
      return (
        <svg {...common}>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'hearing':
      return (
        <svg {...common}>
          <path d="M7 9.5a5 5 0 0 1 10 0c0 3-3 3.6-3 6.5a2.6 2.6 0 0 1-5.2 0" />
          <path d="M10.2 9.6a1.8 1.8 0 0 1 3.6 0c0 1.2-1 1.6-1.4 2.4" />
        </svg>
      );
    case 'taste':
      return (
        <svg {...common}>
          <circle cx="12" cy="14.5" r="6" />
          <path d="M12 8.6c0-2.6 1.8-4.4 4.6-4.6 0 2.6-1.8 4.4-4.6 4.6z" />
        </svg>
      );
    case 'smell':
      return (
        <svg {...common}>
          <path d="M8 20c-2.2-3 2-4.4 0-7.4s2-4.4 0-7.4" />
          <path d="M13 20c-2.2-3 2-4.4 0-7.4s2-4.4 0-7.4" />
          <path d="M18 20c-2.2-3 2-4.4 0-7.4s2-4.4 0-7.4" />
        </svg>
      );
    case 'touch':
      return (
        <svg {...common}>
          <path d="M7 13V6.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M10 11V4.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M13 11V5.5a1.5 1.5 0 0 1 3 0V12" />
          <path d="M16 12V8.5a1.5 1.5 0 0 1 3 0V15c0 4-3 6-6 6s-5-1-7-4l-2-3a1.5 1.5 0 0 1 2.4-1.7L7 13" />
        </svg>
      );
  }
}

export function CheckIcon() {
  return (
    <svg {...common} strokeWidth={2.6}>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg {...common}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

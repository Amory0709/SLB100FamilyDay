import type { ReactNode } from 'react';

export const GESTURE_GLYPHS: Record<string, ReactNode> = {
  point_to_other: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="48" cy="58" r="22" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <rect x="32" y="78" width="32" height="14" rx="3" fill="#0014c8" />
      <g transform="translate(70 55) rotate(90)">
        <rect x="0" y="-6" width="30" height="12" rx="6" fill="#0014c8" />
      </g>
      <circle cx="26" cy="56" r="7" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <circle cx="38" cy="36" r="5" fill="#0014c8" />
      <circle cx="50" cy="34" r="5" fill="#0014c8" />
      <circle cx="60" cy="36" r="5" fill="#0014c8" />
    </svg>
  ),
  thumb_up: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="62" r="22" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <rect x="32" y="78" width="32" height="14" rx="3" fill="#0014c8" />
      <rect x="42" y="6" width="14" height="42" rx="7" fill="#0014c8" />
      <circle cx="36" cy="42" r="5" fill="#0014c8" />
      <circle cx="48" cy="40" r="5" fill="#0014c8" />
      <circle cx="60" cy="42" r="5" fill="#0014c8" />
      <circle cx="68" cy="50" r="5" fill="#0014c8" />
    </svg>
  ),
  half_thumb_up: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="62" r="22" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <rect x="32" y="78" width="32" height="14" rx="3" fill="#0014c8" />
      <path d="M 44 52 Q 32 30 44 14" stroke="#0014c8" strokeWidth="13" fill="none" strokeLinecap="round" />
      <circle cx="36" cy="44" r="6" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <circle cx="48" cy="42" r="6" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <circle cx="60" cy="44" r="6" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <circle cx="68" cy="52" r="6" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
    </svg>
  ),
  two_fingers: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="62" r="22" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <rect x="32" y="78" width="32" height="14" rx="3" fill="#0014c8" />
      <rect x="42" y="6" width="13" height="42" rx="6.5" fill="#0014c8" />
      <rect x="58" y="6" width="13" height="42" rx="6.5" fill="#0014c8" />
      <circle cx="26" cy="58" r="7" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <circle cx="72" cy="48" r="5" fill="#0014c8" />
    </svg>
  ),
  point_diagonal_down: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="46" cy="52" r="22" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <rect x="32" y="78" width="32" height="14" rx="3" fill="#0014c8" />
      <g transform="translate(60 58) rotate(45)">
        <rect x="0" y="-6" width="34" height="12" rx="6" fill="#0014c8" />
      </g>
      <circle cx="22" cy="50" r="7" fill="#eef2ff" stroke="#0014c8" strokeWidth="3" />
      <circle cx="36" cy="30" r="5" fill="#0014c8" />
      <circle cx="48" cy="28" r="5" fill="#0014c8" />
      <circle cx="58" cy="30" r="5" fill="#0014c8" />
    </svg>
  ),
};

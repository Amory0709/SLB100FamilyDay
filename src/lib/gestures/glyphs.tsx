import type { ReactNode } from 'react';

export const GESTURE_GLYPHS: Record<string, ReactNode> = {
  point_to_other: <span style={{ fontSize: '64px', display: 'block' }}>🫵</span>,
  thumb_up: <span style={{ fontSize: '64px', display: 'block' }}>👍</span>,
  half_thumb_up: <span style={{ fontSize: '64px', display: 'block' }}>🤏</span>,
  two_fingers: <span style={{ fontSize: '64px', display: 'block' }}>✌️</span>,
  point_diagonal_down: <span style={{ fontSize: '64px', display: 'block' }}>👇</span>,
};

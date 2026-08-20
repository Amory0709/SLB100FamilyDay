import type { ReactNode } from 'react';

export const GESTURE_GLYPHS: Record<string, ReactNode> = {
  point_to_other: <span style={{ fontSize: '64px', display: 'block' }}>🫵</span>,
  thumb_up: <span style={{ fontSize: '64px', display: 'block' }}>👍</span>,
  half_thumb_up: <span style={{ fontSize: '64px', display: 'block' }}>🤏</span>,
  two_fingers: <span style={{ fontSize: '64px', display: 'block' }}>✌️</span>,
  point_diagonal_down: <span style={{ fontSize: '64px', display: 'block' }}>👇</span>,
  hse_lift: <span style={{ fontSize: '64px', display: 'block' }}>🏋️</span>,
  hse_lift_duo: <span style={{ fontSize: '64px', display: 'block' }}>👥🏋️</span>,
  muscle_pose: <span style={{ fontSize: '64px', display: 'block' }}>💪</span>,
  double_thumb_up: (
    <span className="glyph-emoji-dual" aria-hidden="true">
      <span>👍</span>
      <span>👍</span>
    </span>
  ),
  smile: <span style={{ fontSize: '64px', display: 'block' }}>😊</span>,
  infinity_symbol: <span style={{ fontSize: '64px', display: 'block' }}>∞</span>,
  hug: <span style={{ fontSize: '64px', display: 'block' }}>🤗</span>,
};

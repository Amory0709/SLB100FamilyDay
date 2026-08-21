import type { ReactNode } from 'react';

export const GESTURE_GLYPHS: Record<string, ReactNode> = {
  point_to_other: <span style={{ fontSize: '64px', display: 'block' }}>🫵</span>,
  thumb_up: <span style={{ fontSize: '64px', display: 'block' }}>👍</span>,
  half_thumb_up: <span style={{ fontSize: '64px', display: 'block' }}>🤏</span>,
  two_fingers: <span style={{ fontSize: '64px', display: 'block' }}>✌️</span>,
  point_diagonal_down: <span style={{ fontSize: '64px', display: 'block' }}>👇</span>,
  hse_lift: <span style={{ fontSize: '64px', display: 'block' }}>🏋️</span>,
  hse_lift_duo: <span style={{ fontSize: '64px', display: 'block' }}>👥🏋️</span>,
  muscle_pose: (
    <span className="glyph-emoji-dual glyph-emoji-symmetric" aria-hidden="true">
      <span>💪</span>
      <span className="glyph-emoji-mirror">💪</span>
    </span>
  ),
  double_thumb_up: (
    <span className="glyph-emoji-dual glyph-emoji-symmetric" aria-hidden="true">
      <span>👍</span>
      <span className="glyph-emoji-mirror">👍</span>
    </span>
  ),
  double_thumb_up_duo: (
    <span className="glyph-emoji-quad glyph-emoji-symmetric" aria-hidden="true">
      <span className="glyph-emoji-pair">
        <span>👍</span>
        <span className="glyph-emoji-mirror">👍</span>
      </span>
      <span className="glyph-emoji-pair">
        <span>👍</span>
        <span className="glyph-emoji-mirror">👍</span>
      </span>
    </span>
  ),
  smile: <span style={{ fontSize: '64px', display: 'block' }}>😊</span>,
  infinity_symbol: (
    <span className="glyph-emoji-dual glyph-emoji-symmetric" aria-hidden="true">
      <span className="glyph-emoji-mirror">👌</span>
      <span className="glyph-emoji-mirror">👌</span>
    </span>
  ),
  hand_circle: <span style={{ fontSize: '64px', display: 'block' }}>👌</span>,
  hug: <span style={{ fontSize: '64px', display: 'block' }}>🤗</span>,
};

export const DUO_PLAYER_GLYPHS: Partial<
  Record<string, { left: ReactNode; right: ReactNode }>
> = {
  double_thumb_up_duo: {
    left: (
      <span className="glyph-emoji-pair" aria-hidden="true">
        <span>👍</span>
        <span className="glyph-emoji-mirror">👍</span>
      </span>
    ),
    right: (
      <span className="glyph-emoji-pair" aria-hidden="true">
        <span>👍</span>
        <span className="glyph-emoji-mirror">👍</span>
      </span>
    ),
  },
  infinity_symbol: {
    left: (
      <span className="glyph-emoji-single" aria-hidden="true">
        <span className="glyph-emoji-mirror">👌</span>
      </span>
    ),
    right: (
      <span className="glyph-emoji-single" aria-hidden="true">
        <span className="glyph-emoji-mirror">👌</span>
      </span>
    ),
  },
  hug: {
    left: <span style={{ fontSize: '48px', display: 'block' }}>🤗</span>,
    right: <span style={{ fontSize: '48px', display: 'block', transform: 'scaleX(-1)' }}>🤗</span>,
  },
};

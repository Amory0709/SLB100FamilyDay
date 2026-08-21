import { type RefObject } from 'react';

export const HAND_CURSOR_VIEW_SIZE = 48;
export const HAND_CURSOR_RING_RADIUS = 16;
export const HAND_CURSOR_FOG_BLUR = 3.2;

/** Offset blobs — blur merges into purple-left / teal-right mist (matches intro reference). */
export const HAND_CURSOR_FOG_LAYERS = [
  { cx: 22.4, cy: 24, r: 8, fill: 'rgba(0, 20, 200, 0.62)' },
  { cx: 27.2, cy: 22.4, r: 7.2, fill: 'rgba(126, 237, 208, 0.68)' },
  { cx: 24, cy: 27.2, r: 6.4, fill: 'rgba(255, 143, 171, 0.6)' },
  { cx: 25.6, cy: 25.6, r: 5.6, fill: 'rgba(255, 230, 109, 0.58)' },
] as const;

interface HandCursorFogProps {
  size?: number;
  filterId: string;
  animated?: boolean;
}

function HandCursorFogFilter({ filterId, animated }: { filterId: string; animated?: boolean }) {
  return (
    <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation={HAND_CURSOR_FOG_BLUR}>
        {animated ? (
          <animate
            attributeName="stdDeviation"
            values="2.8;3.5;3;2.8"
            dur="4.8s"
            repeatCount="indefinite"
          />
        ) : null}
      </feGaussianBlur>
    </filter>
  );
}

export function HandCursorFogLayers({
  filterId,
  animated = false,
}: {
  filterId: string;
  animated?: boolean;
}) {
  return (
    <g filter={`url(#${filterId})`} className={animated ? 'hand-cursor-mark-fog' : undefined}>
      {HAND_CURSOR_FOG_LAYERS.map((layer, index) => (
        <g
          key={`${layer.cx}-${layer.cy}-${layer.r}`}
          className={
            animated ? `hand-cursor-mark-fog-layer hand-cursor-mark-fog-layer-${index}` : undefined
          }
        >
          <circle cx={layer.cx} cy={layer.cy} r={layer.r} fill={layer.fill} />
        </g>
      ))}
    </g>
  );
}

export function HandCursorFog({ size = 40, filterId, animated = true }: HandCursorFogProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="hand-cursor-mark">
      <defs>
        <HandCursorFogFilter filterId={filterId} animated={animated} />
      </defs>
      <HandCursorFogLayers filterId={filterId} animated={animated} />
    </svg>
  );
}

interface HandCursorMarkProps {
  size?: number;
  gradientId: string;
  filterId: string;
  progress?: number;
  progressRef?: RefObject<SVGCircleElement | null>;
  className?: string;
  animatedFog?: boolean;
}

export function HandCursorMark({
  size = 88,
  gradientId,
  filterId,
  progress = 0,
  progressRef,
  className,
  animatedFog = true,
}: HandCursorMarkProps) {
  const circumference = 2 * Math.PI * HAND_CURSOR_RING_RADIUS;
  const dashOffset = circumference * (1 - progress);

  return (
    <svg
      viewBox={`0 0 ${HAND_CURSOR_VIEW_SIZE} ${HAND_CURSOR_VIEW_SIZE}`}
      width={size}
      height={size}
      className={['hand-cursor-mark', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7eedd0" />
          <stop offset="35%" stopColor="#0014c8" />
          <stop offset="68%" stopColor="#ffe66d" />
          <stop offset="100%" stopColor="#ff8fab" />
        </linearGradient>
        <HandCursorFogFilter filterId={filterId} animated={animatedFog} />
      </defs>

      <circle
        cx="24"
        cy="24"
        r={HAND_CURSOR_RING_RADIUS}
        fill="none"
        stroke="rgba(0, 20, 200, 0.1)"
        strokeWidth="3"
      />
      <circle
        ref={progressRef}
        cx="24"
        cy="24"
        r={HAND_CURSOR_RING_RADIUS}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={progressRef ? circumference : dashOffset}
        transform="rotate(-90 24 24)"
        opacity="0.85"
      />
      <HandCursorFogLayers filterId={filterId} animated={animatedFog} />
    </svg>
  );
}

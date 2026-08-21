import type { ReactNode } from 'react';
import {
  DUO_CIRCLES_PER_PLAYER,
  DUO_PLAYER_COUNT,
  DUO_THUMBS_PER_PLAYER,
  DUO_TOTAL_CIRCLES,
  DUO_TOTAL_THUMBS,
} from '@/lib/gestures/duoConstants';
import {
  buildDuoChecklistLayout,
  type DuoHandMetrics,
} from '@/lib/gestures/duoHandMetrics';
import { DUO_PLAYER_GLYPHS } from '@/lib/gestures/glyphs';
import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';

const CHECKLIST_LABEL_KEYS: Record<string, TranslationKey> = {
  bodies: 'duoCheckBodies',
  thumbsTotal: 'duoCheckThumbsTotal',
  leftThumbs: 'duoCheckPlayerThumbs',
  rightThumbs: 'duoCheckPlayerThumbs',
  circlesTotal: 'duoCheckCirclesTotal',
  leftCircle: 'duoCheckPlayerCircle',
  rightCircle: 'duoCheckPlayerCircle',
  hugClose: 'duoCheckHugClose',
  hugLeftArm: 'duoCheckHugLeftArm',
  hugRightArm: 'duoCheckHugRightArm',
};

function requiredForItem(id: string): number {
  switch (id) {
    case 'bodies':
      return DUO_PLAYER_COUNT;
    case 'thumbsTotal':
      return DUO_TOTAL_THUMBS;
    case 'leftThumbs':
    case 'rightThumbs':
      return DUO_THUMBS_PER_PLAYER;
    case 'circlesTotal':
      return DUO_TOTAL_CIRCLES;
    case 'leftCircle':
    case 'rightCircle':
      return DUO_CIRCLES_PER_PLAYER;
    case 'hugClose':
    case 'hugLeftArm':
    case 'hugRightArm':
      return 1;
    default:
      return DUO_PLAYER_COUNT;
  }
}

function metricCountForItem(id: string, metrics: DuoHandMetrics): number {
  switch (id) {
    case 'bodies':
      if (metrics.hugBodiesClose && metrics.bodyCount === 1 && metrics.playerCount < DUO_PLAYER_COUNT) {
        return 2;
      }
      return Math.max(metrics.playerCount, metrics.bodyCount);
    case 'thumbsTotal':
      return metrics.thumbUpTotal;
    case 'leftThumbs':
      return metrics.thumbUpByPlayer[0];
    case 'rightThumbs':
      return metrics.thumbUpByPlayer[1];
    case 'circlesTotal':
      return metrics.circleTotal;
    case 'leftCircle':
      return metrics.circleByPlayer[0];
    case 'rightCircle':
      return metrics.circleByPlayer[1];
    case 'hugClose':
      return metrics.hugBodiesClose ? 1 : 0;
    case 'hugLeftArm':
      return metrics.hugLeftArm ? 1 : 0;
    case 'hugRightArm':
      return metrics.hugRightArm ? 1 : 0;
    default:
      return 0;
  }
}

interface DuoGestureChecklistProps {
  gestureKey: string;
  metrics: DuoHandMetrics;
  holdProgress?: number;
}

function ChecklistRow({
  id,
  met,
  metrics,
}: {
  id: string;
  met: boolean;
  metrics: DuoHandMetrics;
}) {
  const { t } = useLanguage();
  const labelKey = CHECKLIST_LABEL_KEYS[id];
  const count = metricCountForItem(id, metrics);
  const required = requiredForItem(id);

  return (
    <div className={`duo-check-row${met ? ' met' : ' missing'}`}>
      <span className="duo-check-icon" aria-hidden="true">
        {met ? '✓' : '○'}
      </span>
      <span>{labelKey ? t(labelKey, count, required) : id}</span>
    </div>
  );
}

function PlayerPanel({
  side,
  playerLabel,
  glyph,
  items,
  metrics,
}: {
  side: 'left' | 'right';
  playerLabel: string;
  glyph: ReactNode;
  items: { id: string; met: boolean }[];
  metrics: DuoHandMetrics;
}) {
  const allMet = items.every((item) => item.met);

  return (
    <div className={`duo-check-player duo-check-player-${side}${allMet ? ' met' : ''}`}>
      <div className="duo-check-player-label">{playerLabel}</div>
      <div className="duo-check-player-glyph">{glyph}</div>
      {items.map((item) => (
        <ChecklistRow key={item.id} id={item.id} met={item.met} metrics={metrics} />
      ))}
    </div>
  );
}

export function DuoGestureChecklist({
  gestureKey,
  metrics,
  holdProgress = 0,
}: DuoGestureChecklistProps) {
  const { t } = useLanguage();
  const layout = buildDuoChecklistLayout(gestureKey, metrics);
  if (layout.shared.length === 0 && layout.left.length === 0) return null;

  const playerGlyphs = DUO_PLAYER_GLYPHS[gestureKey];
  const allMet =
    layout.shared.every((item) => item.met) &&
    layout.left.every((item) => item.met) &&
    layout.right.every((item) => item.met);

  return (
    <div className="duo-gesture-checklist" aria-live="polite">
      {layout.shared.length > 0 && (
        <div className="duo-check-shared">
          {layout.shared.map((item) => (
            <ChecklistRow key={item.id} id={item.id} met={item.met} metrics={metrics} />
          ))}
        </div>
      )}

      <div className="duo-check-players">
        <PlayerPanel
          side="left"
          playerLabel={t('duoPlayerLeft')}
          glyph={playerGlyphs?.left ?? '👈'}
          items={layout.left}
          metrics={metrics}
        />
        <PlayerPanel
          side="right"
          playerLabel={t('duoPlayerRight')}
          glyph={playerGlyphs?.right ?? '👉'}
          items={layout.right}
          metrics={metrics}
        />
      </div>

      {allMet && <div className="duo-check-ready">{t('duoCheckReady')}</div>}

      {holdProgress > 0 && (
        <div className="duo-check-hold-bar" aria-hidden="true">
          <div className="duo-check-hold-fill" style={{ width: `${holdProgress * 100}%` }} />
        </div>
      )}
    </div>
  );
}

export function isDuoChecklistGesture(gestureKey: string | undefined): boolean {
  return (
    gestureKey === 'double_thumb_up_duo' ||
    gestureKey === 'infinity_symbol' ||
    gestureKey === 'hug'
  );
}

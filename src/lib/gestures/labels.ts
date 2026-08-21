import type { Language } from '@/i18n/types';

export const GESTURE_LABELS: Record<string, Record<Language, string>> = {
  hse_lift: { en: 'Safe lift pose', zh: '安全搬运姿势' },
  hse_lift_duo: { en: 'Safe lift (both)', zh: '双人安全搬运' },
  muscle_pose: { en: 'Muscle pose', zh: '展示肌肉' },
  double_thumb_up: { en: 'Double thumbs up', zh: '双手点赞' },
  double_thumb_up_duo: { en: 'Four thumbs up (both)', zh: '四个赞' },
  smile: { en: 'Smile', zh: '微笑' },
  infinity_symbol: { en: 'Infinity symbol (both)', zh: '双人比圈' },
  hand_circle: { en: 'Hand circle', zh: '比圈' },
  hug: { en: 'Hug', zh: '拥抱' },
  thumb_up: { en: 'Thumb up', zh: '竖拇指' },
  half_thumb_up: { en: 'Half thumb up', zh: '半竖拇指' },
  two_fingers: { en: 'Two fingers', zh: '剪刀手' },
  point_to_other: { en: 'Point to other', zh: '指向对方' },
  point_diagonal_down: { en: 'Point down', zh: '斜下方指' },
};

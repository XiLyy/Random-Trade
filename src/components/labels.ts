import type { ItemStatus } from '../lib/types'

/** チェックボックスとパレットで使う表示名。「持っている／持っていない／余分に持っている」の順に並べる */
export const STATUS_OPTIONS: { status: Exclude<ItemStatus, 'none'>; label: string }[] = [
  { status: 'owned', label: '所持' },
  { status: 'wanted', label: '未所持（求）' },
  { status: 'extra', label: '余分（譲）' },
]

/** 画像の枠に重ねる短い表示 */
export const STATUS_BADGES: Record<ItemStatus, string | null> = {
  none: null,
  owned: '所持',
  wanted: '求',
  extra: '譲',
}

import type { ItemStatus, TradeItem } from './types'

export const STATUS_LABELS: Record<ItemStatus, string> = {
  none: '未選択',
  owned: '所持',
  wanted: '未所持',
  extra: '余分',
}

/** 出力画像やテキストで使う1文字の印 */
export const TRADE_MARKS = {
  extra: '譲',
  wanted: '求',
} as const

export const MAX_EXTRA_COUNT = 99

/** チェックボックスの挙動：押した状態がすでにオンなら未選択に戻し、そうでなければその状態だけをオンにする */
export function toggleStatus(current: ItemStatus, clicked: ItemStatus): ItemStatus {
  return current === clicked ? 'none' : clicked
}

export function displayName(item: TradeItem, index: number): string {
  return item.name.trim() || `No.${index + 1}`
}

export function countByStatus(items: TradeItem[]): Record<ItemStatus, number> {
  const counts: Record<ItemStatus, number> = { none: 0, owned: 0, wanted: 0, extra: 0 }
  for (const item of items) counts[item.status]++
  return counts
}

export function hasTradeTargets(items: TradeItem[]): boolean {
  return items.some((item) => item.status === 'extra' || item.status === 'wanted')
}

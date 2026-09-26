/** 画像サイズに対する割合（0〜1）で表した矩形 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 商品ごとのチェック状態
 * - none: 未選択
 * - owned: 所持（交換に出さない）
 * - wanted: 未所持 → 出力では「求」
 * - extra: 余分 → 出力では「譲」
 */
export type ItemStatus = 'none' | 'owned' | 'wanted' | 'extra'

export interface TradeItem {
  id: string
  rect: Rect
  /** 空欄のときは「No.番号」を表示名にする */
  name: string
  status: ItemStatus
  /** 余分（譲）の個数。status が extra のときだけ使う */
  extraCount: number
}

export interface LoadedImage {
  url: string
  width: number
  height: number
  name: string
  element: HTMLImageElement
}

export interface OutputOptions {
  title: string
  note: string
  showLegend: boolean
  dimOthers: boolean
}

/** ImageData と同じ形。テストでは DOM なしで作れるようにこの型を受け取る */
export interface ImageDataLike {
  width: number
  height: number
  data: Uint8ClampedArray
}

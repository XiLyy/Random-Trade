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

/** 出力画像のオプション。画像には譲・求の印だけを描き、文字は募集文に入れる */
export interface OutputOptions {
  /** 所持・未選択の商品を薄くする */
  dimOthers: boolean
}

/**
 * SNS 投稿用の募集文の設定。公演・イベント・アーティストごとに最初に決め、
 * 画像を差し替えてもそのまま使う
 */
export interface PostSettings {
  /** 募集文の最初に入れる文（例：【交換】〇〇 LIVE TOUR 2026 ランダムブロマイド） */
  header: string
  /** 譲・求のあとに入れる補足（例：郵送のみ／同種交換を優先します） */
  note: string
  /** ハッシュタグ。空白で区切り、# は付けても付けなくてもよい */
  hashtags: string
}

/** ImageData と同じ形。テストでは DOM なしで作れるようにこの型を受け取る */
export interface ImageDataLike {
  width: number
  height: number
  data: Uint8ClampedArray
}

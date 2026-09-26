import type { Rect } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function area(r: Rect): number {
  return r.w * r.h
}

export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}

export function unionAll(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  return rects.reduce(union)
}

/** 2点をつなぐ矩形を作る（ドラッグの向きに関係なく w, h が正になる） */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  }
}

/** 0〜1 の範囲に収まるように矩形を補正する。最小サイズも保証する */
export function clampRect(r: Rect, minSize = 0.01): Rect {
  const w = clamp(r.w, minSize, 1)
  const h = clamp(r.h, minSize, 1)
  return {
    x: clamp(r.x, 0, 1 - w),
    y: clamp(r.y, 0, 1 - h),
    w,
    h,
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * 左上から右へ、上の段から下の段へ、という読む順に並べ替える。
 * 中心の高さが「枠の高さの中央値の半分」以内なら同じ段とみなす。
 */
export function sortByReadingOrder<T>(list: T[], getRect: (item: T) => Rect): T[] {
  if (list.length <= 1) return [...list]
  const centerY = (item: T) => getRect(item).y + getRect(item).h / 2
  const tolerance = median(list.map((item) => getRect(item).h)) / 2
  const byY = [...list].sort((a, b) => centerY(a) - centerY(b))

  const rows: T[][] = []
  let rowCenter = Number.NEGATIVE_INFINITY
  for (const item of byY) {
    const cy = centerY(item)
    const current = rows[rows.length - 1]
    if (current && Math.abs(cy - rowCenter) <= tolerance) {
      current.push(item)
      rowCenter = current.reduce((sum, it) => sum + centerY(it), 0) / current.length
    } else {
      rows.push([item])
      rowCenter = cy
    }
  }
  return rows.flatMap((row) => row.sort((a, b) => getRect(a).x - getRect(b).x))
}

/** 指定した範囲を rows × cols に均等分割した矩形を、読む順で返す */
export function gridRects(rows: number, cols: number, bounds: Rect = { x: 0, y: 0, w: 1, h: 1 }): Rect[] {
  const r = Math.max(1, Math.floor(rows))
  const c = Math.max(1, Math.floor(cols))
  const cellW = bounds.w / c
  const cellH = bounds.h / r
  const rects: Rect[] = []
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      rects.push({ x: bounds.x + col * cellW, y: bounds.y + row * cellH, w: cellW, h: cellH })
    }
  }
  return rects
}

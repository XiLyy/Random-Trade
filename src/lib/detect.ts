import { clamp, sortByReadingOrder } from './geometry'
import type { ImageDataLike, Rect } from './types'

/**
 * ラインナップ画像から商品の位置を検出する。
 *
 * 考え方：ラインナップ画像は「単色に近い背景の上に商品が並んでいる」ことが多い。
 * そこで、画像のふちの色から背景色を推定し、背景と色が違う部分を商品とみなして
 * かたまりごとに枠を作る。詳しくは docs/03-mvp-design.md を参照。
 */

export interface DetectOptions {
  /** 0〜100。大きいほど背景とのわずかな色の差も商品として拾う（初期値 50） */
  sensitivity?: number
}

export const DEFAULT_SENSITIVITY = 50

/** 解析用に縮小するときの長辺のピクセル数 */
export const ANALYSIS_MAX_SIDE = 512

/** ピクセル座標の矩形。x1, y1 は含まない */
interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Component extends Box {
  count: number
}

type RGB = [number, number, number]

/** 背景の中に商品をまとめて載せた台紙がある場合に、何段まで内側を探すか */
const MAX_DEPTH = 2

/** くっついたかたまりを、行→列→…と何段まで入れ子に分割するか */
const MAX_SPLIT_DEPTH = 4

/** 感度を「背景とみなす色の距離（RGB のユークリッド距離）」に変換する */
export function sensitivityToThreshold(sensitivity: number): number {
  return 10 + (100 - clamp(sensitivity, 0, 100)) * 0.4
}

export function detectItems(img: ImageDataLike, options: DetectOptions = {}): Rect[] {
  const { width: W, height: H } = img
  if (W === 0 || H === 0) return []
  const threshold = sensitivityToThreshold(options.sensitivity ?? DEFAULT_SENSITIVITY)

  let boxes = detectInRegion(img, { x0: 0, y0: 0, x1: W, y1: H }, threshold, 0)
  boxes = mergeOverlapping(boxes)
  boxes = filterOutliers(boxes)

  const pad = Math.max(1, Math.round(Math.max(W, H) * 0.006))
  const rects = boxes.map((b) => toRect(expand(b, pad, W, H), W, H))
  return sortByReadingOrder(rects, (r) => r)
}

function detectInRegion(img: ImageDataLike, region: Box, threshold: number, depth: number): Box[] {
  const rw = region.x1 - region.x0
  const rh = region.y1 - region.y0
  const regionArea = rw * rh
  const minArea = img.width * img.height * 0.001

  const background = estimateBackground(img, region)
  const mask = foregroundMask(img, region, background, threshold)
  // 商品の中の細かい隙間（透明なアクリル部分など）を埋めて、1つのかたまりにする
  const radius = Math.max(1, Math.round(Math.max(img.width, img.height) * 0.006))
  const closed = erode(dilate(mask, rw, rh, radius), rw, rh, radius)

  // 格子状に並んだ商品の間の「谷」を探すときの、1つの商品の最小の幅（画像の長辺の 2%）
  const minSegment = Math.max(4, Math.round(Math.max(img.width, img.height) * 0.02))

  const result: Box[] = []
  for (const c of connectedComponents(closed, rw, rh)) {
    if (c.count < 16) continue
    // すき間の細いカードの並びや、すき間をまたぐ透かし文字でつながったかたまりを、商品ごとに分ける
    for (const piece of splitByGutters(mask, rw, c, minSegment)) {
      const box: Box = {
        x0: piece.x0 + region.x0,
        y0: piece.y0 + region.y0,
        x1: piece.x1 + region.x0,
        y1: piece.y1 + region.y0,
      }
      const boxArea = boxAreaOf(box)
      if (boxArea < minArea) continue
      if (boxArea > regionArea * 0.5) {
        // 範囲の大半を覆うかたまりは、商品をまとめて載せた台紙の可能性がある。
        // その内側で背景を推定し直して、もう一度探す。
        if (depth < MAX_DEPTH) {
          const inner = detectInRegion(img, box, threshold, depth + 1)
          if (inner.length >= 2) {
            result.push(...inner)
            continue
          }
        }
        // 内側でも分けられないときは、背景を分離できなかったとみなして捨てる
        continue
      }
      result.push(box)
    }
  }
  return result
}

/**
 * 1つのかたまりに見えるものが、実は格子状に並んだ複数の商品かどうかを調べて分割する（XY-cut）。
 *
 * 列ごと（または行ごと）に前景の割合を数え、周りよりはっきり薄い「谷」を商品の間のすき間とみなす。
 * すき間を透かし文字がまたいでいても、谷の部分は前景が少ないので見つけられる。
 * 1つの商品を誤って切らないよう、分割後の断片がほぼ同じ大きさのときだけ分割する。
 */
function splitByGutters(mask: Uint8Array, stride: number, box: Box, minSegment: number, depth = 0): Box[] {
  if (depth >= MAX_SPLIT_DEPTH) return [box]
  const segments =
    findGridSegments(mask, stride, box, 'x', minSegment) ??
    findGridSegments(mask, stride, box, 'y', minSegment) ??
    findCaption(mask, stride, box)
  if (!segments) return [box]
  return segments.flatMap((segment) => {
    const trimmed = trimToForeground(mask, stride, segment)
    return trimmed ? splitByGutters(mask, stride, trimmed, minSegment, depth + 1) : []
  })
}

/**
 * 商品のすぐ上か下に、何も描かれていない行をはさんで細い帯（商品名などの文字）があれば切り離す。
 * 切り離した帯は、あとの外れ値の除去で小さすぎるものとして捨てられる。
 */
function findCaption(mask: Uint8Array, stride: number, box: Box): Box[] | null {
  const height = box.y1 - box.y0
  const empty = new Uint8Array(height)
  for (let i = 0; i < height; i++) {
    const row = (box.y0 + i) * stride
    let any = 0
    for (let x = box.x0; x < box.x1 && !any; x++) any = mask[row + x]
    empty[i] = any ? 0 : 1
  }
  // 何も描かれていない行が続く区間のうち、いちばん長いもので上下に分ける
  let best: [number, number] | null = null
  for (let i = 0; i < height; ) {
    if (!empty[i]) {
      i++
      continue
    }
    let j = i
    while (j < height && empty[j]) j++
    if (i > 0 && j < height && (!best || j - i > best[1] - best[0])) best = [i, j]
    i = j
  }
  if (!best) return null
  const top = best[0]
  const bottom = height - best[1]
  if (Math.min(top, bottom) > Math.max(top, bottom) * 0.25) return null
  return [
    { x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y0 + best[0] },
    { x0: box.x0, x1: box.x1, y0: box.y0 + best[1], y1: box.y1 },
  ]
}

/** axis 方向に並んだ、ほぼ同じ大きさの断片に分けられるなら、その断片を返す */
function findGridSegments(
  mask: Uint8Array,
  stride: number,
  box: Box,
  axis: 'x' | 'y',
  minSegment: number,
): Box[] | null {
  const start = axis === 'x' ? box.x0 : box.y0
  const length = (axis === 'x' ? box.x1 : box.y1) - start
  const across = axis === 'x' ? box.y1 - box.y0 : box.x1 - box.x0
  if (length < minSegment * 2) return null

  // 列（行）ごとの前景の割合
  const ratio = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    let count = 0
    if (axis === 'x') {
      for (let y = box.y0; y < box.y1; y++) count += mask[y * stride + start + i]
    } else {
      const row = (start + i) * stride
      for (let x = box.x0; x < box.x1; x++) count += mask[row + x]
    }
    ratio[i] = count / across
  }

  // 商品の部分の典型的な濃さ（上位 20% の値）の 3 割以下を「谷」とする
  const dense = Array.from(ratio).sort((a, b) => a - b)[Math.floor(length * 0.8)]
  const limit = dense * 0.3
  const spans: [number, number][] = []
  let segmentStart = 0
  let i = 0
  while (i < length) {
    if (ratio[i] > limit) {
      i++
      continue
    }
    let j = i
    while (j < length && ratio[j] <= limit) j++
    if (i > segmentStart) spans.push([segmentStart, i])
    segmentStart = j
    i = j
  }
  if (segmentStart < length) spans.push([segmentStart, length])

  const kept = spans.filter(([a, b]) => b - a >= minSegment)
  if (kept.length < 2) return null
  const sizes = kept.map(([a, b]) => b - a)
  if (Math.max(...sizes) > Math.min(...sizes) * 1.5) return null

  return kept.map(([a, b]) =>
    axis === 'x'
      ? { x0: start + a, x1: start + b, y0: box.y0, y1: box.y1 }
      : { x0: box.x0, x1: box.x1, y0: start + a, y1: start + b },
  )
}

/** 範囲の中の前景ピクセルを囲む最小の矩形。前景がなければ null */
function trimToForeground(mask: Uint8Array, stride: number, box: Box): Box | null {
  let x0 = box.x1
  let y0 = box.y1
  let x1 = box.x0 - 1
  let y1 = box.y0 - 1
  for (let y = box.y0; y < box.y1; y++) {
    const row = y * stride
    for (let x = box.x0; x < box.x1; x++) {
      if (!mask[row + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < x0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

/**
 * 範囲のふち（外周の帯）の色を集計し、よく出てくる色を背景色とする。
 * グラデーションや2色の背景に対応するため、最大3色まで返す。
 */
function estimateBackground(img: ImageDataLike, region: Box): RGB[] {
  const { data, width } = img
  const rw = region.x1 - region.x0
  const rh = region.y1 - region.y0
  const band = Math.max(1, Math.round(Math.min(rw, rh) * 0.01))

  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()
  let total = 0
  for (let y = region.y0; y < region.y1; y++) {
    const onHorizontalEdge = y < region.y0 + band || y >= region.y1 - band
    for (let x = region.x0; x < region.x1; x++) {
      if (!onHorizontalEdge && x >= region.x0 + band && x < region.x1 - band) {
        // 内側は飛ばして右端の帯へ
        x = region.x1 - band - 1
        continue
      }
      const i = (y * width + x) * 4
      if (data[i + 3] < 128) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      // 各色 16 段階に丸めて集計する
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.count++
        bucket.r += r
        bucket.g += g
        bucket.b += b
      } else {
        buckets.set(key, { count: 1, r, g, b })
      }
      total++
    }
  }
  if (total === 0) return []

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count)
  const colors: RGB[] = []
  for (const bucket of sorted.slice(0, 3)) {
    if (colors.length > 0 && bucket.count < total * 0.15) break
    colors.push([bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count])
  }
  return colors
}

/** 背景色のどれとも色が離れているピクセルを 1 にしたマスクを作る（範囲内のローカル座標） */
function foregroundMask(img: ImageDataLike, region: Box, background: RGB[], threshold: number): Uint8Array {
  const { data, width } = img
  const rw = region.x1 - region.x0
  const rh = region.y1 - region.y0
  const mask = new Uint8Array(rw * rh)
  const thresholdSq = threshold * threshold

  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const i = ((y + region.y0) * width + (x + region.x0)) * 4
      // 透明なピクセルは背景
      if (data[i + 3] < 128) continue
      let isForeground = true
      for (const [br, bg, bb] of background) {
        const dr = data[i] - br
        const dg = data[i + 1] - bg
        const db = data[i + 2] - bb
        if (dr * dr + dg * dg + db * db <= thresholdSq) {
          isForeground = false
          break
        }
      }
      if (isForeground) mask[y * rw + x] = 1
    }
  }
  return mask
}

/** 累積和（積分画像）。窓の中の 1 の数を O(1) で数えるために使う */
function integral(mask: Uint8Array, w: number, h: number): Int32Array {
  const stride = w + 1
  const ii = new Int32Array(stride * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += mask[y * w + x]
      ii[(y + 1) * stride + x + 1] = ii[y * stride + x + 1] + rowSum
    }
  }
  return ii
}

function morph(mask: Uint8Array, w: number, h: number, r: number, mode: 'dilate' | 'erode'): Uint8Array {
  const ii = integral(mask, w, h)
  const stride = w + 1
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w, x + r + 1)
      const sum = ii[y1 * stride + x1] - ii[y0 * stride + x1] - ii[y1 * stride + x0] + ii[y0 * stride + x0]
      if (mode === 'dilate' ? sum > 0 : sum === (x1 - x0) * (y1 - y0)) out[y * w + x] = 1
    }
  }
  return out
}

function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  return morph(mask, w, h, r, 'dilate')
}

function erode(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  return morph(mask, w, h, r, 'erode')
}

/** 8近傍でつながったかたまりごとに、外接矩形とピクセル数を返す */
function connectedComponents(mask: Uint8Array, w: number, h: number): Component[] {
  const visited = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  const components: Component[] = []

  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || visited[start]) continue
    let sp = 0
    stack[sp++] = start
    visited[start] = 1
    let x0 = w
    let y0 = h
    let x1 = 0
    let y1 = 0
    let count = 0

    while (sp > 0) {
      const p = stack[--sp]
      const px = p % w
      const py = (p - px) / w
      count++
      if (px < x0) x0 = px
      if (px > x1) x1 = px
      if (py < y0) y0 = py
      if (py > y1) y1 = py

      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx
          if (nx < 0 || nx >= w) continue
          const q = ny * w + nx
          if (mask[q] && !visited[q]) {
            visited[q] = 1
            stack[sp++] = q
          }
        }
      }
    }
    components.push({ x0, y0, x1: x1 + 1, y1: y1 + 1, count })
  }
  return components
}

function boxAreaOf(b: Box): number {
  return (b.x1 - b.x0) * (b.y1 - b.y0)
}

function boxIntersection(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  return w > 0 && h > 0 ? w * h : 0
}

/** 大きく重なっている枠（1つの商品が複数のかたまりに分かれた場合など）を1つにまとめる */
function mergeOverlapping(input: Box[]): Box[] {
  const boxes = [...input]
  let merged = true
  while (merged) {
    merged = false
    for (let i = 0; i < boxes.length && !merged; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        if (boxIntersection(a, b) >= Math.min(boxAreaOf(a), boxAreaOf(b)) * 0.3) {
          boxes[i] = {
            x0: Math.min(a.x0, b.x0),
            y0: Math.min(a.y0, b.y0),
            x1: Math.max(a.x1, b.x1),
            y1: Math.max(a.y1, b.y1),
          }
          boxes.splice(j, 1)
          merged = true
          break
        }
      }
    }
  }
  return boxes
}

/**
 * 商品ではなさそうな枠を取り除く。
 * - 極端に細長いもの（区切り線、タイトルの帯など）
 * - 典型的な商品の大きさと比べて、面積・幅・高さのどれかがずっと小さいもの
 *   （商品名やタイトルの文字、ロゴ、コピーライト表記など）
 * 典型的な商品の大きさには、面積が大きい方の半分の枠の中央値を使う。
 */
function filterOutliers(boxes: Box[]): Box[] {
  const shaped = boxes.filter((b) => {
    const w = b.x1 - b.x0
    const h = b.y1 - b.y0
    return Math.max(w / h, h / w) <= 6
  })
  if (shaped.length <= 1) return shaped

  const byArea = [...shaped].sort((a, b) => boxAreaOf(b) - boxAreaOf(a))
  const top = byArea.slice(0, Math.ceil(byArea.length / 2))
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  const refArea = median(top.map(boxAreaOf))
  const refW = median(top.map((b) => b.x1 - b.x0))
  const refH = median(top.map((b) => b.y1 - b.y0))
  return shaped.filter(
    (b) => boxAreaOf(b) >= refArea * 0.2 && b.x1 - b.x0 >= refW * 0.45 && b.y1 - b.y0 >= refH * 0.45,
  )
}

function expand(b: Box, pad: number, w: number, h: number): Box {
  return {
    x0: Math.max(0, b.x0 - pad),
    y0: Math.max(0, b.y0 - pad),
    x1: Math.min(w, b.x1 + pad),
    y1: Math.min(h, b.y1 + pad),
  }
}

function toRect(b: Box, w: number, h: number): Rect {
  return { x: b.x0 / w, y: b.y0 / h, w: (b.x1 - b.x0) / w, h: (b.y1 - b.y0) / h }
}

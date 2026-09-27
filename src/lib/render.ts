import { TRADE_MARKS } from './status'
import type { OutputOptions, TradeItem } from './types'

export const MARK_COLORS = {
  extra: '#E8384F',
  wanted: '#2B6CE6',
} as const

/** スマホのキャンバスの上限を超えないよう、出力画像の長辺をこの値までに抑える */
export const MAX_OUTPUT_SIDE = 4096

export const OUTPUT_FONT_FAMILY =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, system-ui, sans-serif'

export interface PixelRect {
  x: number
  y: number
  w: number
  h: number
}

export interface MarkPlan {
  status: 'extra' | 'wanted'
  rect: PixelRect
  lineWidth: number
  radius: number
  badge: { x: number; y: number; size: number; label: string; count: string | null }
}

/** 出力画像は元の画像と同じ大きさで、譲・求の印だけを描く（タイトルや凡例は募集文に任せる） */
export interface OutputPlan {
  width: number
  height: number
  marks: MarkPlan[]
  dims: PixelRect[]
}

function font(size: number): string {
  return `bold ${Math.round(size)}px ${OUTPUT_FONT_FAMILY}`
}

interface PlanInput {
  sourceWidth: number
  sourceHeight: number
  items: TradeItem[]
  options: OutputOptions
}

/** 出力画像のレイアウトを計算する（描画はしない）。テストしやすいように描画と分けている */
export function planOutput({ sourceWidth, sourceHeight, items, options }: PlanInput): OutputPlan {
  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(sourceWidth, sourceHeight))
  const imageWidth = Math.round(sourceWidth * scale)
  const imageHeight = Math.round(sourceHeight * scale)
  const base = Math.max(imageWidth, imageHeight)

  const toPixels = (item: TradeItem): PixelRect => ({
    x: item.rect.x * imageWidth,
    y: item.rect.y * imageHeight,
    w: item.rect.w * imageWidth,
    h: item.rect.h * imageHeight,
  })

  const marks: MarkPlan[] = []
  const dims: PixelRect[] = []
  for (const item of items) {
    const rect = toPixels(item)
    if (item.status !== 'extra' && item.status !== 'wanted') {
      if (options.dimOthers) dims.push(rect)
      continue
    }
    const short = Math.min(rect.w, rect.h)
    const lineWidth = Math.max(3, short * 0.035)
    const size = Math.min(Math.max(short * 0.3, base * 0.025), short * 0.6)
    marks.push({
      status: item.status,
      rect,
      lineWidth,
      radius: Math.min(short * 0.08, lineWidth * 4),
      badge: {
        x: rect.x,
        y: rect.y,
        size,
        label: TRADE_MARKS[item.status],
        count: item.status === 'extra' && item.extraCount > 1 ? `×${item.extraCount}` : null,
      },
    })
  }

  return { width: imageWidth, height: imageHeight, marks, dims }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** 枠の左上に「譲」「求」のバッジを描く */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  status: 'extra' | 'wanted',
  x: number,
  y: number,
  size: number,
  count: string | null,
) {
  const color = MARK_COLORS[status]
  const border = Math.max(1.5, size * 0.06)
  const countFont = font(size * 0.5)
  ctx.font = countFont
  const countWidth = count ? ctx.measureText(count).width + size * 0.3 : 0
  const width = size + countWidth

  roundRectPath(ctx, x, y, width, size, size * 0.22)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = border
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()

  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font(size * 0.66)
  ctx.fillText(TRADE_MARKS[status], x + size / 2, y + size / 2 + size * 0.03)
  if (count) {
    ctx.font = countFont
    ctx.textAlign = 'left'
    ctx.fillText(count, x + size * 0.92, y + size / 2 + size * 0.03)
  }
}

export function drawOutput(ctx: CanvasRenderingContext2D, image: CanvasImageSource, plan: OutputPlan): void {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, plan.width, plan.height)
  ctx.drawImage(image, 0, 0, plan.width, plan.height)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  for (const r of plan.dims) ctx.fillRect(r.x, r.y, r.w, r.h)

  ctx.lineJoin = 'round'
  for (const mark of plan.marks) {
    const { rect, lineWidth, radius } = mark
    // 枠の線の中心が商品のふちに来るよう、線の太さの半分だけ内側に描く
    const inset = lineWidth / 2
    roundRectPath(ctx, rect.x + inset, rect.y + inset, rect.w - lineWidth, rect.h - lineWidth, radius)
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = lineWidth * 1.8
    ctx.stroke()
    ctx.strokeStyle = MARK_COLORS[mark.status]
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
  // バッジは枠より手前に描く（隣の枠の線に隠れないように）
  for (const mark of plan.marks) {
    const { badge } = mark
    drawBadge(ctx, mark.status, badge.x, badge.y, badge.size, badge.count)
  }
}

/** 出力画像を描画して PNG の Blob にする（ブラウザ専用） */
export async function renderOutputBlob(
  image: HTMLImageElement,
  items: TradeItem[],
  options: OutputOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('この端末ではキャンバスを利用できません')

  const plan = planOutput({ sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, items, options })
  canvas.width = plan.width
  canvas.height = plan.height
  drawOutput(ctx, image, plan)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('画像の書き出しに失敗しました'))), 'image/png')
  })
}

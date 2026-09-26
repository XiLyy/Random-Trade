import { ANALYSIS_MAX_SIDE } from './detect'
import type { LoadedImage } from './types'

export const MAX_FILE_BYTES = 30 * 1024 * 1024

/** 読み込めないファイルなら理由を返す。問題なければ null */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return '画像ファイルを選んでください。'
  if (file.size > MAX_FILE_BYTES) return '画像が大きすぎます（30MB まで）。'
  return null
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file)
  const element = new Image()
  element.src = url
  try {
    await element.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('画像を読み込めませんでした。別の形式（PNG / JPEG）で試してください。')
  }
  return {
    url,
    width: element.naturalWidth,
    height: element.naturalHeight,
    name: file.name || 'image',
    element,
  }
}

/** 自動認識用に、長辺を ANALYSIS_MAX_SIDE まで縮小したピクセルデータを取り出す */
export function getAnalysisImageData(image: HTMLImageElement): ImageData {
  const scale = Math.min(1, ANALYSIS_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('この端末ではキャンバスを利用できません')
  ctx.drawImage(image, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

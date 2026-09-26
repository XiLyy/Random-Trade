import type { ImageDataLike } from '../types'

type RGBA = [number, number, number, number?]

/** テスト用の画像を DOM なしで作る小さなヘルパー */
export class SyntheticImage implements ImageDataLike {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number

  constructor(width: number, height: number, background: RGBA = [255, 255, 255, 255]) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
    this.fillRect(0, 0, width, height, background)
  }

  fillRect(x: number, y: number, w: number, h: number, [r, g, b, a = 255]: RGBA): this {
    for (let py = Math.max(0, y); py < Math.min(this.height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(this.width, x + w); px++) {
        const i = (py * this.width + px) * 4
        this.data[i] = r
        this.data[i + 1] = g
        this.data[i + 2] = b
        this.data[i + 3] = a
      }
    }
    return this
  }

  /** JPEG のノイズを真似て、各ピクセルの色を ±amount の範囲でずらす（再現性のある疑似乱数を使う） */
  addNoise(amount: number, seed = 1): this {
    let s = seed
    const random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
    for (let i = 0; i < this.data.length; i += 4) {
      for (let c = 0; c < 3; c++) this.data[i + c] += Math.round((random() * 2 - 1) * amount)
    }
    return this
  }
}

/** rows × cols の格子に商品（色付きの正方形）を並べる。各商品の左上座標を返す */
export function drawGrid(
  img: SyntheticImage,
  rows: number,
  cols: number,
  { size, gap, offsetX = gap, offsetY = gap }: { size: number; gap: number; offsetX?: number; offsetY?: number },
): { x: number; y: number }[] {
  const palette: RGBA[] = [
    [230, 80, 120],
    [60, 120, 220],
    [250, 190, 40],
    [80, 180, 110],
    [150, 90, 200],
    [240, 130, 60],
  ]
  const positions: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offsetX + c * (size + gap)
      const y = offsetY + r * (size + gap)
      img.fillRect(x, y, size, size, palette[(r * cols + c) % palette.length])
      positions.push({ x, y })
    }
  }
  return positions
}

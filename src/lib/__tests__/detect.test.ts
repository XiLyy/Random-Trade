import { describe, expect, it } from 'vitest'
import { detectItems, sensitivityToThreshold } from '../detect'
import type { Rect } from '../types'
import { SyntheticImage, drawGrid } from './synthetic'

/** 検出した枠が、期待する商品の位置（ピクセル）を正しく囲んでいるか確かめる */
function expectToCover(rect: Rect, img: SyntheticImage, x: number, y: number, w: number, h = w) {
  const px = { x: rect.x * img.width, y: rect.y * img.height, w: rect.w * img.width, h: rect.h * img.height }
  const tolerance = Math.max(img.width, img.height) * 0.02
  expect(px.x).toBeLessThanOrEqual(x + 0.5)
  expect(px.y).toBeLessThanOrEqual(y + 0.5)
  expect(px.x + px.w).toBeGreaterThanOrEqual(x + w - 0.5)
  expect(px.y + px.h).toBeGreaterThanOrEqual(y + h - 0.5)
  expect(x - px.x).toBeLessThan(tolerance)
  expect(y - px.y).toBeLessThan(tolerance)
  expect(px.x + px.w - (x + w)).toBeLessThan(tolerance)
  expect(px.y + px.h - (y + h)).toBeLessThan(tolerance)
}

describe('detectItems', () => {
  it('白背景に格子状に並んだ商品を、読む順ですべて検出する', () => {
    const img = new SyntheticImage(400, 300)
    const positions = drawGrid(img, 3, 4, { size: 70, gap: 24 })

    const rects = detectItems(img)

    expect(rects).toHaveLength(12)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 70))
  })

  it('JPEG のようなノイズがあっても検出できる', () => {
    const img = new SyntheticImage(400, 300)
    const positions = drawGrid(img, 3, 4, { size: 70, gap: 24 })
    img.addNoise(8)

    const rects = detectItems(img)

    expect(rects).toHaveLength(12)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 70))
  })

  it('商品の下の小さな文字（商品名など）は商品として数えない', () => {
    const img = new SyntheticImage(400, 320)
    const positions = drawGrid(img, 3, 4, { size: 70, gap: 30 })
    // 各商品の下に、細い「文字」のかたまりを置く
    for (const { x, y } of positions) img.fillRect(x + 20, y + 78, 30, 5, [40, 40, 40])

    const rects = detectItems(img)

    expect(rects).toHaveLength(12)
  })

  it('タイトルの文字のかたまりは、面積がそこそこあっても商品として数えない', () => {
    const img = new SyntheticImage(400, 380)
    // 上部に、商品の3割ほどの高さの「文字のかたまり」を3つ並べる
    img.fillRect(40, 16, 90, 24, [220, 80, 130])
    img.fillRect(150, 16, 100, 24, [220, 80, 130])
    img.fillRect(270, 16, 90, 24, [220, 80, 130])
    const positions = drawGrid(img, 3, 4, { size: 70, gap: 24, offsetX: 24, offsetY: 80 })

    const rects = detectItems(img)

    expect(rects).toHaveLength(12)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 70))
  })

  it('本体から少し離れた小さな部品（髪飾りなど）も、1つの枠にまとめる', () => {
    const img = new SyntheticImage(400, 300)
    const positions = drawGrid(img, 2, 3, { size: 80, gap: 40 })
    // 各商品の右上に、3px 離れた小さな部品を置く
    for (const { x, y } of positions) img.fillRect(x + 83, y + 6, 12, 12, [40, 40, 160])

    const rects = detectItems(img)

    expect(rects).toHaveLength(6)
    // 本体（80×80）と部品を合わせた 95×80 の範囲を囲む
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 95, 80))
  })

  it('すき間の細いカードの並びでも、すき間をまたぐ透かし文字があっても、1枚ずつ分ける', () => {
    const img = new SyntheticImage(420, 330)
    const positions = drawGrid(img, 3, 5, { size: 76, gap: 4, offsetX: 16, offsetY: 40 })
    // 各段の中央を横切る「SAMPLE」の透かし（すき間もまたぐ）
    for (let row = 0; row < 3; row++) {
      const y = 40 + row * 80 + 34
      img.fillRect(16, y, 396, 2, [90, 90, 90])
      img.fillRect(16, y + 8, 396, 2, [90, 90, 90])
    }

    const rects = detectItems(img)

    expect(rects).toHaveLength(15)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 76))
  })

  it('商品のすぐ下の商品名は、枠に含めない', () => {
    const img = new SyntheticImage(400, 300)
    const positions = drawGrid(img, 2, 3, { size: 80, gap: 40 })
    // 商品の 4px 下に、商品名の文字の帯を置く（クロージングで本体とつながる距離）
    for (const { x, y } of positions) img.fillRect(x + 10, y + 84, 60, 8, [40, 40, 40])

    const rects = detectItems(img)

    expect(rects).toHaveLength(6)
    rects.forEach((rect, i) => {
      expectToCover(rect, img, positions[i].x, positions[i].y, 80)
      expect((rect.y + rect.h) * img.height).toBeLessThan(positions[i].y + 84)
    })
  })

  it('色付きの台紙の上に並んだ商品も検出する', () => {
    const img = new SyntheticImage(420, 320, [250, 250, 250])
    // 画像の大部分を覆う台紙
    img.fillRect(20, 20, 380, 280, [255, 225, 235])
    const positions = drawGrid(img, 2, 3, { size: 80, gap: 30, offsetX: 55, offsetY: 60 })

    const rects = detectItems(img)

    expect(rects).toHaveLength(6)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 80))
  })

  it('背景が透明な PNG でも検出する', () => {
    const img = new SyntheticImage(300, 200, [0, 0, 0, 0])
    const positions = drawGrid(img, 2, 3, { size: 60, gap: 30 })

    const rects = detectItems(img)

    expect(rects).toHaveLength(6)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 60))
  })

  it('暗い背景でも検出する', () => {
    const img = new SyntheticImage(400, 300, [20, 20, 30])
    drawGrid(img, 3, 4, { size: 70, gap: 24 })

    expect(detectItems(img)).toHaveLength(12)
  })

  it('段ごとに高さがずれていても、左上から読む順に番号を振る', () => {
    const img = new SyntheticImage(400, 260)
    // 1段目：少しずつ上下にずらした3つ、2段目：2つ
    const expected = [
      { x: 20, y: 30 },
      { x: 150, y: 20 },
      { x: 280, y: 36 },
      { x: 60, y: 150 },
      { x: 220, y: 140 },
    ]
    for (const { x, y } of expected) img.fillRect(x, y, 80, 80, [90, 90, 200])

    const rects = detectItems(img)

    expect(rects).toHaveLength(5)
    rects.forEach((rect, i) => expectToCover(rect, img, expected[i].x, expected[i].y, 80))
  })

  it('何も写っていない画像では何も検出しない', () => {
    expect(detectItems(new SyntheticImage(200, 200))).toEqual([])
    expect(detectItems(new SyntheticImage(200, 200).addNoise(6))).toEqual([])
  })

  it('大きさが 0 の画像では何も検出しない', () => {
    expect(detectItems({ width: 0, height: 0, data: new Uint8ClampedArray() })).toEqual([])
  })

  it('背景とほとんど同じ色の商品は、感度を上げると検出できる', () => {
    const img = new SyntheticImage(300, 200)
    const positions = drawGrid(img, 2, 3, { size: 60, gap: 30 })
    // 1つ目だけ、背景（白）との色の距離が約 26 の、とても薄い色にする
    img.fillRect(positions[0].x, positions[0].y, 60, 60, [240, 240, 240])

    expect(detectItems(img, { sensitivity: 0 })).toHaveLength(5)
    expect(detectItems(img, { sensitivity: 100 })).toHaveLength(6)
  })
})

describe('sensitivityToThreshold', () => {
  it('感度が高いほど、しきい値（背景とみなす色の距離）が小さくなる', () => {
    expect(sensitivityToThreshold(0)).toBe(50)
    expect(sensitivityToThreshold(50)).toBe(30)
    expect(sensitivityToThreshold(100)).toBe(10)
    expect(sensitivityToThreshold(200)).toBe(10)
  })
})

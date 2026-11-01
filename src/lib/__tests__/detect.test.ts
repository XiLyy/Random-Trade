import { describe, expect, it } from 'vitest'
import { analysisScale, detectItems, sensitivityToThreshold } from '../detect'
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

/**
 * 写真のブロマイドを真似て、段ごとに中央寄せで 100×70 の写真を並べる。
 * 写真の背景は薄いグレーで、中に人物（濃い色）があり、下に商品名の色付きの帯がある。各写真の左上座標を返す
 */
function drawPhotoRows(img: SyntheticImage, counts: number[]): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = []
  counts.forEach((count, row) => {
    const y = 20 + row * 100
    const left = (img.width - (count * 100 + (count - 1) * 12)) / 2
    for (let c = 0; c < count; c++) {
      const x = left + c * 112
      img.fillRect(x, y, 100, 70, [232, 231, 236])
      img.fillRect(x + 35, y + 15, 30, 55, [150, 100, 90])
      img.fillRect(x + 20, y + 76, 60, 9, [120, 190, 200])
      positions.push({ x, y })
    }
  })
  return positions
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

  it('太い透かし文字が商品の上や間をまたいで全体がつながっていても、1枚ずつ分ける', () => {
    // 白背景に、薄いグレーの背景の写真が 3・2・3・2 枚。下に商品名の色付きの帯があり、
    // 写真の背景とほぼ同じ色の太い透かし文字が、斜めに写真とすき間をまたいでいる
    const img = new SyntheticImage(420, 420)
    const positions = drawPhotoRows(img, [3, 2, 3, 2])
    for (let i = 0; i < 6; i++) {
      img.drawLine(-40 + i * 90, 60 + i * 60, 120 + i * 90, 0 + i * 60, 5, [226, 226, 226])
      img.drawLine(-40 + i * 90, 380 - i * 50, 140 + i * 90, 320 - i * 50, 5, [226, 226, 226])
    }

    const rects = detectItems(img)

    expect(rects).toHaveLength(10)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 100, 70))
  })

  it('写真の背景の一部が背景とほぼ同じ色でも、写真のふちまで枠に含める', () => {
    const img = new SyntheticImage(420, 420)
    const positions = drawPhotoRows(img, [3, 2, 3, 2])
    // 2枚目の左 3 割だけ、照明で明るくなって背景（白）との色の距離が約 20 になっている
    img.fillRect(positions[1].x, positions[1].y, 30, 70, [243, 243, 247])

    const rects = detectItems(img)

    expect(rects).toHaveLength(10)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 100, 70))
  })

  it('枠と見出しのある台紙で、枠線と同じ色の商品も検出する', () => {
    // 紫の外枠の中に、濃い紺の細い枠線で囲まれた白い台紙と見出しがある。商品は枠線と同じ紺色を含む
    const img = new SyntheticImage(600, 220, [146, 151, 194])
    img.fillRect(10, 8, 580, 34, [255, 255, 255])
    img.fillRect(30, 18, 200, 14, [98, 104, 157])
    img.fillRect(10, 50, 580, 162, [255, 255, 255])
    for (const [x, y, w, h] of [
      [10, 50, 580, 2],
      [10, 210, 580, 2],
      [10, 50, 2, 162],
      [588, 50, 2, 162],
    ]) {
      img.fillRect(x, y, w, h, [98, 104, 157])
    }
    const positions: { x: number; y: number }[] = []
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 90
      img.fillRect(x, 70, 60, 120, [98, 104, 157])
      img.fillRect(x + 10, 80, 40, 30, [240, 200, 170])
      img.fillRect(x, 170, 60, 20, [220, 120, 150])
      positions.push({ x, y: 70 })
    }

    const rects = detectItems(img)

    expect(rects).toHaveLength(6)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 60, 120))
  })

  it('長くて細い線（注記の括弧など）で商品どうしがつながっていても、1つずつ分ける', () => {
    const img = new SyntheticImage(400, 300)
    const positions = drawGrid(img, 2, 3, { size: 80, gap: 40, offsetY: 60 })
    // 1段目の上に、2つの商品をまたぐ括弧（横線と、商品まで下りる縦線）
    img.fillRect(40, 45, 200, 2, [90, 90, 90])
    img.fillRect(40, 45, 2, 15, [90, 90, 90])
    img.fillRect(238, 45, 2, 15, [90, 90, 90])

    const rects = detectItems(img)

    expect(rects).toHaveLength(6)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 80))
  })

  it('商品にくっついたロゴや、形の違う価格の表記は商品として数えない', () => {
    const img = new SyntheticImage(440, 400)
    const positions = drawGrid(img, 3, 4, { size: 70, gap: 30, offsetX: 30, offsetY: 70 })
    // 右上の商品のすぐ上に、細い線で商品とつながった「NEW」のロゴ
    img.fillRect(340, 20, 90, 40, [200, 170, 60])
    img.fillRect(400, 60, 3, 10, [200, 170, 60])
    // 下に、横長の価格の表記
    img.fillRect(250, 360, 170, 30, [90, 100, 160])

    const rects = detectItems(img)

    expect(rects).toHaveLength(12)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 70))
  })

  it('外枠と似た色の部品（キーホルダーのリングなど）も、枠に含める', () => {
    // 左右に紫の外枠がある白い台紙。商品の上に、外枠と似た色（色の距離が約 20）のリングが付いている
    const img = new SyntheticImage(400, 300)
    img.fillRect(0, 0, 20, 300, [145, 150, 194])
    img.fillRect(380, 0, 20, 300, [145, 150, 194])
    const positions: { x: number; y: number }[] = []
    for (let i = 0; i < 4; i++) {
      const x = 50 + i * 80
      img.fillRect(x + 10, 60, 30, 30, [150, 165, 205])
      img.fillRect(x, 90, 50, 120, [230, 120, 150])
      positions.push({ x, y: 60 })
    }

    const rects = detectItems(img)

    expect(rects).toHaveLength(4)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 50, 150))
  })

  it('格子に並んだ商品が下の注記の文字とくっついていても、その升目の商品を数える', () => {
    const img = new SyntheticImage(440, 360)
    const positions = drawGrid(img, 2, 4, { size: 80, gap: 30, offsetX: 30, offsetY: 30 })
    // 2段目の左の2つの商品の真下に、すき間なく注記の文字の帯があり、その下にセット内容の表記がある
    img.fillRect(10, 220, 220, 12, [60, 60, 60])
    img.fillRect(10, 238, 190, 30, [90, 100, 160])

    const rects = detectItems(img)

    expect(rects).toHaveLength(8)
    rects.forEach((rect, i) => expectToCover(rect, img, positions[i].x, positions[i].y, 80))
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

describe('analysisScale', () => {
  it('画素数が 512×512 を超えないように縮小する', () => {
    expect(analysisScale(1000, 1000)).toBeCloseTo(0.512)
    expect(analysisScale(400, 300)).toBe(1)
  })

  it('横長の画像は、長辺 512px より大きく残す（商品が小さくなりすぎないように）', () => {
    const scale = analysisScale(2576, 850)
    expect(2576 * scale).toBeGreaterThan(800)
    expect(2576 * scale * 850 * scale).toBeLessThanOrEqual(512 * 512 + 1)
  })

  it('とても細長い画像では、長辺を 1024px までにする', () => {
    expect(10000 * analysisScale(10000, 20)).toBeCloseTo(1024)
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

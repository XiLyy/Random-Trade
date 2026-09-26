import { describe, expect, it } from 'vitest'
import { clampRect, gridRects, intersectionArea, rectFromPoints, sortByReadingOrder, unionAll } from '../geometry'

describe('gridRects', () => {
  it('範囲を行×列に均等分割し、読む順で返す', () => {
    const rects = gridRects(2, 3)
    expect(rects).toHaveLength(6)
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 1 / 3, h: 0.5 })
    expect(rects[2].x).toBeCloseTo(2 / 3)
    expect(rects[3]).toEqual({ x: 0, y: 0.5, w: 1 / 3, h: 0.5 })
  })

  it('指定した範囲の中だけを分割する', () => {
    const rects = gridRects(1, 2, { x: 0.1, y: 0.2, w: 0.8, h: 0.4 })
    expect(rects).toEqual([
      { x: 0.1, y: 0.2, w: 0.4, h: 0.4 },
      { x: 0.5, y: 0.2, w: 0.4, h: 0.4 },
    ])
  })

  it('0 以下の行数・列数は 1 として扱う', () => {
    expect(gridRects(0, -3)).toHaveLength(1)
  })
})

describe('sortByReadingOrder', () => {
  it('同じ段の中は左から、段は上から並べる', () => {
    const rects = [
      { x: 0.6, y: 0.52, w: 0.2, h: 0.3 },
      { x: 0.1, y: 0.1, w: 0.2, h: 0.3 },
      { x: 0.1, y: 0.5, w: 0.2, h: 0.3 },
      { x: 0.6, y: 0.05, w: 0.2, h: 0.3 },
    ]
    expect(sortByReadingOrder(rects, (r) => r)).toEqual([rects[1], rects[3], rects[2], rects[0]])
  })
})

describe('矩形の補助関数', () => {
  it('rectFromPoints はドラッグの向きに関係なく正の大きさの矩形を作る', () => {
    expect(rectFromPoints(0.5, 0.6, 0.2, 0.1)).toEqual({ x: 0.2, y: 0.1, w: 0.3, h: 0.5 })
  })

  it('clampRect は画像の外にはみ出た矩形を内側に戻し、最小サイズを保証する', () => {
    expect(clampRect({ x: 0.9, y: -0.2, w: 0.3, h: 0.001 })).toEqual({ x: 0.7, y: 0, w: 0.3, h: 0.01 })
  })

  it('intersectionArea と unionAll', () => {
    const a = { x: 0, y: 0, w: 0.5, h: 0.5 }
    const b = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }
    expect(intersectionArea(a, b)).toBeCloseTo(0.0625)
    expect(intersectionArea(a, { x: 0.6, y: 0.6, w: 0.1, h: 0.1 })).toBe(0)
    expect(unionAll([a, b])).toEqual({ x: 0, y: 0, w: 0.75, h: 0.75 })
    expect(unionAll([])).toBeNull()
  })
})

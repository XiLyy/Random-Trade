import { describe, expect, it } from 'vitest'
import { MAX_OUTPUT_SIDE, planOutput } from '../render'
import type { ItemStatus, OutputOptions, TradeItem } from '../types'

const plain: OutputOptions = { dimOthers: false }

function item(status: ItemStatus, x: number, extraCount = 1): TradeItem {
  return { id: `${status}-${x}`, rect: { x, y: 0.1, w: 0.2, h: 0.4 }, name: '', status, extraCount }
}

describe('planOutput', () => {
  const items = [item('extra', 0, 3), item('wanted', 0.25), item('owned', 0.5), item('none', 0.75)]

  it('譲・求の商品だけにマークを付け、枠をピクセル座標に変換する', () => {
    const plan = planOutput({ sourceWidth: 1000, sourceHeight: 500, items, options: plain })

    expect(plan.marks.map((m) => [m.status, m.badge.label, m.badge.count])).toEqual([
      ['extra', '譲', '×3'],
      ['wanted', '求', null],
    ])
    expect(plan.marks[1].rect).toEqual({ x: 250, y: 50, w: 200, h: 200 })
    expect(plan.dims).toEqual([])
  })

  it('出力画像は元の画像と同じ大きさで、タイトルや凡例の帯を足さない', () => {
    const plan = planOutput({ sourceWidth: 1000, sourceHeight: 500, items, options: plain })
    expect([plan.width, plan.height]).toEqual([1000, 500])
  })

  it('対象外を薄くするオプションで、所持・未選択の商品を薄くする範囲に入れる', () => {
    const plan = planOutput({ sourceWidth: 1000, sourceHeight: 500, items, options: { dimOthers: true } })
    expect(plan.dims).toHaveLength(2)
  })

  it('長辺が上限を超える画像は縮小して出力する', () => {
    const plan = planOutput({ sourceWidth: 8000, sourceHeight: 6000, items, options: plain })
    expect(plan.width).toBe(MAX_OUTPUT_SIDE)
    expect(plan.height).toBe(3072)
    expect(plan.marks[0].rect.w).toBeCloseTo(0.2 * MAX_OUTPUT_SIDE)
  })

  it('バッジは小さな商品でも枠からはみ出しすぎない', () => {
    const tiny: TradeItem = { ...item('wanted', 0), rect: { x: 0, y: 0, w: 0.02, h: 0.02 } }
    const plan = planOutput({ sourceWidth: 2000, sourceHeight: 2000, items: [tiny], options: plain })
    expect(plan.marks[0].badge.size).toBeLessThanOrEqual(0.02 * 2000 * 0.6)
  })
})

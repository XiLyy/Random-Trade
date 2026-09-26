import { describe, expect, it } from 'vitest'
import { MAX_OUTPUT_SIDE, planOutput, wrapText, type MeasureText } from '../render'
import type { ItemStatus, OutputOptions, TradeItem } from '../types'

/** 1文字 = フォントサイズ分の幅、とみなす簡易的な計測 */
const measure: MeasureText = (text, font) => Array.from(text).length * Number(/(\d+)px/.exec(font)?.[1] ?? 10)

const noFooter: OutputOptions = { title: '', note: '', showLegend: false, dimOthers: false }

function item(status: ItemStatus, x: number, extraCount = 1): TradeItem {
  return { id: `${status}-${x}`, rect: { x, y: 0.1, w: 0.2, h: 0.4 }, name: '', status, extraCount }
}

describe('planOutput', () => {
  const items = [item('extra', 0, 3), item('wanted', 0.25), item('owned', 0.5), item('none', 0.75)]

  it('譲・求の商品だけにマークを付け、枠をピクセル座標に変換する', () => {
    const plan = planOutput({ sourceWidth: 1000, sourceHeight: 500, items, options: noFooter, measure })

    expect(plan.width).toBe(1000)
    expect(plan.height).toBe(500)
    expect(plan.marks.map((m) => [m.status, m.badge.label, m.badge.count])).toEqual([
      ['extra', '譲', '×3'],
      ['wanted', '求', null],
    ])
    expect(plan.marks[1].rect).toEqual({ x: 250, y: 50, w: 200, h: 200 })
    expect(plan.dims).toEqual([])
    expect(plan.footer).toBeNull()
  })

  it('対象外を薄くするオプションで、所持・未選択の商品を薄くする範囲に入れる', () => {
    const plan = planOutput({ sourceWidth: 1000, sourceHeight: 500, items, options: { ...noFooter, dimOthers: true }, measure })
    expect(plan.dims).toHaveLength(2)
  })

  it('長辺が上限を超える画像は縮小して出力する', () => {
    const plan = planOutput({ sourceWidth: 8000, sourceHeight: 6000, items, options: noFooter, measure })
    expect(plan.width).toBe(MAX_OUTPUT_SIDE)
    expect(plan.height).toBe(3072)
    expect(plan.marks[0].rect.w).toBeCloseTo(0.2 * MAX_OUTPUT_SIDE)
  })

  it('凡例・タイトル・メモをフッターとして画像の下に足す', () => {
    const plan = planOutput({
      sourceWidth: 1000,
      sourceHeight: 500,
      items,
      options: { title: '缶バッジ', note: '郵送のみ', showLegend: true, dimOthers: false },
      measure,
    })

    expect(plan.footer).not.toBeNull()
    expect(plan.footer!.y).toBe(500)
    expect(plan.height).toBe(500 + plan.footer!.height)
    expect(plan.footer!.lines.map((l) => [l.kind, l.status, l.text])).toEqual([
      ['title', undefined, '缶バッジ'],
      ['legend', 'extra', 'お譲りできます（1種・計3個）'],
      ['legend', 'wanted', '探しています（1種）'],
      ['note', undefined, '郵送のみ'],
    ])
    // 行は上から順に並ぶ
    const ys = plan.footer!.lines.map((l) => l.y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
  })

  it('凡例をオンにしても、譲・求がない行は出さない', () => {
    const plan = planOutput({
      sourceWidth: 1000,
      sourceHeight: 500,
      items: [item('extra', 0)],
      options: { ...noFooter, showLegend: true },
      measure,
    })
    expect(plan.footer!.lines.map((l) => l.text)).toEqual(['お譲りできます（1種）'])
  })

  it('バッジは小さな商品でも枠からはみ出しすぎない', () => {
    const tiny: TradeItem = { ...item('wanted', 0), rect: { x: 0, y: 0, w: 0.02, h: 0.02 } }
    const plan = planOutput({ sourceWidth: 2000, sourceHeight: 2000, items: [tiny], options: noFooter, measure })
    expect(plan.marks[0].badge.size).toBeLessThanOrEqual(0.02 * 2000 * 0.6)
  })
})

describe('wrapText', () => {
  it('幅に収まるように1文字ずつ折り返し、改行も保つ', () => {
    expect(wrapText('あいうえおかき\nく', 30, 'bold 10px sans-serif', measure)).toEqual(['あいう', 'えおか', 'き', 'く'])
  })
})

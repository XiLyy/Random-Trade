import { describe, expect, it } from 'vitest'
import { countByStatus, displayName, hasTradeTargets, toggleStatus } from '../status'
import { buildTradeText } from '../text'
import type { ItemStatus, TradeItem } from '../types'

function item(status: ItemStatus, extra: Partial<TradeItem> = {}): TradeItem {
  return { id: Math.random().toString(), rect: { x: 0, y: 0, w: 0.1, h: 0.1 }, name: '', status, extraCount: 1, ...extra }
}

describe('toggleStatus', () => {
  it('オフの項目を押すとその項目だけがオンになる', () => {
    expect(toggleStatus('none', 'extra')).toBe('extra')
    expect(toggleStatus('owned', 'wanted')).toBe('wanted')
  })

  it('オンの項目をもう一度押すと未選択に戻る', () => {
    expect(toggleStatus('extra', 'extra')).toBe('none')
  })

  it('クリア（none）を押すと常に未選択になる', () => {
    expect(toggleStatus('wanted', 'none')).toBe('none')
    expect(toggleStatus('none', 'none')).toBe('none')
  })
})

describe('displayName / countByStatus / hasTradeTargets', () => {
  it('名前が空欄なら No.番号 を表示名にする', () => {
    expect(displayName(item('none'), 2)).toBe('No.3')
    expect(displayName(item('none', { name: '  ルカ ' }), 0)).toBe('ルカ')
  })

  it('状態ごとの件数を数える', () => {
    const items = [item('extra'), item('extra'), item('wanted'), item('none')]
    expect(countByStatus(items)).toEqual({ none: 1, owned: 0, wanted: 1, extra: 2 })
    expect(hasTradeTargets(items)).toBe(true)
    expect(hasTradeTargets([item('owned'), item('none')])).toBe(false)
  })
})

describe('buildTradeText', () => {
  it('譲・求を番号順に列挙し、2個以上の余分には個数を付ける', () => {
    const items = [item('wanted'), item('extra', { extraCount: 2 }), item('owned'), item('extra', { name: 'ミク' }), item('wanted')]
    expect(buildTradeText(items, { title: '', note: '' })).toBe('【譲】No.2×2、ミク\n【求】No.1、No.5')
  })

  it('タイトルとメモを入れ、タイトルからハッシュタグを作る', () => {
    const items = [item('extra')]
    expect(buildTradeText(items, { title: ' 夏祭り 缶バッジ ', note: '郵送のみ' })).toBe(
      '夏祭り 缶バッジ\n【譲】No.1\n【求】なし\n郵送のみ\n#夏祭り缶バッジ交換',
    )
  })
})

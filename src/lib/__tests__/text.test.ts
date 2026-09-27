import { describe, expect, it } from 'vitest'
import { countByStatus, hasTradeTargets, toggleStatus } from '../status'
import { buildTradeText, buildTradeTextPreview, normalizeHashtags } from '../text'
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

describe('countByStatus / hasTradeTargets', () => {
  it('状態ごとの件数を数える', () => {
    const items = [item('extra'), item('extra'), item('wanted'), item('none')]
    expect(countByStatus(items)).toEqual({ none: 1, owned: 0, wanted: 1, extra: 2 })
    expect(hasTradeTargets(items)).toBe(true)
    expect(hasTradeTargets([item('owned'), item('none')])).toBe(false)
  })
})

describe('buildTradeText', () => {
  const empty = { header: '', note: '', hashtags: '' }

  it('名前を入れていない商品は、番号ではなく「画像で譲（求）と記載しているもの」と書く', () => {
    const items = [item('wanted'), item('extra', { extraCount: 2 }), item('owned'), item('extra'), item('wanted')]
    expect(buildTradeText(items, empty)).toBe('【譲】画像で譲と記載しているもの\n【求】画像で求と記載しているもの')
  })

  it('名前を入れた商品は名前で書き、2個以上の余分には個数を付ける', () => {
    const items = [item('extra', { name: ' ミク ', extraCount: 2 }), item('extra', { name: 'ルカ' }), item('wanted', { name: 'リン' })]
    expect(buildTradeText(items, empty)).toBe('【譲】ミク×2、ルカ\n【求】リン')
  })

  it('名前がある商品とない商品が混ざるときは、名前のあとに「ほか画像で…」を付ける', () => {
    const items = [item('extra', { name: 'ミク' }), item('extra'), item('wanted')]
    expect(buildTradeText(items, empty)).toBe('【譲】ミク、ほか画像で譲と記載しているもの\n【求】画像で求と記載しているもの')
  })

  it('譲がなく求だけのときは、譲の行を「定価」にする', () => {
    expect(buildTradeText([item('wanted'), item('owned')], empty)).toBe('【譲】定価\n【求】画像で求と記載しているもの')
  })

  it('求がないときは「なし」、どちらもないときは両方「なし」', () => {
    expect(buildTradeText([item('extra')], empty)).toBe('【譲】画像で譲と記載しているもの\n【求】なし')
    expect(buildTradeText([item('owned')], empty)).toBe('【譲】なし\n【求】なし')
  })

  it('ヘッダ・補足・ハッシュタグを、それぞれ独立して入れる', () => {
    const items = [item('extra')]
    expect(
      buildTradeText(items, {
        header: ' 【交換】〇〇 LIVE TOUR 2026 ランダムブロマイド ',
        note: '郵送のみ',
        hashtags: '〇〇交換 #〇〇譲渡',
      }),
    ).toBe('【交換】〇〇 LIVE TOUR 2026 ランダムブロマイド\n【譲】画像で譲と記載しているもの\n【求】なし\n郵送のみ\n#〇〇交換 #〇〇譲渡')
  })

  it('ヘッダからハッシュタグを作らない', () => {
    expect(buildTradeText([item('wanted')], { ...empty, header: '夏祭り 缶バッジ' })).toBe(
      '夏祭り 缶バッジ\n【譲】定価\n【求】画像で求と記載しているもの',
    )
  })
})

describe('buildTradeTextPreview', () => {
  it('画像を選ぶ前に、名前を入れない場合の形で募集文の見本を作る', () => {
    expect(buildTradeTextPreview({ header: '【交換】〇〇', note: '', hashtags: '〇〇交換' })).toBe(
      '【交換】〇〇\n【譲】画像で譲と記載しているもの\n【求】画像で求と記載しているもの\n#〇〇交換',
    )
  })
})

describe('normalizeHashtags', () => {
  it('空白（全角も）や読点で区切り、# を付け、全角の＃を半角にし、重複をまとめる', () => {
    expect(normalizeHashtags('〇〇交換　＃〇〇譲渡, #〇〇交換、 ##求 ')).toEqual(['#〇〇交換', '#〇〇譲渡', '#求'])
  })

  it('空なら空の配列', () => {
    expect(normalizeHashtags('   ')).toEqual([])
  })
})

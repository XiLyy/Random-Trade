import { TRADE_MARKS } from './status'
import type { PostSettings, TradeItem } from './types'

/**
 * ハッシュタグの入力をそろえる。空白（全角も含む）や読点で区切り、
 * # が付いていなければ付け、全角の＃は半角にし、重複は1つにまとめる。
 */
export function normalizeHashtags(input: string): string[] {
  const tags: string[] = []
  for (const token of input.split(/[\s　,、]+/)) {
    const word = token.replace(/^[#＃]+/, '')
    if (!word) continue
    const tag = `#${word}`
    if (!tags.includes(tag)) tags.push(tag)
  }
  return tags
}

/** 名前を入れていない商品は、番号の代わりにこの言い方でまとめて示す */
export function imageReference(status: 'extra' | 'wanted'): string {
  return `画像で${TRADE_MARKS[status]}と記載しているもの`
}

/** 譲、または求の商品を募集文の1行分の文にする。対象がなければ null */
function describeItems(items: TradeItem[], status: 'extra' | 'wanted'): string | null {
  const targets = items.filter((item) => item.status === status)
  if (targets.length === 0) return null
  const named = targets
    .filter((item) => item.name.trim())
    .map((item) => {
      const name = item.name.trim()
      return status === 'extra' && item.extraCount > 1 ? `${name}×${item.extraCount}` : name
    })
  if (named.length === targets.length) return named.join('、')
  if (named.length === 0) return imageReference(status)
  return `${named.join('、')}、ほか${imageReference(status)}`
}

/**
 * SNS に貼り付ける募集文を作る。
 * - 名前を入れた商品は名前で、入れていない商品は「画像で譲（求）と記載しているもの」で示す
 * - 譲がなく求だけのときは、譲の行を「定価」にする（定価で買い取る、という意味の慣用表現）
 */
export function buildTradeText(items: TradeItem[], settings: PostSettings): string {
  const extras = describeItems(items, 'extra')
  const wanted = describeItems(items, 'wanted')
  return composePost(settings, extras ?? (wanted ? '定価' : 'なし'), wanted ?? 'なし')
}

/** 画像を選ぶ前に、募集文がどうなるかを見せるための見本（名前を入れない場合の形） */
export function buildTradeTextPreview(settings: PostSettings): string {
  return composePost(settings, imageReference('extra'), imageReference('wanted'))
}

function composePost(settings: PostSettings, extras: string, wanted: string): string {
  const header = settings.header.trim()
  const note = settings.note.trim()
  const hashtags = normalizeHashtags(settings.hashtags)
  const lines: string[] = []
  if (header) lines.push(header)
  lines.push(`【譲】${extras}`)
  lines.push(`【求】${wanted}`)
  if (note) lines.push(note)
  if (hashtags.length > 0) lines.push(hashtags.join(' '))
  return lines.join('\n')
}

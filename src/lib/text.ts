import { displayName } from './status'
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

/** SNS に貼り付ける募集文を作る */
export function buildTradeText(items: TradeItem[], settings: PostSettings): string {
  const extras: string[] = []
  const wanted: string[] = []
  items.forEach((item, index) => {
    const name = displayName(item, index)
    if (item.status === 'extra') extras.push(item.extraCount > 1 ? `${name}×${item.extraCount}` : name)
    if (item.status === 'wanted') wanted.push(name)
  })
  return composePost(
    settings,
    extras.length > 0 ? extras.join('、') : 'なし',
    wanted.length > 0 ? wanted.join('、') : 'なし',
  )
}

/** 画像を選ぶ前に、募集文がどうなるかを見せるための見本 */
export function buildTradeTextPreview(settings: PostSettings): string {
  return composePost(settings, '（チェックした商品が入ります）', '（チェックした商品が入ります）')
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

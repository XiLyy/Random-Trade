import { displayName } from './status'
import type { TradeItem } from './types'

export interface TradeTextOptions {
  title: string
  note: string
}

/** SNS に貼り付ける募集テキストを作る */
export function buildTradeText(items: TradeItem[], options: TradeTextOptions): string {
  const extras: string[] = []
  const wanted: string[] = []
  items.forEach((item, index) => {
    const name = displayName(item, index)
    if (item.status === 'extra') extras.push(item.extraCount > 1 ? `${name}×${item.extraCount}` : name)
    if (item.status === 'wanted') wanted.push(name)
  })

  const title = options.title.trim()
  const note = options.note.trim()
  const lines: string[] = []
  if (title) lines.push(title)
  lines.push(`【譲】${extras.length > 0 ? extras.join('、') : 'なし'}`)
  lines.push(`【求】${wanted.length > 0 ? wanted.join('、') : 'なし'}`)
  if (note) lines.push(note)
  const tag = title.replace(/[\s#＃]+/g, '')
  if (tag) lines.push(`#${tag}交換`)
  return lines.join('\n')
}

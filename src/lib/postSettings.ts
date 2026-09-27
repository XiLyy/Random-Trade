import type { PostSettings } from './types'

/** 募集文の設定を、次に開いたときも使えるようにこの端末のブラウザに保存する */
const STORAGE_KEY = 'random-trade:post-settings'

export const EMPTY_POST_SETTINGS: PostSettings = { header: '', note: '', hashtags: '' }

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** プライベートブラウズなどで localStorage が使えないときは null */
function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadPostSettings(storage: StorageLike | null = defaultStorage()): PostSettings {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_POST_SETTINGS
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return EMPTY_POST_SETTINGS
    const record = value as Record<string, unknown>
    const text = (key: keyof PostSettings) => (typeof record[key] === 'string' ? (record[key] as string) : '')
    return { header: text('header'), note: text('note'), hashtags: text('hashtags') }
  } catch {
    return EMPTY_POST_SETTINGS
  }
}

export function savePostSettings(settings: PostSettings, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 保存できなくても、その場の作業は続けられるので無視する
  }
}

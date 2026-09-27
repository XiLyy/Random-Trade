import { describe, expect, it } from 'vitest'
import { EMPTY_POST_SETTINGS, loadPostSettings, savePostSettings } from '../postSettings'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe('募集文の設定の保存', () => {
  it('保存した設定を読み込める', () => {
    const storage = memoryStorage()
    const settings = { header: '【交換】〇〇', note: '郵送のみ', hashtags: '〇〇交換' }
    savePostSettings(settings, storage)
    expect(loadPostSettings(storage)).toEqual(settings)
  })

  it('保存がない・壊れている・型が違うときは空の設定にする', () => {
    expect(loadPostSettings(memoryStorage())).toEqual(EMPTY_POST_SETTINGS)
    expect(loadPostSettings(memoryStorage({ 'random-trade:post-settings': '{壊れた' }))).toEqual(EMPTY_POST_SETTINGS)
    expect(loadPostSettings(memoryStorage({ 'random-trade:post-settings': '{"header":1,"note":"a"}' }))).toEqual({
      header: '',
      note: 'a',
      hashtags: '',
    })
  })

  it('ブラウザの保存領域が使えなくても、例外を出さずに続けられる', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadPostSettings(broken)).toEqual(EMPTY_POST_SETTINGS)
    expect(() => savePostSettings(EMPTY_POST_SETTINGS, broken)).not.toThrow()
    expect(loadPostSettings(null)).toEqual(EMPTY_POST_SETTINGS)
  })
})

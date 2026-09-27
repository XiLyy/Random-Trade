import { describe, expect, it } from 'vitest'
import { X_MAX_WEIGHTED_LENGTH, buildXIntentUrl, chooseXShareMethod, xWeightedLength } from '../share'

describe('xWeightedLength', () => {
  it('英数字は1、日本語は2と数える', () => {
    expect(xWeightedLength('abc 123')).toBe(7)
    expect(xWeightedLength('譲求')).toBe(4)
    expect(xWeightedLength('【譲】No.1')).toBe(10)
  })

  it('日本語だけなら140文字で上限になる', () => {
    expect(xWeightedLength('あ'.repeat(140))).toBe(X_MAX_WEIGHTED_LENGTH)
  })
})

describe('buildXIntentUrl', () => {
  it('改行やハッシュタグを含む文を、投稿画面の URL に入れる', () => {
    const url = new URL(buildXIntentUrl('【譲】定価\n#〇〇交換'))
    expect(url.origin + url.pathname).toBe('https://twitter.com/intent/tweet')
    expect(url.searchParams.get('text')).toBe('【譲】定価\n#〇〇交換')
  })
})

describe('chooseXShareMethod', () => {
  it('画像を共有できるスマホでは共有メニュー、それ以外は投稿画面を開く', () => {
    expect(chooseXShareMethod({ canShareFiles: true, touchDevice: true })).toBe('share-sheet')
    expect(chooseXShareMethod({ canShareFiles: true, touchDevice: false })).toBe('intent')
    expect(chooseXShareMethod({ canShareFiles: false, touchDevice: true })).toBe('intent')
  })
})

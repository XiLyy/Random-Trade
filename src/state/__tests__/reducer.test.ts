import { describe, expect, it } from 'vitest'
import type { LoadedImage } from '../../lib/types'
import { initialState, reducer, type Action, type AppState } from '../reducer'

const image = { url: 'blob:test', width: 100, height: 100, name: 'a.png' } as LoadedImage

function run(...actions: Action[]): AppState {
  return actions.reduce(reducer, initialState)
}

describe('reducer', () => {
  it('認識結果で商品を作り、読む順に並べる', () => {
    const state = run(
      { type: 'imageLoaded', image },
      {
        type: 'replaceRects',
        rects: [
          { x: 0.5, y: 0, w: 0.2, h: 0.2 },
          { x: 0, y: 0, w: 0.2, h: 0.2 },
        ],
      },
    )
    expect(state.items.map((i) => i.rect.x)).toEqual([0, 0.5])
    expect(state.items.every((i) => i.status === 'none' && i.extraCount === 1)).toBe(true)
    expect(new Set(state.items.map((i) => i.id)).size).toBe(2)
  })

  it('追加・移動のたびに番号を振り直し、追加した枠を選択する', () => {
    let state = run({ type: 'replaceRects', rects: [{ x: 0.5, y: 0, w: 0.2, h: 0.2 }] })
    state = reducer(state, { type: 'addItem', rect: { x: 0, y: 0, w: 0.2, h: 0.2 } })
    expect(state.items[0].id).toBe(state.selectedId)

    const movedId = state.items[0].id
    state = reducer(state, { type: 'updateRect', id: movedId, rect: { x: 0.8, y: 0, w: 0.2, h: 0.2 } })
    expect(state.items[1].id).toBe(movedId)
  })

  it('チェックは1商品につき1つだけ。もう一度押すと外れる', () => {
    let state = run({ type: 'replaceRects', rects: [{ x: 0, y: 0, w: 0.2, h: 0.2 }] })
    const id = state.items[0].id
    state = reducer(state, { type: 'toggleStatus', id, status: 'owned' })
    state = reducer(state, { type: 'toggleStatus', id, status: 'extra' })
    expect(state.items[0].status).toBe('extra')
    state = reducer(state, { type: 'toggleStatus', id, status: 'extra' })
    expect(state.items[0].status).toBe('none')
  })

  it('余分の個数は 1〜99 に収める', () => {
    let state = run({ type: 'replaceRects', rects: [{ x: 0, y: 0, w: 0.2, h: 0.2 }] })
    const id = state.items[0].id
    state = reducer(state, { type: 'setExtraCount', id, count: 150 })
    expect(state.items[0].extraCount).toBe(99)
    state = reducer(state, { type: 'setExtraCount', id, count: 0 })
    expect(state.items[0].extraCount).toBe(1)
    state = reducer(state, { type: 'setExtraCount', id, count: Number.NaN })
    expect(state.items[0].extraCount).toBe(1)
  })

  it('削除すると選択も解除する', () => {
    let state = run({ type: 'addItem', rect: { x: 0, y: 0, w: 0.2, h: 0.2 } })
    state = reducer(state, { type: 'removeItem', id: state.items[0].id })
    expect(state.items).toEqual([])
    expect(state.selectedId).toBeNull()
  })

  it('新しい画像を読み込むと、商品をリセットするが ID は使い回さない', () => {
    const before = run({ type: 'addItem', rect: { x: 0, y: 0, w: 0.2, h: 0.2 } })
    const after = reducer(reducer(before, { type: 'imageLoaded', image }), {
      type: 'addItem',
      rect: { x: 0, y: 0, w: 0.2, h: 0.2 },
    })
    expect(after.items).toHaveLength(1)
    expect(after.items[0].id).not.toBe(before.items[0].id)
    expect(after.image).toBe(image)
  })
})

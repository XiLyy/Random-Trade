import { clampRect, sortByReadingOrder } from '../lib/geometry'
import { MAX_EXTRA_COUNT, toggleStatus } from '../lib/status'
import type { ItemStatus, LoadedImage, Rect, TradeItem } from '../lib/types'

/** edit: 枠の調整 / check: チェック入力 */
export type Mode = 'edit' | 'check'

export interface AppState {
  image: LoadedImage | null
  items: TradeItem[]
  selectedId: string | null
  mode: Mode
  nextId: number
}

export const initialState: AppState = {
  image: null,
  items: [],
  selectedId: null,
  mode: 'check',
  nextId: 1,
}

export type Action =
  | { type: 'imageLoaded'; image: LoadedImage }
  | { type: 'replaceRects'; rects: Rect[] }
  | { type: 'addItem'; rect: Rect }
  | { type: 'updateRect'; id: string; rect: Rect }
  | { type: 'removeItem'; id: string }
  | { type: 'clearItems' }
  | { type: 'toggleStatus'; id: string; status: ItemStatus }
  | { type: 'setExtraCount'; id: string; count: number }
  | { type: 'rename'; id: string; name: string }
  | { type: 'select'; id: string | null }
  | { type: 'setMode'; mode: Mode }
  | { type: 'reset' }

function newItem(id: number, rect: Rect): TradeItem {
  return { id: `item-${id}`, rect: clampRect(rect), name: '', status: 'none', extraCount: 1 }
}

/** 番号（No.）は常に読む順（左上→右下）で振り直す */
function sorted(items: TradeItem[]): TradeItem[] {
  return sortByReadingOrder(items, (item) => item.rect)
}

function updateItem(state: AppState, id: string, update: (item: TradeItem) => TradeItem): AppState {
  return { ...state, items: state.items.map((item) => (item.id === id ? update(item) : item)) }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'imageLoaded':
      return { ...initialState, image: action.image, nextId: state.nextId }

    case 'replaceRects': {
      const items = action.rects.map((rect, i) => newItem(state.nextId + i, rect))
      return { ...state, items: sorted(items), selectedId: null, nextId: state.nextId + items.length }
    }

    case 'addItem': {
      const item = newItem(state.nextId, action.rect)
      return { ...state, items: sorted([...state.items, item]), selectedId: item.id, nextId: state.nextId + 1 }
    }

    case 'updateRect': {
      const next = updateItem(state, action.id, (item) => ({ ...item, rect: clampRect(action.rect) }))
      return { ...next, items: sorted(next.items) }
    }

    case 'removeItem':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      }

    case 'clearItems':
      return { ...state, items: [], selectedId: null }

    case 'toggleStatus':
      return updateItem(state, action.id, (item) => ({ ...item, status: toggleStatus(item.status, action.status) }))

    case 'setExtraCount': {
      const count = Number.isFinite(action.count) ? Math.round(action.count) : 1
      return updateItem(state, action.id, (item) => ({
        ...item,
        extraCount: Math.min(MAX_EXTRA_COUNT, Math.max(1, count)),
      }))
    }

    case 'rename':
      return updateItem(state, action.id, (item) => ({ ...item, name: action.name }))

    case 'select':
      return { ...state, selectedId: action.id }

    case 'setMode':
      return { ...state, mode: action.mode }

    case 'reset':
      return { ...initialState, nextId: state.nextId }
  }
}

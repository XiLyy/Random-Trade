import { useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent } from 'react'
import { clamp, rectFromPoints } from '../lib/geometry'
import type { ItemStatus, LoadedImage, Rect, TradeItem } from '../lib/types'
import type { Action, Mode } from '../state/reducer'
import { STATUS_BADGES } from './labels'
import { useElementWidth } from './useElementWidth'

interface Props {
  image: LoadedImage
  items: TradeItem[]
  selectedId: string | null
  mode: Mode
  /** チェックモードで、商品をタップしたときに付ける状態 */
  brush: ItemStatus
  dispatch: Dispatch<Action>
}

type Drag =
  | { kind: 'create'; startX: number; startY: number; rect: Rect }
  | { kind: 'move'; id: string; offsetX: number; offsetY: number; rect: Rect; moved: boolean }
  | { kind: 'resize'; id: string; rect: Rect }

const STATUS_COLORS: Record<ItemStatus, { stroke: string; fill: string }> = {
  none: { stroke: 'var(--accent)', fill: 'rgba(124, 77, 255, 0.06)' },
  owned: { stroke: 'var(--owned)', fill: 'rgba(17, 24, 39, 0.38)' },
  wanted: { stroke: 'var(--wanted)', fill: 'rgba(43, 108, 230, 0.2)' },
  extra: { stroke: 'var(--extra)', fill: 'rgba(232, 56, 79, 0.2)' },
}

/** 枠を追加・リサイズするときの最小サイズ（画面上のピクセル） */
const MIN_SCREEN_SIZE = 12

export function ImageEditor({ image, items, selectedId, mode, brush, dispatch }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const displayWidth = useElementWidth(containerRef)
  const [drag, setDrag] = useState<Drag | null>(null)

  const { width: W, height: H } = image
  // 画面上の 1px が画像の何ピクセルにあたるか。ラベルの大きさを画面基準でそろえるのに使う
  const unit = displayWidth > 0 ? W / displayWidth : 1
  const minW = MIN_SCREEN_SIZE / Math.max(displayWidth, 1)
  const minH = (minW * W) / H
  const editing = mode === 'edit'

  const pointAt = (e: PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    return {
      x: clamp((e.clientX - box.left) / box.width, 0, 1),
      y: clamp((e.clientY - box.top) / box.height, 0, 1),
    }
  }

  const startDrag = (e: PointerEvent, next: Drag) => {
    svgRef.current?.setPointerCapture(e.pointerId)
    setDrag(next)
  }

  const handleBackgroundDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!editing || e.button !== 0) return
    const p = pointAt(e)
    dispatch({ type: 'select', id: null })
    startDrag(e, { kind: 'create', startX: p.x, startY: p.y, rect: { x: p.x, y: p.y, w: 0, h: 0 } })
  }

  const handleItemDown = (e: PointerEvent, item: TradeItem) => {
    if (!editing || e.button !== 0) return
    e.stopPropagation()
    const p = pointAt(e)
    dispatch({ type: 'select', id: item.id })
    startDrag(e, {
      kind: 'move',
      id: item.id,
      offsetX: p.x - item.rect.x,
      offsetY: p.y - item.rect.y,
      rect: item.rect,
      moved: false,
    })
  }

  const handleResizeDown = (e: PointerEvent, item: TradeItem) => {
    e.stopPropagation()
    startDrag(e, { kind: 'resize', id: item.id, rect: item.rect })
  }

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const p = pointAt(e)
    if (drag.kind === 'create') {
      setDrag({ ...drag, rect: rectFromPoints(drag.startX, drag.startY, p.x, p.y) })
    } else if (drag.kind === 'move') {
      const x = clamp(p.x - drag.offsetX, 0, 1 - drag.rect.w)
      const y = clamp(p.y - drag.offsetY, 0, 1 - drag.rect.h)
      setDrag({ ...drag, rect: { ...drag.rect, x, y }, moved: true })
    } else {
      const w = clamp(p.x - drag.rect.x, minW, 1 - drag.rect.x)
      const h = clamp(p.y - drag.rect.y, minH, 1 - drag.rect.y)
      setDrag({ ...drag, rect: { ...drag.rect, w, h } })
    }
  }

  const handlePointerUp = () => {
    if (!drag) return
    if (drag.kind === 'create') {
      if (drag.rect.w >= minW && drag.rect.h >= minH) dispatch({ type: 'addItem', rect: drag.rect })
    } else if (drag.kind === 'resize' || drag.moved) {
      dispatch({ type: 'updateRect', id: drag.id, rect: drag.rect })
    }
    setDrag(null)
  }

  const activate = (item: TradeItem) => {
    if (editing) {
      dispatch({ type: 'select', id: item.id })
    } else {
      dispatch({ type: 'toggleStatus', id: item.id, status: brush })
      dispatch({ type: 'select', id: item.id })
    }
  }

  const handleItemKeyDown = (e: KeyboardEvent, item: TradeItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate(item)
    }
  }

  /** ドラッグ中の枠は、確定前の位置で表示する */
  const displayRect = (item: TradeItem): Rect =>
    drag && drag.kind !== 'create' && drag.id === item.id ? drag.rect : item.rect
  const selectedItem = editing ? items.find((item) => item.id === selectedId) : undefined

  const labelH = 18 * unit
  const fontSize = 12 * unit

  const renderHandles = (item: TradeItem, rect: Rect) => {
    const x = rect.x * W
    const y = rect.y * H
    const w = rect.w * W
    const h = rect.h * H
    const number = items.indexOf(item) + 1
    return (
      <g>
        <g
          className="editor__delete"
          role="button"
          aria-label={`No.${number} の枠を削除`}
          onPointerDown={(e) => {
            e.stopPropagation()
            dispatch({ type: 'removeItem', id: item.id })
          }}
        >
          <circle cx={x + w} cy={y} r={16 * unit} fill="transparent" />
          <circle cx={x + w} cy={y} r={10 * unit} fill="var(--extra)" stroke="#fff" strokeWidth={2 * unit} />
          <path
            d={`M${x + w - 4 * unit},${y - 4 * unit} L${x + w + 4 * unit},${y + 4 * unit} M${x + w + 4 * unit},${y - 4 * unit} L${x + w - 4 * unit},${y + 4 * unit}`}
            stroke="#fff"
            strokeWidth={2 * unit}
            strokeLinecap="round"
          />
        </g>
        <g className="editor__handle" onPointerDown={(e) => handleResizeDown(e, item)}>
          <circle cx={x + w} cy={y + h} r={18 * unit} fill="transparent" />
          <circle cx={x + w} cy={y + h} r={8 * unit} fill="var(--accent)" stroke="#fff" strokeWidth={2 * unit} />
        </g>
      </g>
    )
  }

  return (
    <div
      ref={containerRef}
      className="editor"
      style={{ maxWidth: `min(100%, calc(72svh * ${W / H}))` }}
    >
      <img src={image.url} alt="アップロードしたラインナップ画像" draggable={false} />
      <svg
        ref={svgRef}
        className={`editor__overlay editor__overlay--${mode}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerDown={handleBackgroundDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {items.map((item, index) => {
          const rect = displayRect(item)
          const x = rect.x * W
          const y = rect.y * H
          const w = rect.w * W
          const h = rect.h * H
          const selected = item.id === selectedId
          const colors = STATUS_COLORS[editing ? 'none' : item.status]
          const badge = editing ? null : STATUS_BADGES[item.status]
          const number = String(index + 1)
          const numberW = (number.length * 7 + 10) * unit
          const badgeW = badge ? (badge.length * 13 + 10) * unit : 0

          return (
            <g key={item.id} className="editor__item">
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={3 * unit}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={selected ? 3.5 : 2}
                vectorEffect="non-scaling-stroke"
                pointerEvents="all"
                tabIndex={0}
                role="button"
                aria-label={`No.${number}${badge ? `（${badge}）` : ''}`}
                aria-pressed={editing ? selected : item.status !== 'none'}
                onPointerDown={(e) => handleItemDown(e, item)}
                onClick={() => !editing && activate(item)}
                onKeyDown={(e) => handleItemKeyDown(e, item)}
              />
              <g transform={`translate(${x}, ${y})`} pointerEvents="none">
                <rect width={numberW} height={labelH} rx={4 * unit} fill="rgba(17, 24, 39, 0.82)" />
                <text x={numberW / 2} y={labelH / 2} fontSize={fontSize} className="editor__label">
                  {number}
                </text>
              </g>
              {badge && (
                <g transform={`translate(${x + w - badgeW}, ${y})`} pointerEvents="none">
                  <rect width={badgeW} height={labelH * 1.2} rx={4 * unit} fill={colors.stroke} />
                  <text x={badgeW / 2} y={(labelH * 1.2) / 2} fontSize={fontSize * 1.1} className="editor__label">
                    {badge}
                  </text>
                </g>
              )}
            </g>
          )
        })}
        {/* 選択中の枠のハンドルは、ほかの枠に隠れないよう最前面に描く（枠の並び順は変えない） */}
        {selectedItem && renderHandles(selectedItem, displayRect(selectedItem))}
        {drag?.kind === 'create' && (
          <rect
            x={drag.rect.x * W}
            y={drag.rect.y * H}
            width={drag.rect.w * W}
            height={drag.rect.h * H}
            fill="rgba(124, 77, 255, 0.12)"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  )
}

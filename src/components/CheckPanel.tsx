import type { CSSProperties, Dispatch } from 'react'
import { MAX_EXTRA_COUNT, countByStatus } from '../lib/status'
import type { LoadedImage, TradeItem } from '../lib/types'
import type { Action } from '../state/reducer'
import { STATUS_OPTIONS } from './labels'

interface Props {
  image: LoadedImage
  items: TradeItem[]
  selectedId: string | null
  dispatch: Dispatch<Action>
}

/** 元画像を CSS の背景として切り抜き、商品のサムネイルにする（キャンバスを使わないので軽い） */
function thumbnailStyle(image: LoadedImage, item: TradeItem): CSSProperties {
  const { x, y, w, h } = item.rect
  const aspect = (w * image.width) / (h * image.height)
  return {
    aspectRatio: String(aspect),
    width: aspect >= 1 ? '100%' : 'auto',
    height: aspect >= 1 ? 'auto' : '100%',
    backgroundImage: `url("${image.url}")`,
    backgroundSize: `${100 / w}% ${100 / h}%`,
    backgroundPosition: `${w >= 1 ? 0 : (x / (1 - w)) * 100}% ${h >= 1 ? 0 : (y / (1 - h)) * 100}%`,
  }
}

export function CheckPanel({ image, items, selectedId, dispatch }: Props) {
  const counts = countByStatus(items)

  return (
    <section className="panel" aria-labelledby="check-heading">
      <h2 id="check-heading">チェック</h2>
      <p className="panel__hint">
        商品ごとに「所持」「未所持」「余分」から1つ選びます。もう一度押すと外れます。画像の上のボタンで状態を選んでから、画像の商品をタップしても付けられます。
      </p>
      <p className="panel__hint">
        名前を入れると、募集文にその名前が入ります。空欄の商品は「画像で譲（求）と記載しているもの」とまとめて書きます。
      </p>
      <dl className="summary">
        <div className="summary__item summary__item--extra">
          <dt>譲</dt>
          <dd>{counts.extra}</dd>
        </div>
        <div className="summary__item summary__item--wanted">
          <dt>求</dt>
          <dd>{counts.wanted}</dd>
        </div>
        <div className="summary__item summary__item--owned">
          <dt>所持</dt>
          <dd>{counts.owned}</dd>
        </div>
        <div className="summary__item">
          <dt>未選択</dt>
          <dd>{counts.none}</dd>
        </div>
      </dl>

      {items.length === 0 ? (
        <p className="empty">枠がありません。「枠を調整」で商品の枠を作ってください。</p>
      ) : (
        <ul className="item-list">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`item-row item-row--${item.status}${item.id === selectedId ? ' is-selected' : ''}`}
            >
              <button
                type="button"
                className="item-row__thumb"
                aria-label={`No.${index + 1} を画像上で強調`}
                onClick={() => dispatch({ type: 'select', id: item.id })}
              >
                <span style={thumbnailStyle(image, item)} />
              </button>
              <div className="item-row__head">
                <span className="item-row__no">No.{index + 1}</span>
                <input
                  className="item-row__name"
                  type="text"
                  value={item.name}
                  placeholder="名前（任意）"
                  aria-label={`No.${index + 1} の名前`}
                  maxLength={40}
                  onChange={(e) => dispatch({ type: 'rename', id: item.id, name: e.target.value })}
                />
              </div>
              <div className="item-row__checks" role="group" aria-label={`No.${index + 1} の状態`}>
                {STATUS_OPTIONS.map(({ status, label }) => (
                  <label key={status} className={`check-chip check-chip--${status}`}>
                    <input
                      type="checkbox"
                      checked={item.status === status}
                      onChange={() => dispatch({ type: 'toggleStatus', id: item.id, status })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {item.status === 'extra' && (
                <div className="stepper" role="group" aria-label={`No.${index + 1} の余分の個数`}>
                  <span className="stepper__label">余分の個数</span>
                  <button
                    type="button"
                    aria-label="1つ減らす"
                    disabled={item.extraCount <= 1}
                    onClick={() => dispatch({ type: 'setExtraCount', id: item.id, count: item.extraCount - 1 })}
                  >
                    −
                  </button>
                  <output aria-live="polite">{item.extraCount}</output>
                  <button
                    type="button"
                    aria-label="1つ増やす"
                    disabled={item.extraCount >= MAX_EXTRA_COUNT}
                    onClick={() => dispatch({ type: 'setExtraCount', id: item.id, count: item.extraCount + 1 })}
                  >
                    ＋
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

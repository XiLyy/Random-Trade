import { useState } from 'react'

interface Props {
  itemCount: number
  hasSelection: boolean
  sensitivity: number
  onSensitivityChange: (value: number) => void
  onDetect: () => void
  onGrid: (rows: number, cols: number) => void
  onDeleteSelected: () => void
  onClearAll: () => void
  onDone: () => void
}

const GRID_MAX = 20

function toGridValue(raw: string): number {
  const value = Math.round(Number(raw))
  return Number.isFinite(value) ? Math.min(GRID_MAX, Math.max(1, value)) : 1
}

export function EditPanel({
  itemCount,
  hasSelection,
  sensitivity,
  onSensitivityChange,
  onDetect,
  onGrid,
  onDeleteSelected,
  onClearAll,
  onDone,
}: Props) {
  // 入力途中の空欄を許すため文字列で持ち、分割するときに数値にする
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('4')

  return (
    <section className="panel" aria-labelledby="edit-heading">
      <h2 id="edit-heading">枠の調整</h2>
      <p className="panel__hint">
        画像の空いている所をドラッグすると枠を追加できます。枠はドラッグで移動、右下の丸でサイズ変更、右上の×で削除できます。
      </p>

      <div className="field-group">
        <h3>自動で認識</h3>
        <label className="range">
          <span>
            感度 <output>{sensitivity}</output>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={sensitivity}
            onChange={(e) => onSensitivityChange(Number(e.target.value))}
          />
        </label>
        <p className="field-group__note">枠が足りないときは感度を上げ、余計な枠が多いときは下げてください。</p>
        <button type="button" className="button" onClick={onDetect}>
          この感度で認識し直す
        </button>
      </div>

      <div className="field-group">
        <h3>グリッドで分割</h3>
        <div className="grid-inputs">
          <label>
            行
            <input type="number" min={1} max={GRID_MAX} value={rows} onChange={(e) => setRows(e.target.value)} />
          </label>
          <span aria-hidden="true">×</span>
          <label>
            列
            <input type="number" min={1} max={GRID_MAX} value={cols} onChange={(e) => setCols(e.target.value)} />
          </label>
          <button type="button" className="button" onClick={() => onGrid(toGridValue(rows), toGridValue(cols))}>
            分割する
          </button>
        </div>
        <p className="field-group__note">
          枠があるときはすべての枠を囲む範囲を、ないときは画像全体を均等に分割します。商品がきれいに並んでいる画像に向いています。
        </p>
      </div>

      <div className="field-group">
        <h3>枠の削除</h3>
        <div className="button-row">
          <button type="button" className="button" disabled={!hasSelection} onClick={onDeleteSelected}>
            選択中の枠を削除
          </button>
          <button type="button" className="button button--danger" disabled={itemCount === 0} onClick={onClearAll}>
            すべての枠を削除
          </button>
        </div>
      </div>

      <button type="button" className="button button--primary button--block" disabled={itemCount === 0} onClick={onDone}>
        チェックに進む（{itemCount}個）
      </button>
    </section>
  )
}

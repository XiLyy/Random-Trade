import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import { CheckPanel } from './components/CheckPanel'
import { EditPanel } from './components/EditPanel'
import { ExportPanel } from './components/ExportPanel'
import { ImageEditor } from './components/ImageEditor'
import { STATUS_OPTIONS } from './components/labels'
import { Uploader } from './components/Uploader'
import { DEFAULT_SENSITIVITY, detectItems } from './lib/detect'
import { gridRects, unionAll } from './lib/geometry'
import { getAnalysisImageData, loadImageFile, validateImageFile } from './lib/image'
import type { ItemStatus, LoadedImage, OutputOptions } from './lib/types'
import { initialState, reducer, type Mode } from './state/reducer'

const BRUSHES: { status: ItemStatus; label: string }[] = [...STATUS_OPTIONS, { status: 'none', label: 'クリア' }]

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'edit', label: '① 枠を調整' },
  { mode: 'check', label: '② チェック' },
]

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [brush, setBrush] = useState<ItemStatus>('wanted')
  const [sensitivity, setSensitivity] = useState(DEFAULT_SENSITIVITY)
  const [options, setOptions] = useState<OutputOptions>({ title: '', note: '', showLegend: true, dimOthers: false })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { image, items, selectedId, mode } = state
  const hasChecks = items.some((item) => item.status !== 'none')

  const detect = useCallback((target: LoadedImage, value: number): number => {
    const rects = detectItems(getAnalysisImageData(target.element), { sensitivity: value })
    dispatch({ type: 'replaceRects', rects })
    setMessage(
      rects.length > 0
        ? `${rects.length}個の商品を認識しました。枠がずれていたら「枠を調整」で直せます。`
        : '商品を自動で認識できませんでした。「グリッドで分割」するか、画像をドラッグして枠を追加してください。',
    )
    return rects.length
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      const invalid = validateImageFile(file)
      if (invalid) {
        setError(invalid)
        return
      }
      setError(null)
      try {
        const loaded = await loadImageFile(file)
        dispatch({ type: 'imageLoaded', image: loaded })
        const count = detect(loaded, sensitivity)
        dispatch({ type: 'setMode', mode: count > 0 ? 'check' : 'edit' })
      } catch (e) {
        setError(e instanceof Error ? e.message : '画像を読み込めませんでした。')
      }
    },
    [detect, sensitivity],
  )

  // 使い終わった画像のオブジェクトURLを解放する
  useEffect(() => {
    const url = image?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [image?.url])

  // 画像を選ぶ前は、クリップボードからの貼り付けを受け付ける
  useEffect(() => {
    if (image) return
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      void handleFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [image, handleFile])

  // 枠の調整中は Delete / Backspace キーで選択中の枠を消せるようにする
  useEffect(() => {
    if (mode !== 'edit' || !selectedId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      e.preventDefault()
      dispatch({ type: 'removeItem', id: selectedId })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, selectedId])

  const confirmDiscardChecks = () =>
    !hasChecks || window.confirm('入力したチェックが消えます。よろしいですか？')

  const handleReset = () => {
    if (!confirmDiscardChecks()) return
    dispatch({ type: 'reset' })
    setMessage(null)
    setError(null)
  }

  if (!image) {
    return (
      <Layout>
        <div className="hero">
          <p className="hero__lead">
            公式のラインナップ画像から、
            <br />
            「譲」「求」入りの交換募集画像を作ります。
          </p>
        </div>
        <Uploader onFile={handleFile} error={error} />
      </Layout>
    )
  }

  return (
    <Layout onReset={handleReset}>
      <div className="workspace">
        <div className="workspace__canvas">
          <div className="mode-tabs" role="tablist" aria-label="作業の切り替え">
            {MODES.map(({ mode: value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                className={`mode-tabs__tab${mode === value ? ' is-active' : ''}`}
                onClick={() => dispatch({ type: 'setMode', mode: value })}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'check' ? (
            <div className="palette" role="radiogroup" aria-label="画像をタップしたときに付ける状態">
              <span className="palette__label">タップで付ける：</span>
              {BRUSHES.map(({ status, label }) => (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={brush === status}
                  className={`palette__brush palette__brush--${status}${brush === status ? ' is-active' : ''}`}
                  onClick={() => setBrush(status)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <p className="palette palette--hint">空いている所をドラッグして枠を追加 ／ 枠をドラッグして移動</p>
          )}

          <ImageEditor
            image={image}
            items={items}
            selectedId={selectedId}
            mode={mode}
            brush={brush}
            dispatch={dispatch}
          />
          {message && (
            <p className="message" role="status">
              {message}
            </p>
          )}
        </div>

        <div className="workspace__panels">
          {mode === 'edit' ? (
            <EditPanel
              itemCount={items.length}
              hasSelection={selectedId !== null}
              sensitivity={sensitivity}
              onSensitivityChange={setSensitivity}
              onDetect={() => {
                if (confirmDiscardChecks()) detect(image, sensitivity)
              }}
              onGrid={(rows, cols) => {
                if (!confirmDiscardChecks()) return
                const bounds = unionAll(items.map((item) => item.rect)) ?? undefined
                dispatch({ type: 'replaceRects', rects: gridRects(rows, cols, bounds) })
                setMessage(`${rows * cols}個の枠を作りました。`)
              }}
              onDeleteSelected={() => selectedId && dispatch({ type: 'removeItem', id: selectedId })}
              onClearAll={() => {
                if (window.confirm('すべての枠を削除しますか？')) dispatch({ type: 'clearItems' })
              }}
              onDone={() => dispatch({ type: 'setMode', mode: 'check' })}
            />
          ) : (
            <>
              <CheckPanel image={image} items={items} selectedId={selectedId} dispatch={dispatch} />
              {/* 画像を差し替えたら古いプレビューを捨てるよう、画像ごとに作り直す */}
              <ExportPanel key={image.url} image={image} items={items} options={options} onOptionsChange={setOptions} />
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

function Layout({ children, onReset }: { children: ReactNode; onReset?: () => void }) {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="logo">
            Random Trade
            <span className="logo__sub">交換募集画像メーカー</span>
          </h1>
          {onReset && (
            <button type="button" className="button button--ghost" onClick={onReset}>
              別の画像にする
            </button>
          )}
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <p>画像はお使いの端末の中だけで処理され、サーバーには送信されません。</p>
        <p>公式画像の権利は権利者にあります。権利者のガイドラインと SNS の規約に従ってご利用ください。</p>
      </footer>
    </div>
  )
}

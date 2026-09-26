import { useEffect, useMemo, useRef, useState } from 'react'
import { renderOutputBlob } from '../lib/render'
import { hasTradeTargets } from '../lib/status'
import { buildTradeText } from '../lib/text'
import type { LoadedImage, OutputOptions, TradeItem } from '../lib/types'

interface Props {
  image: LoadedImage
  items: TradeItem[]
  options: OutputOptions
  onOptionsChange: (options: OutputOptions) => void
}

interface Result {
  url: string
  file: File
  /** どの入力から作った画像か。入力が変わったら「作り直してください」と出す */
  signature: string
}

function outputFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
  return `random-trade_${stamp}.png`
}

export function ExportPanel({ image, items, options, onOptionsChange }: Props) {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const text = useMemo(() => buildTradeText(items, options), [items, options])
  const signature = useMemo(() => JSON.stringify({ url: image.url, items, options }), [image.url, items, options])
  const canExport = hasTradeTargets(items)
  const stale = result !== null && result.signature !== signature

  // 古いプレビューのオブジェクトURLを解放する
  useEffect(() => {
    const url = result?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [result?.url])

  const update = (patch: Partial<OutputOptions>) => onOptionsChange({ ...options, ...patch })

  const handleExport = async () => {
    setBusy(true)
    setError(null)
    try {
      const blob = await renderOutputBlob(image.element, items, options)
      const file = new File([blob], outputFileName(), { type: 'image/png' })
      setResult({ url: URL.createObjectURL(blob), file, signature })
      requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像を出力できませんでした。')
    } finally {
      setBusy(false)
    }
  }

  const canShare = result !== null && typeof navigator.canShare === 'function' && navigator.canShare({ files: [result.file] })

  const handleShare = async () => {
    if (!result) return
    try {
      await navigator.share({ files: [result.file], text })
    } catch (e) {
      // 共有シートを閉じただけのときは何もしない
      if (e instanceof Error && e.name !== 'AbortError') setError('共有できませんでした。画像を保存してから投稿してください。')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('コピーできませんでした。テキストを長押しして選択してください。')
    }
  }

  return (
    <section className="panel" aria-labelledby="export-heading">
      <h2 id="export-heading">画像を出力</h2>

      <div className="field-group">
        <label className="text-field">
          <span>タイトル（任意）</span>
          <input
            type="text"
            value={options.title}
            maxLength={60}
            placeholder="例：〇〇 缶バッジ 第2弾"
            onChange={(e) => update({ title: e.target.value })}
          />
        </label>
        <label className="text-field">
          <span>メモ（任意）</span>
          <textarea
            value={options.note}
            maxLength={200}
            rows={2}
            placeholder="例：郵送のみ／同種交換を優先します"
            onChange={(e) => update({ note: e.target.value })}
          />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={options.showLegend} onChange={(e) => update({ showLegend: e.target.checked })} />
          <span>画像の下に凡例（譲・求の意味と種類数）を入れる</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={options.dimOthers} onChange={(e) => update({ dimOthers: e.target.checked })} />
          <span>所持・未選択の商品を薄くする</span>
        </label>
      </div>

      <button
        type="button"
        className="button button--primary button--block button--large"
        disabled={!canExport || busy}
        onClick={handleExport}
      >
        {busy ? '出力しています…' : '画像を出力'}
      </button>
      {!canExport && <p className="panel__hint">「未所持（求）」か「余分（譲）」を1つ以上チェックすると出力できます。</p>}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="result" ref={previewRef}>
          {stale && (
            <p className="alert alert--info" role="status">
              出力後にチェックや設定が変わりました。「画像を出力」でもう一度作り直してください。
            </p>
          )}
          <img className="result__image" src={result.url} alt="譲・求のマークを付けた交換募集画像" />
          <div className="button-row">
            <a className="button button--primary" href={result.url} download={result.file.name}>
              画像を保存
            </a>
            {canShare && (
              <button type="button" className="button" onClick={handleShare}>
                共有
              </button>
            )}
          </div>
          <p className="panel__hint">スマホでは、画像を長押しして保存することもできます。</p>
        </div>
      )}

      <div className="field-group">
        <h3>募集テキスト</h3>
        <textarea className="trade-text" readOnly value={text} rows={Math.min(8, text.split('\n').length + 1)} />
        <button type="button" className="button" onClick={handleCopy}>
          {copied ? 'コピーしました' : 'テキストをコピー'}
        </button>
      </div>
    </section>
  )
}

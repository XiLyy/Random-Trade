import { useEffect, useMemo, useRef, useState } from 'react'
import { renderOutputBlob } from '../lib/render'
import { X_MAX_WEIGHTED_LENGTH, buildXIntentUrl, chooseXShareMethod, xWeightedLength } from '../lib/share'
import { hasTradeTargets } from '../lib/status'
import { buildTradeText } from '../lib/text'
import type { LoadedImage, OutputOptions, PostSettings, TradeItem } from '../lib/types'
import { PostSettingsForm } from './PostSettingsForm'

interface Props {
  image: LoadedImage
  items: TradeItem[]
  options: OutputOptions
  onOptionsChange: (options: OutputOptions) => void
  postSettings: PostSettings
  onPostSettingsChange: (settings: PostSettings) => void
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

export function ExportPanel({ image, items, options, onOptionsChange, postSettings, onPostSettingsChange }: Props) {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const text = useMemo(() => buildTradeText(items, postSettings), [items, postSettings])
  const weightedLength = xWeightedLength(text)
  // 画像に描くもの（枠・状態・個数）だけで、作り直しが必要かを判断する。募集文や商品名は画像に入らない
  const signature = useMemo(
    () =>
      JSON.stringify({
        url: image.url,
        marks: items.map(({ rect, status, extraCount }) => [rect, status, extraCount]),
        options,
      }),
    [image.url, items, options],
  )
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

  /**
   * X に画像と募集文を渡す。X の Web の投稿画面は画像を受け取れないため、
   * スマホでは共有メニューで X アプリに画像と文を渡し、PC などでは画像を保存して文入りの投稿画面を開く。
   */
  const handleShareToX = async () => {
    if (!result || stale) return
    setError(null)
    setShareNote(null)
    const canShareFiles =
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [result.file], text })
    const touchDevice = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

    if (chooseXShareMethod({ canShareFiles, touchDevice }) === 'share-sheet') {
      try {
        await navigator.share({ files: [result.file], text })
      } catch (e) {
        // 共有メニューを閉じただけのときは何もしない
        if (!(e instanceof Error && e.name === 'AbortError')) {
          setError('共有メニューを開けませんでした。画像を保存し、テキストをコピーして X で投稿してください。')
        }
      }
      return
    }

    // ポップアップとして止められないよう、クリックの処理の中ですぐに投稿画面を開く
    const opened = window.open(buildXIntentUrl(text), '_blank')
    if (opened) opened.opener = null
    const link = document.createElement('a')
    link.href = result.url
    link.download = result.file.name
    link.click()
    setShareNote(
      opened
        ? '画像を保存し、募集文を入れた X の投稿画面を開きました。保存した画像を投稿画面に添付してください。'
        : 'X の投稿画面を開けませんでした（ポップアップがブロックされた可能性があります）。画像は保存したので、テキストをコピーして X で投稿してください。',
    )
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
            <button type="button" className="button button--x" disabled={stale} onClick={handleShareToX}>
              X に投稿
            </button>
            <a className="button" href={result.url} download={result.file.name}>
              画像を保存
            </a>
          </div>
          {shareNote && (
            <p className="alert alert--info" role="status">
              {shareNote}
            </p>
          )}
          <p className="panel__hint">
            スマホでは共有メニューが開くので「X」を選ぶと、画像と募集文がそのまま入ります（文が入らないときは「テキストをコピー」して貼り付けてください）。PC では画像を保存し、募集文を入れた投稿画面を開きます。
          </p>
        </div>
      )}

      <div className="field-group">
        <h3>募集テキスト</h3>
        <textarea className="trade-text" readOnly value={text} rows={Math.min(10, text.split('\n').length + 1)} />
        <p className={`x-count${weightedLength > X_MAX_WEIGHTED_LENGTH ? ' is-over' : ''}`}>
          X の文字数の目安：{weightedLength} / {X_MAX_WEIGHTED_LENGTH}（日本語は1文字を2と数えます）
          {weightedLength > X_MAX_WEIGHTED_LENGTH && '。長すぎて投稿できない場合があります。補足やハッシュタグを短くしてください。'}
        </p>
        <button type="button" className="button" onClick={handleCopy}>
          {copied ? 'コピーしました' : 'テキストをコピー'}
        </button>
        <details className="post-settings-edit">
          <summary>募集文の設定を変える</summary>
          <PostSettingsForm value={postSettings} onChange={onPostSettingsChange} />
        </details>
      </div>
    </section>
  )
}

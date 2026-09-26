import { useState, type DragEvent } from 'react'

interface Props {
  onFile: (file: File) => void
  error: string | null
}

export function Uploader({ onFile, error }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <section className="uploader">
      <label
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ''
          }}
        />
        <span className="dropzone__icon" aria-hidden="true">
          ＋
        </span>
        <strong className="dropzone__title">ラインナップ画像を選ぶ</strong>
        <span className="dropzone__sub">ここにドラッグ＆ドロップ、または貼り付け（Ctrl / ⌘ + V）もできます</span>
      </label>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <ol className="steps">
        <li>
          <strong>画像をアップ</strong>
          <span>公式のラインナップ画像を選ぶと、商品を自動で見つけて枠で囲みます。</span>
        </li>
        <li>
          <strong>チェック</strong>
          <span>商品ごとに「所持」「未所持」「余分」をチェックします。</span>
        </li>
        <li>
          <strong>画像を出力</strong>
          <span>余分に「譲」、未所持に「求」のマークが付いた画像ができます。</span>
        </li>
      </ol>
    </section>
  )
}

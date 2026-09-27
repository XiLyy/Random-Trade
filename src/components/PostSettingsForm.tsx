import type { PostSettings } from '../lib/types'

interface Props {
  value: PostSettings
  onChange: (value: PostSettings) => void
}

/** SNS 投稿用の募集文の設定（ヘッダ・補足・ハッシュタグ） */
export function PostSettingsForm({ value, onChange }: Props) {
  const update = (patch: Partial<PostSettings>) => onChange({ ...value, ...patch })

  return (
    <div className="post-settings">
      <label className="text-field">
        <span>ヘッダ（募集文の最初に入る文）</span>
        <textarea
          value={value.header}
          maxLength={200}
          rows={2}
          placeholder="例：【交換】〇〇 LIVE TOUR 2026 ランダムブロマイド"
          onChange={(e) => update({ header: e.target.value })}
        />
      </label>
      <label className="text-field">
        <span>補足（譲・求のあとに入る文・任意）</span>
        <textarea
          value={value.note}
          maxLength={200}
          rows={2}
          placeholder="例：郵送のみ／同種交換を優先します"
          onChange={(e) => update({ note: e.target.value })}
        />
      </label>
      <label className="text-field">
        <span>ハッシュタグ（任意）</span>
        <input
          type="text"
          value={value.hashtags}
          maxLength={200}
          placeholder="例：〇〇交換 〇〇譲渡"
          onChange={(e) => update({ hashtags: e.target.value })}
        />
      </label>
      <p className="field-group__note">ハッシュタグは空白で区切ります。「#」を付けなくても自動で付きます。</p>
    </div>
  )
}

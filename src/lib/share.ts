/**
 * X（Twitter）への投稿まわり。
 *
 * X の Web の投稿画面（intent）は文しか受け取れず、画像は添付できない。
 * そのためスマホでは OS の共有メニュー（Web Share API）で画像と文を X アプリに渡し、
 * それ以外では画像を保存したうえで、文を入れた投稿画面を開く。
 */

/** X の1投稿の上限（重み付きの文字数。日本語などは1文字を2と数える） */
export const X_MAX_WEIGHTED_LENGTH = 280

/**
 * X の文字数の数え方（twitter-text の重み付け）で数える。
 * ラテン文字や一部の記号は 1、日本語などそれ以外は 2 と数える。URL の短縮などは考えない目安。
 */
export function xWeightedLength(text: string): number {
  let length = 0
  for (const char of text.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 0
    const light =
      code <= 4351 ||
      (code >= 8192 && code <= 8205) ||
      (code >= 8208 && code <= 8223) ||
      (code >= 8242 && code <= 8247)
    length += light ? 1 : 2
  }
  return length
}

/** 文を入れた X の投稿画面の URL */
export function buildXIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}

export type XShareMethod = 'share-sheet' | 'intent'

/**
 * 投稿の方法を選ぶ。画像ファイルを共有できるスマホ・タブレットなら共有メニュー、
 * それ以外（PC など）は画像を保存して投稿画面を開く。
 * PC の共有メニューには X が出ないことが多いため、ファイルを共有できても指で操作する端末に限る。
 */
export function chooseXShareMethod(env: { canShareFiles: boolean; touchDevice: boolean }): XShareMethod {
  return env.canShareFiles && env.touchDevice ? 'share-sheet' : 'intent'
}

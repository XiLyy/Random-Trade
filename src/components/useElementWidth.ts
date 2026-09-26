import { useLayoutEffect, useState, type RefObject } from 'react'

/** 要素の表示上の幅（CSS ピクセル）を追いかける */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}

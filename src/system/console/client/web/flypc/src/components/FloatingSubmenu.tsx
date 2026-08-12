import React from 'react'
import { createPortal } from 'react-dom'

type Placement = 'top' | 'right' | 'left'

type FloatingSubmenuProps = {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  placement: Placement
  children: React.ReactNode
  menuStyle?: React.CSSProperties
  zIndex?: number
}

const VIEWPORT_PAD = 8
const ANCHOR_GAP = 12

export const FloatingSubmenu: React.FC<FloatingSubmenuProps> = ({
  open,
  anchorRef,
  placement,
  children,
  menuStyle,
  zIndex = 1000,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)

  const updatePosition = React.useCallback(() => {
    const anchorEl = anchorRef.current
    if (!open || !anchorEl || !menuRef.current) {
      setPosition(null)
      return
    }

    const anchorRect = anchorEl.getBoundingClientRect()
    const menuRect = menuRef.current.getBoundingClientRect()

    let top = 0
    let left = 0

    if (placement === 'right') {
      top = anchorRect.top + anchorRect.height / 2 - menuRect.height / 2
      left = anchorRect.right + ANCHOR_GAP
    } else if (placement === 'left') {
      top = anchorRect.top + anchorRect.height / 2 - menuRect.height / 2
      left = anchorRect.left - menuRect.width - ANCHOR_GAP
    } else {
      top = anchorRect.top - menuRect.height - ANCHOR_GAP
      left = anchorRect.left + anchorRect.width / 2 - menuRect.width / 2
    }

    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - menuRect.width - VIEWPORT_PAD))
    top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - menuRect.height - VIEWPORT_PAD))

    setPosition({ top, left })
  }, [anchorRef, open, placement])

  React.useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return undefined
    }

    updatePosition()

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    const observer = new ResizeObserver(updatePosition)
    const anchorEl = anchorRef.current
    if (anchorEl) {
      observer.observe(anchorEl)
    }
    if (menuRef.current) {
      observer.observe(menuRef.current)
    }

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      observer.disconnect()
    }
  }, [anchorRef, open, updatePosition])

  if (!open || !anchorRef.current) {
    return null
  }

  return createPortal(
    <div
      ref={menuRef}
      data-accounts-submenu
      style={{
        position: 'fixed',
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        visibility: position ? 'visible' : 'hidden',
        zIndex,
        ...menuStyle,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

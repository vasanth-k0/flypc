import React from 'react'
import { createPortal } from 'react-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'

export type ContextMenuShellProps = {
  items: MenuProps['items']
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onOpenChange?: (open: boolean) => void
  onOpenAt?: (x: number, y: number) => void
  shouldOpen?: (event: MouseEvent) => boolean
  /** Capture runs before nested shells; bubble runs after them. */
  eventPhase?: 'capture' | 'bubble'
  /** When false, only opens programmatically (e.g. iframe bridge). */
  listenToContextMenu?: boolean
}

export type ContextMenuShellHandle = {
  openAt: (x: number, y: number) => void
}

const clampMenuPosition = (x: number, y: number): { x: number; y: number } => {
  const maxX = Math.max(8, window.innerWidth - 180)
  const maxY = Math.max(8, window.innerHeight - 280)
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  }
}

export const ContextMenuShell = React.forwardRef<ContextMenuShellHandle, ContextMenuShellProps>(
  (
    { items, children, className, style, onOpenChange, onOpenAt, shouldOpen, eventPhase = 'capture', listenToContextMenu = true },
    ref,
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [open, setOpen] = React.useState(false)
    const [point, setPoint] = React.useState({ x: 0, y: 0 })

    const closeMenu = React.useCallback(() => {
      setOpen(false)
      onOpenChange?.(false)
    }, [onOpenChange])

    const openAt = React.useCallback(
      (x: number, y: number) => {
        setPoint(clampMenuPosition(x, y))
        setOpen(true)
        onOpenAt?.(x, y)
        onOpenChange?.(true)
      },
      [onOpenAt, onOpenChange],
    )

    React.useImperativeHandle(ref, () => ({ openAt }), [openAt])

    React.useEffect(() => {
      if (!listenToContextMenu) {
        return undefined
      }

      const container = containerRef.current
      if (!container) {
        return undefined
      }

      const onContextMenu = (event: MouseEvent): void => {
        if (shouldOpen && !shouldOpen(event)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        openAt(event.clientX, event.clientY)
      }

      const useCapture = eventPhase === 'capture'
      container.addEventListener('contextmenu', onContextMenu, useCapture)
      return () => container.removeEventListener('contextmenu', onContextMenu, useCapture)
    }, [eventPhase, listenToContextMenu, openAt, shouldOpen])

    React.useEffect(() => {
      if (!open) {
        return undefined
      }

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
          closeMenu()
        }
      }

      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }, [closeMenu, open])

    return (
      <>
        <div
          ref={containerRef}
          className={className}
          style={{ width: '100%', height: '100%', ...style }}
        >
          {children}
        </div>
        {open
          ? createPortal(
              <>
                <div
                  className="flypc-context-menu-backdrop"
                  onMouseDown={closeMenu}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    closeMenu()
                  }}
                />
                <div
                  className="flypc-context-menu-panel"
                  style={{ left: point.x, top: point.y }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <Menu
                    className="flypc-context-menu"
                    mode="vertical"
                    theme="light"
                    selectable={false}
                    items={items}
                    onClick={() => closeMenu()}
                  />
                </div>
              </>,
              document.body,
            )
          : null}
      </>
    )
  },
)

ContextMenuShell.displayName = 'ContextMenuShell'

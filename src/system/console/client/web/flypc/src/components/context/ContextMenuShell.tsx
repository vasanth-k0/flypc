import React from 'react'
import { createPortal } from 'react-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'

export type ContextMenuHoverState = {
  key: string
}

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
  hoverState?: ContextMenuHoverState | null
  onHoverStateChange?: (state: ContextMenuHoverState | null) => void
  hoverPaneContent?: React.ReactNode
  hoverPanePrimaryColor?: string
}

export type ContextMenuShellHandle = {
  openAt: (x: number, y: number) => void
}

const HOVER_PANE_WIDTH = 280
const HOVER_PANE_GAP = 6
const HOVER_PANE_TRANSITION_MS = 200
const MENU_IDLE_HIDE_MS = 5000

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
    {
      items,
      children,
      className,
      style,
      onOpenChange,
      onOpenAt,
      shouldOpen,
      eventPhase = 'capture',
      listenToContextMenu = true,
      hoverState = null,
      onHoverStateChange,
      hoverPaneContent,
      hoverPanePrimaryColor,
    },
    ref,
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const menuPanelRef = React.useRef<HTMLDivElement>(null)
    const idleHideTimerRef = React.useRef<number | null>(null)
    const isPointerOverMenuRef = React.useRef(false)
    const pointerRef = React.useRef({ x: 0, y: 0 })
    const [open, setOpen] = React.useState(false)
    const [point, setPoint] = React.useState({ x: 0, y: 0 })
    const [paneSide, setPaneSide] = React.useState<'left' | 'right'>('right')
    const [paneVisible, setPaneVisible] = React.useState(false)
    const [menuHeight, setMenuHeight] = React.useState<number>(0)
    const [mountedPaneContent, setMountedPaneContent] = React.useState<React.ReactNode>(null)

    const isPointOverMenuUi = React.useCallback((clientX: number, clientY: number): boolean => {
      const panel = menuPanelRef.current
      if (!panel) {
        return false
      }

      const hits = document.elementsFromPoint(clientX, clientY)
      for (const hit of hits) {
        if (!(hit instanceof Element)) {
          continue
        }
        if (panel.contains(hit)) {
          return true
        }
        if (hit.closest('.flypc-context-menu-hover-pane')) {
          return true
        }
      }

      return false
    }, [])

    const closeMenu = React.useCallback(() => {
      if (idleHideTimerRef.current !== null) {
        window.clearTimeout(idleHideTimerRef.current)
        idleHideTimerRef.current = null
      }
      isPointerOverMenuRef.current = false
      setOpen(false)
      onHoverStateChange?.(null)
      onOpenChange?.(false)
    }, [onHoverStateChange, onOpenChange])

    const clearIdleHideTimer = React.useCallback(() => {
      if (idleHideTimerRef.current !== null) {
        window.clearTimeout(idleHideTimerRef.current)
        idleHideTimerRef.current = null
      }
    }, [])

    const startIdleHideTimer = React.useCallback(() => {
      clearIdleHideTimer()
      idleHideTimerRef.current = window.setTimeout(() => {
        idleHideTimerRef.current = null
        if (!isPointerOverMenuRef.current) {
          closeMenu()
        }
      }, MENU_IDLE_HIDE_MS)
    }, [clearIdleHideTimer, closeMenu])

    const syncPointerHover = React.useCallback(
      (clientX: number, clientY: number) => {
        pointerRef.current = { x: clientX, y: clientY }
        const overMenu = isPointOverMenuUi(clientX, clientY)
        isPointerOverMenuRef.current = overMenu
        if (overMenu) {
          clearIdleHideTimer()
          return
        }
        if (idleHideTimerRef.current === null) {
          startIdleHideTimer()
        }
      },
      [clearIdleHideTimer, isPointOverMenuUi, startIdleHideTimer],
    )

    const openAt = React.useCallback(
      (x: number, y: number) => {
        pointerRef.current = { x, y }
        setPoint(clampMenuPosition(x, y))
        setPaneVisible(false)
        setMountedPaneContent(null)
        setOpen(true)
        onOpenAt?.(x, y)
        onOpenChange?.(true)
      },
      [onOpenAt, onOpenChange],
    )

    React.useImperativeHandle(ref, () => ({ openAt }), [openAt])

    const updateMenuMetrics = React.useCallback(() => {
      const menuPanel = menuPanelRef.current
      if (!menuPanel) {
        return
      }

      const width = menuPanel.offsetWidth
      const height = menuPanel.offsetHeight
      if (height > 0) {
        setMenuHeight(height)
      }

      const spaceRight = window.innerWidth - (point.x + width + HOVER_PANE_GAP + HOVER_PANE_WIDTH)
      const spaceLeft = point.x - HOVER_PANE_GAP - HOVER_PANE_WIDTH
      setPaneSide(spaceRight >= 8 || spaceRight >= spaceLeft ? 'right' : 'left')
    }, [point.x])

    React.useLayoutEffect(() => {
      if (!open || !menuPanelRef.current) {
        return
      }
      updateMenuMetrics()
    }, [open, point.x, point.y, items, updateMenuMetrics])

    React.useLayoutEffect(() => {
      if (!open || !menuPanelRef.current) {
        return undefined
      }

      const observer = new ResizeObserver(() => {
        updateMenuMetrics()
      })
      observer.observe(menuPanelRef.current)
      return () => observer.disconnect()
    }, [open, items, updateMenuMetrics])

    React.useEffect(() => {
      if (!open) {
        setPaneVisible(false)
        setMountedPaneContent(null)
        return undefined
      }

      if (hoverState && hoverPaneContent) {
        setMountedPaneContent(hoverPaneContent)
        const frame = window.requestAnimationFrame(() => setPaneVisible(true))
        return () => window.cancelAnimationFrame(frame)
      }

      setPaneVisible(false)
      const timer = window.setTimeout(() => setMountedPaneContent(null), HOVER_PANE_TRANSITION_MS)
      return () => window.clearTimeout(timer)
    }, [hoverPaneContent, hoverState, open])

    React.useEffect(() => {
      if (!open) {
        clearIdleHideTimer()
        isPointerOverMenuRef.current = false
        return undefined
      }

      const syncInitialHover = (): void => {
        syncPointerHover(pointerRef.current.x, pointerRef.current.y)
      }

      const frame = window.requestAnimationFrame(syncInitialHover)

      const onPointerMove = (event: PointerEvent): void => {
        syncPointerHover(event.clientX, event.clientY)
      }

      const onPointerDown = (event: PointerEvent): void => {
        syncPointerHover(event.clientX, event.clientY)
      }

      document.addEventListener('pointermove', onPointerMove, { passive: true })
      document.addEventListener('pointerdown', onPointerDown, { passive: true })
      return () => {
        window.cancelAnimationFrame(frame)
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerdown', onPointerDown)
        clearIdleHideTimer()
      }
    }, [clearIdleHideTimer, open, syncPointerHover])

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

    const hoverPane = mountedPaneContent ? (
      <div
        className={[
          'flypc-context-menu-hover-pane',
          paneVisible ? 'flypc-context-menu-hover-pane--visible' : '',
          paneSide === 'left' ? 'flypc-context-menu-hover-pane--left' : 'flypc-context-menu-hover-pane--right',
        ].filter(Boolean).join(' ')}
        style={{
          height: menuHeight > 0 ? `${menuHeight}px` : undefined,
          ...(hoverPanePrimaryColor
            ? {
                background: `color-mix(in srgb, ${hoverPanePrimaryColor} 3%, #fafafa)`,
                borderColor: `color-mix(in srgb, ${hoverPanePrimaryColor} 10%, rgba(0, 0, 0, 0.08))`,
              }
            : {}),
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {mountedPaneContent}
      </div>
    ) : null

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
                  className="flypc-context-menu-anchor"
                  style={{ left: point.x, top: point.y }}
                  onMouseLeave={(event) => {
                    const next = event.relatedTarget as Node | null
                    if (next && event.currentTarget.contains(next)) {
                      return
                    }
                    onHoverStateChange?.(null)
                  }}
                >
                  <div
                    ref={menuPanelRef}
                    className="flypc-context-menu-panel"
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
                    {hoverPane}
                  </div>
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

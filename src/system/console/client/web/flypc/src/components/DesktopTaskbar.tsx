import React from 'react'
import { FloatingSubmenu } from './FloatingSubmenu'

export type TaskbarMenuItem = {
  key: string
  label: string
  icon: React.ReactNode
}

type DesktopTaskbarProps = {
  items: TaskbarMenuItem[]
  accountSubmenuItems: TaskbarMenuItem[]
  activeWindowId: string
  openedAccountsMenuArea: 'sidebar' | 'footer' | null
  setOpenedAccountsMenuArea: React.Dispatch<React.SetStateAction<'sidebar' | 'footer' | null>>
  isSharp: boolean
  isWindowMaximized: boolean
  primaryColor: string
  secondaryColor: string
  getMenuItemColor: (isActive: boolean) => string
  withMenuIconColor: (icon: React.ReactNode, color: string) => React.ReactNode
  onWindowChange: (key: string) => void
}

const ELLIPSIS = '…'
const OVERFLOW_PANEL_MAX_WIDTH = 300

export const DesktopTaskbar: React.FC<DesktopTaskbarProps> = ({
  items,
  accountSubmenuItems,
  activeWindowId,
  openedAccountsMenuArea,
  setOpenedAccountsMenuArea,
  isSharp,
  isWindowMaximized,
  primaryColor,
  secondaryColor,
  getMenuItemColor,
  withMenuIconColor,
  onWindowChange,
}) => {
  const footerRef = React.useRef<HTMLElement>(null)
  const footerAccountHubRef = React.useRef<HTMLDivElement>(null)
  const measureRowRef = React.useRef<HTMLDivElement>(null)
  const overflowPanelRef = React.useRef<HTMLDivElement>(null)
  const overflowMeasureRef = React.useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = React.useState(items.length)
  const [overflowOpen, setOverflowOpen] = React.useState(false)
  const [overflowStartIndex, setOverflowStartIndex] = React.useState(0)
  const [overflowVisibleCount, setOverflowVisibleCount] = React.useState(0)

  const primaryItems = React.useMemo(
    () => items.filter((item) => item.key !== 'settings'),
    [items],
  )
  const settingsItem = React.useMemo(
    () => items.find((item) => item.key === 'settings') ?? null,
    [items],
  )
  const overflowItems = primaryItems.slice(visibleCount)
  const hasOverflow = overflowItems.length > 0
  const overflowHasActive = overflowItems.some((item) => {
    if (item.key === 'account-hub') {
      return activeWindowId === 'accounts' || activeWindowId === 'members'
    }
    return activeWindowId === item.key
  })

  const getItemActive = (item: TaskbarMenuItem): boolean => {
    if (item.key === 'account-hub') {
      return activeWindowId === 'accounts' || activeWindowId === 'members'
    }
    return activeWindowId === item.key
  }

  const recalculateVisibleCount = React.useCallback(() => {
    const footer = footerRef.current
    const measureRow = measureRowRef.current
    if (!footer || !measureRow) {
      return
    }

    const footerStyles = window.getComputedStyle(footer)
    const padding =
      Number.parseFloat(footerStyles.paddingLeft) + Number.parseFloat(footerStyles.paddingRight)
    const gap = Number.parseFloat(footerStyles.gap) || (isSharp ? 3.2 : 5.6)

    const primaryNodes = Array.from(measureRow.children).slice(0, primaryItems.length) as HTMLElement[]
    const itemWidths = primaryNodes.map((node) => node.offsetWidth)
    const ellipsisNode = measureRow.lastElementChild as HTMLElement | null
    const ellipsisWidth = ellipsisNode?.offsetWidth ?? (isSharp ? 42 : 36)

    let settingsWidth = isSharp ? 88 : 36
    const settingsNode = measureRow.querySelector('[data-taskbar-measure-settings]') as HTMLElement | null
    if (settingsNode) {
      settingsWidth = settingsNode.offsetWidth
    }

    let available = footer.clientWidth - padding - settingsWidth
    if (available <= 0) {
      setVisibleCount(0)
      return
    }

    let used = 0
    let count = 0

    for (let index = 0; index < primaryItems.length; index += 1) {
      const itemWidth = itemWidths[index] ?? (isSharp ? 88 : 36)
      const itemGap = index > 0 ? gap : 0
      const hiddenRemaining = primaryItems.length - (index + 1)
      const reserveEllipsis = hiddenRemaining > 0 ? gap + ellipsisWidth : 0
      const nextUsed = used + itemGap + itemWidth

      if (nextUsed + reserveEllipsis > available) {
        break
      }

      used = nextUsed
      count = index + 1
    }

    setVisibleCount(count)
  }, [isSharp, primaryItems.length])

  const recalculateOverflowWindow = React.useCallback(() => {
    const panel = overflowPanelRef.current
    const measureRow = overflowMeasureRef.current
    if (!panel || !measureRow || overflowItems.length === 0) {
      setOverflowVisibleCount(overflowItems.length)
      return
    }

    const panelStyles = window.getComputedStyle(panel)
    const gap = Number.parseFloat(panelStyles.gap) || 4
    const navWidth = (measureRow.querySelector('[data-overflow-nav]') as HTMLElement | null)?.offsetWidth ?? 28
    const available = panel.clientWidth - navWidth * 2
    const itemNodes = Array.from(measureRow.querySelectorAll('[data-overflow-item]')) as HTMLElement[]
    const itemWidths = itemNodes.map((node) => node.offsetWidth)

    let used = 0
    let count = 0
    for (let index = 0; index < itemWidths.length; index += 1) {
      const itemWidth = itemWidths[index] ?? (isSharp ? 88 : 36)
      const itemGap = index > 0 ? gap : 0
      if (used + itemGap + itemWidth > available) {
        break
      }
      used += itemGap + itemWidth
      count += 1
    }

    setOverflowVisibleCount(Math.max(1, count))
  }, [isSharp, overflowItems.length])

  React.useLayoutEffect(() => {
    recalculateVisibleCount()
    const footer = footerRef.current
    if (!footer) {
      return undefined
    }

    const observer = new ResizeObserver(() => recalculateVisibleCount())
    observer.observe(footer)
    window.addEventListener('resize', recalculateVisibleCount)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recalculateVisibleCount)
    }
  }, [recalculateVisibleCount, items, isSharp])

  React.useLayoutEffect(() => {
    if (!overflowOpen) {
      setOverflowStartIndex(0)
      return undefined
    }

    recalculateOverflowWindow()
    const panel = overflowPanelRef.current
    if (!panel) {
      return undefined
    }

    const observer = new ResizeObserver(() => recalculateOverflowWindow())
    observer.observe(panel)
    window.addEventListener('resize', recalculateOverflowWindow)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recalculateOverflowWindow)
    }
  }, [overflowOpen, recalculateOverflowWindow, overflowItems.length, isSharp])

  React.useEffect(() => {
    if (!overflowOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (footerRef.current?.contains(target)) {
        return
      }
      setOverflowOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [overflowOpen])

  React.useEffect(() => {
    if (visibleCount >= primaryItems.length) {
      setOverflowOpen(false)
    }
  }, [visibleCount, primaryItems.length])

  React.useEffect(() => {
    const maxStart = Math.max(0, overflowItems.length - overflowVisibleCount)
    if (overflowStartIndex > maxStart) {
      setOverflowStartIndex(maxStart)
    }
  }, [overflowItems.length, overflowStartIndex, overflowVisibleCount])

  const renderTaskbarButton = (
    item: TaskbarMenuItem,
    options?: { showLabel?: boolean; compact?: boolean; attachAccountRef?: boolean },
  ) => {
    const isAccountHubItem = item.key === 'account-hub'
    const isActive = getItemActive(item)
    const showAccountsSubmenu = isAccountHubItem && openedAccountsMenuArea === 'footer'
    const showLabel = options?.showLabel ?? isSharp
    const attachAccountRef = options?.attachAccountRef ?? false

    return (
      <div
        key={item.key}
        ref={isAccountHubItem && attachAccountRef ? footerAccountHubRef : undefined}
        data-accounts-hub={isAccountHubItem ? 'footer' : undefined}
        style={{ position: 'relative', flexShrink: 0 }}
      >
        <button
          type="button"
          onClick={() => {
            if (isAccountHubItem) {
              setOpenedAccountsMenuArea((current) => (current === 'footer' ? null : 'footer'))
              return
            }
            onWindowChange(item.key)
            setOverflowOpen(false)
          }}
          title={item.label}
          style={{
            width: options?.compact || !showLabel ? (isSharp ? 'auto' : '36px') : undefined,
            height: isSharp ? '42px' : '36px',
            padding: showLabel ? '0 0.8rem' : 0,
            borderRadius: isSharp ? '0' : '9px',
            border: 'none',
            flexShrink: 0,
            background: isActive ? secondaryColor : 'transparent',
            color: getMenuItemColor(isActive),
            fontSize: isSharp ? '0.76rem' : '1rem',
            cursor: 'pointer',
            display: 'grid',
            gridTemplateColumns: showLabel ? 'auto auto' : undefined,
            gap: showLabel ? '0.45rem' : 0,
            placeItems: 'center',
            transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: isActive ? `0 4px 14px ${secondaryColor}55` : 'none',
          }}
        >
          {withMenuIconColor(item.icon, getMenuItemColor(isActive))}
          {showLabel && <span style={{ maxWidth: '8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
        </button>
        {attachAccountRef && (
        <FloatingSubmenu
          open={showAccountsSubmenu}
          anchorRef={footerAccountHubRef}
          placement="top"
          zIndex={1200}
          menuStyle={{
            minWidth: '155px',
            padding: '0.35rem',
            borderRadius: isSharp ? '0' : '9px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: primaryColor,
            boxShadow: '0 14px 28px rgba(15, 23, 42, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          {accountSubmenuItems.map((subItem) => (
            <button
              key={subItem.key}
              type="button"
              title={subItem.label}
              onClick={() => {
                onWindowChange(subItem.key)
                setOpenedAccountsMenuArea(null)
                setOverflowOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                width: '100%',
                padding: '0.42rem 0.56rem',
                border: 'none',
                borderRadius: isSharp ? '0' : '6px',
                background: activeWindowId === subItem.key ? secondaryColor : 'transparent',
                color: getMenuItemColor(activeWindowId === subItem.key),
                fontSize: '0.75rem',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>
                {withMenuIconColor(subItem.icon, getMenuItemColor(activeWindowId === subItem.key))}
              </span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subItem.label}</span>
            </button>
          ))}
        </FloatingSubmenu>
        )}
      </div>
    )
  }

  const renderEllipsisButton = (
    title: string,
    onClick: () => void,
    active = false,
  ) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: isSharp ? 'auto' : '36px',
        minWidth: isSharp ? '42px' : '36px',
        height: isSharp ? '42px' : '36px',
        padding: isSharp ? '0 0.65rem' : 0,
        borderRadius: isSharp ? '0' : '9px',
        border: 'none',
        flexShrink: 0,
        background: active ? secondaryColor : 'transparent',
        color: getMenuItemColor(active),
        fontSize: '1rem',
        lineHeight: 1,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {ELLIPSIS}
    </button>
  )

  const overflowWindowItems = overflowItems.slice(
    overflowStartIndex,
    overflowStartIndex + overflowVisibleCount,
  )
  const canOverflowScrollLeft = overflowStartIndex > 0
  const canOverflowScrollRight = overflowStartIndex + overflowVisibleCount < overflowItems.length

  return (
    <>
      <div
        aria-hidden
        ref={measureRowRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: isSharp ? '0.2rem' : '0.35rem',
          whiteSpace: 'nowrap',
          height: 0,
          overflow: 'hidden',
        }}
      >
        {primaryItems.map((item) => (
          <div key={`measure-${item.key}`}>{renderTaskbarButton(item)}</div>
        ))}
        <div data-taskbar-measure-settings>
          {settingsItem ? renderTaskbarButton(settingsItem) : null}
        </div>
        <div>{renderEllipsisButton('More', () => undefined)}</div>
      </div>

      {overflowOpen && overflowItems.length > 0 && (
        <div
          aria-hidden
          ref={overflowMeasureRef}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            maxWidth: OVERFLOW_PANEL_MAX_WIDTH,
            height: 0,
            overflow: 'hidden',
          }}
        >
          <div data-overflow-nav>{renderEllipsisButton('Scroll left', () => undefined)}</div>
          {overflowItems.map((item) => (
            <div key={`overflow-measure-${item.key}`} data-overflow-item>
              {renderTaskbarButton(item, { compact: true })}
            </div>
          ))}
          <div data-overflow-nav>{renderEllipsisButton('Scroll right', () => undefined)}</div>
        </div>
      )}

      <footer
        ref={footerRef}
        id="menubar"
        style={{
          display: isWindowMaximized ? 'none' : 'flex',
          position: 'absolute',
          bottom: isSharp ? 'clamp(1rem, 3.5vw, 2.5rem)' : '18px',
          left: isSharp ? 'clamp(1rem, 6vw, 5rem)' : '50%',
          right: isSharp ? 'clamp(1rem, 6vw, 5rem)' : 'auto',
          width: isSharp ? undefined : 'min(960px, calc(100vw - 3rem))',
          transform: isSharp ? 'none' : 'translateX(-50%)',
          height: isSharp ? '40px' : '48px',
          padding: isSharp ? '0' : '0 0.45rem',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: isSharp ? '0.2rem' : '0.35rem',
          background: primaryColor,
          borderRadius: isSharp ? '0' : '14px',
          border: isSharp ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.22)',
          zIndex: 10,
          overflow: 'visible',
          maxWidth: 'calc(100vw - 3rem)',
          minWidth: 0,
          opacity: 0.91,
          backdropFilter: 'blur(7px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isSharp ? '0.2rem' : '0.35rem',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {primaryItems.slice(0, visibleCount).map((item) => renderTaskbarButton(item, { attachAccountRef: true }))}

          {hasOverflow && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {renderEllipsisButton(
                'More menu items',
                () => setOverflowOpen((open) => !open),
                overflowOpen || overflowHasActive,
              )}
              {overflowOpen && (
                <div
                  ref={overflowPanelRef}
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 12px)',
                    right: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    maxWidth: OVERFLOW_PANEL_MAX_WIDTH,
                    padding: '0.35rem',
                    borderRadius: isSharp ? '0' : '9px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: primaryColor,
                    boxShadow: '0 14px 28px rgba(15, 23, 42, 0.3)',
                    zIndex: 30,
                  }}
                >
                  {canOverflowScrollLeft && renderEllipsisButton(
                    'Show previous menu items',
                    () => setOverflowStartIndex((index) => Math.max(0, index - 1)),
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isSharp ? '0.2rem' : '0.35rem',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {overflowWindowItems.map((item) => renderTaskbarButton(item, { compact: true, attachAccountRef: true }))}
                  </div>
                  {canOverflowScrollRight && renderEllipsisButton(
                    'Show more menu items',
                    () => setOverflowStartIndex((index) => index + 1),
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {settingsItem && (
          <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
            {renderTaskbarButton(settingsItem)}
          </div>
        )}
      </footer>
    </>
  )
}

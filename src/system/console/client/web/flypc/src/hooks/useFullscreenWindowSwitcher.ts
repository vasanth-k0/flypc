import React from 'react'
import type { AppEntry, WindowId } from '../types/dashboard'
import { isPageFullscreen } from '../utils/pageFullscreen'
import { getNextSwitchableWindow } from '../utils/switchableWindows'

type UseFullscreenWindowSwitcherOptions = {
  activeWindowId: WindowId
  openApps: AppEntry[]
  includeMembers: boolean
  onFocusWindow: (windowId: WindowId) => void
}

export const useFullscreenWindowSwitcher = ({
  activeWindowId,
  openApps,
  includeMembers,
  onFocusWindow,
}: UseFullscreenWindowSwitcherOptions): void => {
  const stateRef = React.useRef({ activeWindowId, openApps, includeMembers, onFocusWindow })
  stateRef.current = { activeWindowId, openApps, includeMembers, onFocusWindow }

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isPageFullscreen()) {
        return
      }

      if (event.key !== 'Tab' || !event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      event.preventDefault()

      const {
        activeWindowId: current,
        openApps: apps,
        includeMembers: members,
        onFocusWindow: focus,
      } = stateRef.current

      const direction = event.shiftKey ? 'backward' : 'forward'
      focus(getNextSwitchableWindow(current, apps, members, direction))
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])
}

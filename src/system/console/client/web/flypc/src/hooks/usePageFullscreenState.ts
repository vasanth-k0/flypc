import React from 'react'
import { getHostWindow, isPageFullscreen } from '../utils/pageFullscreen'

const attachFullscreenListener = (target: Document, handler: () => void) => {
  target.addEventListener('fullscreenchange', handler)
  return () => target.removeEventListener('fullscreenchange', handler)
}

export const usePageFullscreenState = (): boolean => {
  const [active, setActive] = React.useState(() => isPageFullscreen())

  React.useEffect(() => {
    const sync = () => setActive(isPageFullscreen())
    sync()

    const cleanups = [attachFullscreenListener(document, sync)]

    const host = getHostWindow()
    if (host.document !== document) {
      cleanups.push(attachFullscreenListener(host.document, sync))
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  return active
}

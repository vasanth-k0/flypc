type DesktopBridgeWindow = Window & {
  flypcDesktop?: {
    toggleFullScreen?: () => Promise<boolean>
    openDevTools?: () => Promise<void>
    inspectElement?: (x: number, y: number) => Promise<void>
  }
}

export const getHostWindow = (): DesktopBridgeWindow =>
  (window.parent && window.parent !== window ? window.parent : window) as DesktopBridgeWindow

export const isPageFullscreen = (): boolean => {
  const host = getHostWindow()
  if (host !== window && host.document.fullscreenElement) {
    return true
  }
  return Boolean(document.fullscreenElement)
}

export const togglePageFullscreen = async (): Promise<boolean> => {
  const host = getHostWindow()

  if (host.flypcDesktop?.toggleFullScreen) {
    return host.flypcDesktop.toggleFullScreen()
  }

  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen()
    return true
  }

  await document.exitFullscreen()
  return false
}

export const exitPageFullscreen = async (): Promise<void> => {
  const host = getHostWindow()

  if (host.flypcDesktop?.toggleFullScreen && isPageFullscreen()) {
    await host.flypcDesktop.toggleFullScreen()
    return
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen()
  }
}

import React, { useMemo } from 'react'
import { ConfigProvider } from 'antd'
import { useAppSelector } from '../store/hooks'
import { ColorPalette } from '../globals/ColorPalette'

type NativeWindowContentProps = {
  isActive: boolean
  fillHeight?: boolean
  noPadding?: boolean
  children: React.ReactNode
}

/** Text on filled primary buttons: dark for light-primary palettes, white otherwise. */
const getPrimaryButtonTextColor = (activeTheme: string): string =>
  ColorPalette.onPrimaryTextColor(activeTheme)

/** Shared content surface for FlyPC's built-in (non-containerized) applications. */
export const NativeWindowContent: React.FC<NativeWindowContentProps> = ({
  isActive,
  fillHeight = false,
  noPadding = false,
  children,
}) => {
  const { activeTheme, primary: primaryColor, secondary: secondaryColor } = useAppSelector((state) => state.theme)
  const resolvedPrimary = primaryColor || '#597ef7'
  const resolvedSecondary = secondaryColor || '#85a5ff'
  const primaryButtonTextColor = getPrimaryButtonTextColor(activeTheme)

  const themeConfig = useMemo(
    () => ({
      token: {
        colorPrimary: resolvedPrimary,
        colorLink: resolvedPrimary,
        colorPrimaryHover: resolvedSecondary,
        colorPrimaryActive: resolvedSecondary,
        colorTextLightSolid: primaryButtonTextColor,
      },
      components: {
        Button: {
          colorTextLightSolid: primaryButtonTextColor,
        },
      },
    }),
    [primaryButtonTextColor, resolvedPrimary, resolvedSecondary],
  )

  return (
    <ConfigProvider theme={themeConfig}>
      <section
        style={{
          display: isActive ? 'block' : 'none',
          height: fillHeight ? '100%' : 'auto',
          padding: noPadding ? 0 : '3rem',
          boxSizing: 'border-box',
          ['--flypc-primary' as string]: resolvedPrimary,
          ['--flypc-secondary' as string]: resolvedSecondary,
          ['--flypc-button-text' as string]: primaryButtonTextColor,
        }}
      >
        {children}
      </section>
    </ConfigProvider>
  )
}

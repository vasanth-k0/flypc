import React from 'react'

type NativeWindowContentProps = {
  isActive: boolean
  fillHeight?: boolean
  noPadding?: boolean
  children: React.ReactNode
}

/** Shared content surface for FlyPC's built-in (non-containerized) applications. */
export const NativeWindowContent: React.FC<NativeWindowContentProps> = ({
  isActive,
  fillHeight = false,
  noPadding = false,
  children,
}) => (
  <section
    style={{
      display: isActive ? 'block' : 'none',
      height: fillHeight ? '100%' : 'auto',
      padding: noPadding ? 0 : '3rem',
      boxSizing: 'border-box',
    }}
  >
    {children}
  </section>
)

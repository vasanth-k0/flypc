import React from 'react'

import flypcLogo from '../assets/flypc-logo.png'

interface FlyPCLogoProps {
  width?: number | string
  height?: number | string
  className?: string
  showText?: boolean
}

export const FlyPCLogo: React.FC<FlyPCLogoProps> = ({
  width = 120,
  height = 120,
  className = '',
  showText = true,
}) => {
  return (
    <img
      src={flypcLogo}
      alt="FlyPC"
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', margin: '0 auto', objectFit: 'contain' }}
    />
  )
}

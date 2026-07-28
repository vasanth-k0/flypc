import React from 'react'

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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', margin: '0 auto' }}
    >
      <defs>
        <linearGradient id="flypc-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d2ff" />
          <stop offset="50%" stopColor="#0297c4" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="flypc-wing-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0297c4" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      <g>
        {/* Chevron Base Stand */}
        <path
          d="M 206 385 L 256 415 L 306 385"
          fill="none"
          stroke="url(#flypc-logo-grad)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Left Wings */}
        <path
          d="M 160 268 L 140 270 L 45 155"
          fill="none"
          stroke="url(#flypc-wing-grad)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 145 305 L 125 305 L 75 235"
          fill="none"
          stroke="url(#flypc-wing-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Right Wings */}
        <path
          d="M 352 268 L 372 270 L 467 155"
          fill="none"
          stroke="url(#flypc-wing-grad)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 367 305 L 387 305 L 437 235"
          fill="none"
          stroke="url(#flypc-wing-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Central Display Monitor Box */}
        <rect
          x="160"
          y="180"
          width="192"
          height="150"
          rx="16"
          ry="16"
          fill="#0f172a"
          stroke="url(#flypc-logo-grad)"
          strokeWidth="16"
        />

        {/* Screen Inner Display */}
        <rect x="178" y="198" width="156" height="114" rx="8" ry="8" fill="#1e293b" />

        {/* FlyPC Logo text inside display */}
        {showText && (
          <text
            x="256"
            y="268"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontSize="34"
            fontWeight="900"
            fill="#ffffff"
            textAnchor="middle"
            letterSpacing="1.5"
          >
            FlyPC
          </text>
        )}
      </g>
    </svg>
  )
}

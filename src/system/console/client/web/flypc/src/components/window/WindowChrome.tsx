import React from 'react'
import { Button } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { MdClose, MdMinimize } from 'react-icons/md'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import type { WindowId } from '../../types/dashboard'

export type WindowChromeProps = {
  hasRightControls: boolean
  hasRightControlsOpen: boolean
  useLightTitleBar: boolean
  rightControlsHeaderWidth: string
  titleBarHeight: string
  activeAppKey: string | null
  openAppControls: Record<string, boolean>
  isHybrid: boolean
  isWeb: boolean
  activeWindowId: WindowId
  activeLabel: string
  windowTitleColor: string
  titleButtonIconColor: string
  primaryColor: string
  isMaximized: boolean
  onToggleAppControls: (appKey: string) => void
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
}

export const WindowChrome: React.FC<WindowChromeProps> = ({
  hasRightControls,
  hasRightControlsOpen,
  useLightTitleBar,
  rightControlsHeaderWidth,
  titleBarHeight,
  activeAppKey,
  openAppControls,
  isHybrid,
  isWeb,
  activeWindowId,
  activeLabel,
  windowTitleColor,
  titleButtonIconColor,
  primaryColor,
  isMaximized,
  onToggleAppControls,
  onMinimize,
  onMaximize,
  onClose,
}) => (
  <div
    id="title"
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0',
      background: hasRightControls || !useLightTitleBar ? 'transparent' : 'rgba(255, 255, 255, 0.81)',
      color: 'white',
      overflow: 'hidden',
      position: hasRightControls ? 'absolute' : 'relative',
      top: hasRightControls ? 0 : undefined,
      right: hasRightControls ? 0 : undefined,
      width: hasRightControls ? rightControlsHeaderWidth : '100%',
      height: titleBarHeight,
      zIndex: hasRightControls ? 4 : undefined,
      transition: 'width 260ms ease',
      opacity: '0.8',
    }}
  >
    {activeAppKey && (
      <Button
        id="btn-controls"
        title={openAppControls[activeAppKey] ? 'Hide controls' : 'Show controls'}
        onClick={() => onToggleAppControls(activeAppKey)}
        type="text"
        icon={openAppControls[activeAppKey]
          ? <MenuUnfoldOutlined style={{ fontSize: isHybrid ? '0.78rem' : '0.72rem' }} />
          : <MenuFoldOutlined style={{ fontSize: isHybrid ? '0.78rem' : '0.72rem' }} />}
        style={{
          position: 'absolute',
          zIndex: 1,
          top: hasRightControls ? '50%' : undefined,
          right: hasRightControls
            ? '0'
            : activeWindowId === 'apps' ? '4.5rem' : '6.75rem',
          width: '32px',
          height: '32px',
          padding: '0',
          borderRadius: '0',
          border: 'none',
          background: 'transparent',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          boxShadow: 'none',
          color: windowTitleColor,
          transform: hasRightControls ? 'translateY(-50%)' : undefined,
          transition: 'right 260ms ease, transform 260ms ease',
          margin: '0px 7px',
        }}
      />
    )}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minWidth: 0,
        minHeight: '100%',
        padding: hasRightControls ? '4px 2.8rem 4px 0.85rem' : '4px 0.35rem',
        boxSizing: 'border-box',
        background: hasRightControls ? primaryColor : useLightTitleBar ? 'rgba(255, 255, 255, 0.81)' : 'transparent',
        marginLeft: '0',
        transition: 'width 260ms ease, margin-left 260ms ease',
      }}
    >
      <span
        style={{
          display: isWeb || (hasRightControls && !hasRightControlsOpen) ? 'none' : 'block',
          fontSize: '0.78rem',
          fontWeight: 400,
          letterSpacing: '0.03em',
          textTransform: 'none',
          userSelect: 'none',
          color: windowTitleColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          margin: '0 0.65rem',
        }}
      >
        {activeLabel}
      </span>
      <div
        style={{
          display: hasRightControls && !hasRightControlsOpen ? 'none' : 'flex',
          marginLeft: 'auto',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 6px',
          boxSizing: 'border-box',
          background: 'transparent',
        }}
      >
        <Button
          id="btn-min"
          title="Minimise"
          onClick={onMinimize}
          type="text"
          icon={<MdMinimize style={{ fontSize: 'calc(2px + 0.8rem)', color: titleButtonIconColor }} />}
          style={{
            width: '26px',
            height: '26px',
            padding: 0,
            borderRadius: 0,
            border: 'none',
            background: 'transparent',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            boxShadow: 'none',
            color: titleButtonIconColor,
          }}
        />
        <Button
          id="btn-full"
          title="Fullscreen"
          onClick={onMaximize}
          type="text"
          icon={isMaximized
            ? <FullscreenExitIcon style={{ fontSize: 'calc(2px + 0.8rem)', color: titleButtonIconColor }} />
            : <FullscreenIcon style={{ fontSize: 'calc(2px + 0.8rem)', color: titleButtonIconColor }} />}
          style={{
            width: '26px',
            height: '26px',
            padding: 0,
            borderRadius: 0,
            border: 'none',
            background: 'transparent',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            boxShadow: 'none',
            color: titleButtonIconColor,
          }}
        />
        {activeWindowId !== 'apps' && (
          <Button
            id="btn-close"
            title="Close"
            onClick={onClose}
            type="text"
            icon={<MdClose style={{ fontSize: 'calc(2px + 0.8rem)', color: titleButtonIconColor }} />}
            style={{
              width: '26px',
              height: '26px',
              padding: 0,
              borderRadius: 0,
              border: 'none',
              background: 'transparent',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: 'none',
              color: titleButtonIconColor,
            }}
          />
        )}
      </div>
    </div>
  </div>
)

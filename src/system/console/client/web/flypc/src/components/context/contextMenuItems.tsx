import React from 'react'

export const CONTEXT_MENU_ICON_SIZE = 15

export const contextMenuItemLabel = (
  icon: React.ReactNode,
  text: string,
  iconMatchesTextColor = false,
): React.ReactNode => (
  <span className="flypc-context-menu-item-content">
    <span
      className={
        iconMatchesTextColor
          ? 'flypc-context-menu-item-icon flypc-context-menu-item-icon--text-color'
          : 'flypc-context-menu-item-icon'
      }
    >
      {icon}
    </span>
    <span className="flypc-context-menu-item-text">{text}</span>
  </span>
)

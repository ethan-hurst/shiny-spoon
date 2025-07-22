'use client'

import React, { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  isOpen: boolean
  isMinimized: boolean
  openMobile: boolean
  toggle: () => void
  setIsOpen: (value: boolean) => void
  setOpenMobile: (value: boolean) => void
  setIsMinimized: (value: boolean) => void
}

const SIDEBAR_COOKIE_NAME = 'sidebar:state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const SIDEBAR_WIDTH = '16rem' // 256px
const SIDEBAR_WIDTH_MOBILE = '18rem' // 288px
const SIDEBAR_WIDTH_MINIMIZED = '3rem' // 48px
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

export const useSidebar = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      isMinimized: false,
      openMobile: false,
      toggle: () =>
        set((state) => ({
          isOpen: !state.isOpen,
        })),
      setIsOpen: (isOpen: boolean) => set({ isOpen }),
      setOpenMobile: (openMobile: boolean) => set({ openMobile }),
      setIsMinimized: (isMinimized: boolean) => set({ isMinimized }),
    }),
    {
      name: SIDEBAR_COOKIE_NAME,
    }
  )
)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const toggle = useSidebar((state) => state.toggle)

  // Keyboard shortcut handling
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey
      ) {
        event.preventDefault()
        toggle()
      }
    },
    [toggle]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return <>{children}</>
}

export {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_MINIMIZED,
  SIDEBAR_WIDTH_MOBILE,
}
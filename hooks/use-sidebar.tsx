import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  isOpen: boolean
  isMinimized: boolean
  toggle: () => void
  setIsOpen: (isOpen: boolean) => void
  setIsMinimized: (isMinimized: boolean) => void
}

export const useSidebar = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      isMinimized: false,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setIsOpen: (isOpen) => set({ isOpen }),
      setIsMinimized: (isMinimized) => set({ isMinimized }),
    }),
    {
      name: 'sidebar-storage',
    }
  )
)
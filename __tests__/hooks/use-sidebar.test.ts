import { renderHook, act } from '@testing-library/react'
import { useSidebar } from '@/hooks/use-sidebar'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('initializes with collapsed state as false', () => {
    const { result } = renderHook(() => useSidebar())

    expect(result.current.isCollapsed).toBe(false)
  })

  it('loads initial state from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ isCollapsed: true }))

    const { result } = renderHook(() => useSidebar())

    expect(result.current.isCollapsed).toBe(true)
  })

  it('toggles collapsed state when toggle is called', () => {
    const { result } = renderHook(() => useSidebar())

    expect(result.current.isCollapsed).toBe(false)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isCollapsed).toBe(true)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isCollapsed).toBe(false)
  })

  it('sets collapsed state when setCollapsed is called', () => {
    const { result } = renderHook(() => useSidebar())

    expect(result.current.isCollapsed).toBe(false)

    act(() => {
      result.current.setCollapsed(true)
    })

    expect(result.current.isCollapsed).toBe(true)

    act(() => {
      result.current.setCollapsed(false)
    })

    expect(result.current.isCollapsed).toBe(false)
  })

  it('persists state to localStorage', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => {
      result.current.setCollapsed(true)
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'sidebar-storage',
      JSON.stringify({ isCollapsed: true })
    )
  })

  it('handles invalid localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid-json')

    const { result } = renderHook(() => useSidebar())

    expect(result.current.isCollapsed).toBe(false)
  })

  it('handles missing localStorage gracefully', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useSidebar())

    expect(result.current.isCollapsed).toBe(false)
  })
}) 
import { renderHook } from '@testing-library/react'
import { useBreakpoint, useIsMobile, useIsTablet, useIsDesktop } from '@/hooks/use-breakpoint'

// Mock window.innerWidth
const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
}

// Mock window.addEventListener and removeEventListener
const mockAddEventListener = jest.fn()
const mockRemoveEventListener = jest.fn()

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
})

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
})

describe('useBreakpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns mobile for width < 768', () => {
    setWindowWidth(375)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('mobile')
  })

  it('returns tablet for width >= 768 and < 1024', () => {
    setWindowWidth(800)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('tablet')
  })

  it('returns desktop for width >= 1024', () => {
    setWindowWidth(1280)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toBe('desktop')
  })

  it('sets up resize event listener', () => {
    renderHook(() => useBreakpoint())
    expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('cleans up resize event listener on unmount', () => {
    const { unmount } = renderHook(() => useBreakpoint())
    unmount()
    expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})

describe('useIsMobile', () => {
  it('returns true for mobile breakpoint', () => {
    setWindowWidth(375)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false for tablet breakpoint', () => {
    setWindowWidth(800)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns false for desktop breakpoint', () => {
    setWindowWidth(1280)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })
})

describe('useIsTablet', () => {
  it('returns false for mobile breakpoint', () => {
    setWindowWidth(375)
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBe(false)
  })

  it('returns true for tablet breakpoint', () => {
    setWindowWidth(800)
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBe(true)
  })

  it('returns false for desktop breakpoint', () => {
    setWindowWidth(1280)
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBe(false)
  })
})

describe('useIsDesktop', () => {
  it('returns false for mobile breakpoint', () => {
    setWindowWidth(375)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)
  })

  it('returns false for tablet breakpoint', () => {
    setWindowWidth(800)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)
  })

  it('returns true for desktop breakpoint', () => {
    setWindowWidth(1280)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
  })
}) 
import { useEffect, useState } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 768) {
        setBreakpoint('mobile')
      } else if (width < 1024) {
        setBreakpoint('tablet')
      } else {
        setBreakpoint('desktop')
      }
    }

    // Set initial breakpoint
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return breakpoint
}

export function useIsMobile(): boolean {
  const breakpoint = useBreakpoint()
  return breakpoint === 'mobile'
}

export function useIsTablet(): boolean {
  const breakpoint = useBreakpoint()
  return breakpoint === 'tablet'
}

export function useIsDesktop(): boolean {
  const breakpoint = useBreakpoint()
  return breakpoint === 'desktop'
} 
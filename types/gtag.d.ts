// Google Analytics type definitions
interface Window {
  gtag?: (
    command: 'config' | 'event' | 'set',
    targetId: string,
    config?: Record<string, any>
  ) => void
}
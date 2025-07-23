// Google Analytics gtag type declarations

interface Window {
  gtag?: (
    command: 'event' | 'config' | 'set' | 'consent',
    targetId: string,
    config?: Gtag.ControlParams | Gtag.EventParams | Gtag.ConfigParams | Gtag.ConsentParams
  ) => void
}

declare namespace Gtag {
  interface EventParams {
    event_category?: string
    event_label?: string
    value?: number
    [key: string]: any
  }

  interface ConfigParams {
    page_path?: string
    page_title?: string
    page_location?: string
    [key: string]: any
  }

  interface ControlParams {
    groups?: string | string[]
    send_to?: string | string[]
    event_callback?: () => void
    event_timeout?: number
    [key: string]: any
  }

  interface ConsentParams {
    ad_storage?: 'granted' | 'denied'
    analytics_storage?: 'granted' | 'denied'
    functionality_storage?: 'granted' | 'denied'
    personalization_storage?: 'granted' | 'denied'
    security_storage?: 'granted' | 'denied'
    [key: string]: any
  }
}

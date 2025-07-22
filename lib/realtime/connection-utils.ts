import { ConnectionQuality, ConnectionState, ConnectionStatus } from './types'

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  return typeof window !== 'undefined' && navigator.onLine
}

/**
 * Format connection status for display
 */
export function formatConnectionStatus(status: ConnectionStatus): string {
  switch (status.state) {
    case 'connected':
      return `Connected (${status.quality})`
    case 'connecting':
      return status.reconnectAttempts > 0
        ? `Reconnecting (attempt ${status.reconnectAttempts})...`
        : 'Connecting...'
    case 'disconnected':
      return 'Disconnected'
    case 'error':
      return `Error: ${status.error || 'Unknown error'}`
  }
}

/**
 * Get connection status color for UI
 */
export function getConnectionColor(status: ConnectionStatus): string {
  if (status.state !== 'connected') {
    return status.state === 'error' ? 'red' : 'yellow'
  }

  switch (status.quality) {
    case 'excellent':
      return 'green'
    case 'good':
      return 'green'
    case 'fair':
      return 'yellow'
    case 'poor':
      return 'red'
  }
}

/**
 * Format latency for display
 */
export function formatLatency(latency: number): string {
  if (latency < 1000) {
    return `${latency}ms`
  }
  return `${(latency / 1000).toFixed(1)}s`
}

/**
 * Calculate connection quality from metrics
 */
export function calculateConnectionQuality(
  latency: number,
  stability: number
): ConnectionQuality {
  if (latency < 100 && stability > 95) return 'excellent'
  if (latency < 300 && stability > 85) return 'good'
  if (latency < 1000 && stability > 70) return 'fair'
  return 'poor'
}

/**
 * Debounce function for real-time updates
 */
export function debounceRealtime<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean; maxWait?: number }
): T & { cancel: () => void; flush: () => void } {
  let timeout: NodeJS.Timeout | null = null
  let lastCallTime: number | null = null
  let lastInvokeTime = 0
  let lastArgs: any[] | null = null
  let lastThis: any = null
  let result: any

  const leading = options?.leading ?? false
  const trailing = options?.trailing ?? true
  const maxWait = options?.maxWait

  function invokeFunc(time: number) {
    const args = lastArgs!
    const thisArg = lastThis

    lastArgs = lastThis = null
    lastInvokeTime = time
    result = func.apply(thisArg, args)
    return result
  }

  function leadingEdge(time: number) {
    lastInvokeTime = time
    timeout = setTimeout(timerExpired, wait)
    return leading ? invokeFunc(time) : result
  }

  function remainingWait(time: number) {
    const timeSinceLastCall = time - (lastCallTime ?? 0)
    const timeSinceLastInvoke = time - lastInvokeTime
    const timeWaiting = wait - timeSinceLastCall

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting
  }

  function shouldInvoke(time: number) {
    const timeSinceLastCall = time - (lastCallTime ?? 0)
    const timeSinceLastInvoke = time - lastInvokeTime

    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    )
  }

  function timerExpired() {
    const time = Date.now()
    if (shouldInvoke(time)) {
      return trailingEdge(time)
    }
    timeout = setTimeout(timerExpired, remainingWait(time))
  }

  function trailingEdge(time: number) {
    timeout = null

    if (trailing && lastArgs) {
      return invokeFunc(time)
    }
    lastArgs = lastThis = null
    return result
  }

  function cancel() {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    lastInvokeTime = 0
    lastArgs = lastCallTime = lastThis = timeout = null
  }

  function flush() {
    return timeout === null ? result : trailingEdge(Date.now())
  }

  function debounced(this: any, ...args: any[]) {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastArgs = args
    lastThis = this
    lastCallTime = time

    if (isInvoking) {
      if (timeout === null) {
        return leadingEdge(lastCallTime)
      }
      if (maxWait !== undefined) {
        timeout = setTimeout(timerExpired, wait)
        return invokeFunc(lastCallTime)
      }
    }
    if (timeout === null) {
      timeout = setTimeout(timerExpired, wait)
    }
    return result
  }

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced as T & { cancel: () => void; flush: () => void }
}

/**
 * Batch multiple updates within a time window
 */
export class UpdateBatcher<T> {
  private batch: T[] = []
  private timer: NodeJS.Timeout | null = null
  private readonly batchSize: number
  private readonly batchDelay: number
  private readonly onBatch: (items: T[]) => void

  constructor(options: {
    batchSize: number
    batchDelay: number
    onBatch: (items: T[]) => void
  }) {
    this.batchSize = options.batchSize
    this.batchDelay = options.batchDelay
    this.onBatch = options.onBatch
  }

  add(item: T): void {
    this.batch.push(item)

    if (this.batch.length >= this.batchSize) {
      this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchDelay)
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.batch.length > 0) {
      const items = [...this.batch]
      this.batch = []
      this.onBatch(items)
    }
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.batch = []
  }

  size(): number {
    return this.batch.length
  }
}

/**
 * Exponential backoff calculator
 */
export class ExponentialBackoff {
  private attempt = 0
  private readonly baseDelay: number
  private readonly maxDelay: number
  private readonly factor: number

  constructor(
    options: {
      baseDelay?: number
      maxDelay?: number
      factor?: number
    } = {}
  ) {
    this.baseDelay = options.baseDelay ?? 1000
    this.maxDelay = options.maxDelay ?? 30000
    this.factor = options.factor ?? 2
  }

  nextDelay(): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(this.factor, this.attempt),
      this.maxDelay
    )
    this.attempt++
    return delay
  }

  reset(): void {
    this.attempt = 0
  }

  getAttempt(): number {
    return this.attempt
  }
}

/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when a service is unhealthy
 */

export interface CircuitBreakerOptions {
  name: string
  timeout?: number          // Request timeout in ms
  errorThreshold?: number   // Error percentage to open circuit
  resetTimeout?: number     // Time to wait before trying again
  monitoringPeriod?: number // Time window for error rate calculation
  minimumRequests?: number  // Minimum requests before calculating error rate
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

interface CircuitStats {
  successCount: number
  failureCount: number
  lastFailureTime?: number
  consecutiveFailures: number
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private stats: CircuitStats = {
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0
  }
  private nextAttempt: number = 0
  private readonly name: string
  private readonly timeout: number
  private readonly errorThreshold: number
  private readonly resetTimeout: number
  private readonly monitoringPeriod: number
  private readonly minimumRequests: number
  private requestTimestamps: number[] = []

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name
    this.timeout = options.timeout || 5000
    this.errorThreshold = options.errorThreshold || 50
    this.resetTimeout = options.resetTimeout || 30000
    this.monitoringPeriod = options.monitoringPeriod || 60000
    this.minimumRequests = options.minimumRequests || 5
  }

  /**
   * Check if circuit breaker is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitStats & { state: CircuitState; errorRate: number } {
    const totalRequests = this.stats.successCount + this.stats.failureCount
    const errorRate = totalRequests > 0 
      ? (this.stats.failureCount / totalRequests) * 100 
      : 0

    return {
      ...this.stats,
      state: this.state,
      errorRate
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`)
      }
      // Move to half-open to test
      this.state = CircuitState.HALF_OPEN
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn)
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.stats.successCount++
    this.stats.consecutiveFailures = 0
    
    // Add timestamp for monitoring window
    this.recordTimestamp()

    if (this.state === CircuitState.HALF_OPEN) {
      // Service has recovered, close the circuit
      this.state = CircuitState.CLOSED
      this.reset()
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.stats.failureCount++
    this.stats.consecutiveFailures++
    this.stats.lastFailureTime = Date.now()
    
    // Add timestamp for monitoring window
    this.recordTimestamp()

    if (this.state === CircuitState.HALF_OPEN) {
      // Service is still failing, reopen the circuit
      this.state = CircuitState.OPEN
      this.nextAttempt = Date.now() + this.resetTimeout
    } else if (this.shouldOpen()) {
      // Too many failures, open the circuit
      this.state = CircuitState.OPEN
      this.nextAttempt = Date.now() + this.resetTimeout
    }
  }

  /**
   * Reset circuit breaker statistics
   */
  reset(): void {
    this.stats = {
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0
    }
    this.requestTimestamps = []
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(
          () => reject(new Error(`Timeout after ${this.timeout}ms`)), 
          this.timeout
        )
      )
    ])
  }

  /**
   * Check if circuit should open based on error rate
   */
  private shouldOpen(): boolean {
    // Clean old timestamps outside monitoring window
    this.cleanOldTimestamps()

    const recentRequests = this.requestTimestamps.length
    
    // Need minimum requests before calculating error rate
    if (recentRequests < this.minimumRequests) {
      return false
    }

    // Calculate error rate in monitoring window
    const recentErrors = this.requestTimestamps.filter((_, index) => {
      // This is simplified - in production you'd track success/failure per timestamp
      return index >= recentRequests - this.stats.failureCount
    }).length

    const errorRate = (recentErrors / recentRequests) * 100
    
    return errorRate >= this.errorThreshold
  }

  /**
   * Record timestamp for monitoring window
   */
  private recordTimestamp(): void {
    this.requestTimestamps.push(Date.now())
    this.cleanOldTimestamps()
  }

  /**
   * Remove timestamps outside monitoring window
   */
  private cleanOldTimestamps(): void {
    const cutoff = Date.now() - this.monitoringPeriod
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > cutoff)
  }
}
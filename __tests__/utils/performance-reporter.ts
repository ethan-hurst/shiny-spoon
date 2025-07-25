/**
 * Performance test reporter for structured logging of benchmark results
 */

interface PerformanceMetric {
  name: string
  duration: number
  unit?: string
  metadata?: Record<string, any>
}

interface PerformanceComparison {
  name: string
  baseline: number
  current: number
  improvement: number
  unit?: string
}

class PerformanceReporter {
  private metrics: PerformanceMetric[] = []
  private comparisons: PerformanceComparison[] = []
  private readonly enabled: boolean

  constructor() {
    // Only enable detailed reporting when explicitly requested
    this.enabled = process.env.PERF_REPORT === 'true' || process.env.VERBOSE_TESTS === 'true'
  }

  /**
   * Log a performance metric
   */
  logMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)
    
    if (this.enabled) {
      const formatted = `[PERF] ${metric.name}: ${metric.duration.toFixed(2)}${metric.unit || 'ms'}`
      const metadata = metric.metadata ? ` | ${JSON.stringify(metric.metadata)}` : ''
      console.info(formatted + metadata)
    }
  }

  /**
   * Log a performance comparison
   */
  logComparison(comparison: PerformanceComparison): void {
    this.comparisons.push(comparison)
    
    if (this.enabled) {
      const improvement = comparison.improvement > 0 ? '↑' : '↓'
      console.info(
        `[PERF] ${comparison.name}: ${comparison.baseline.toFixed(2)}${comparison.unit || 'ms'} → ` +
        `${comparison.current.toFixed(2)}${comparison.unit || 'ms'} ` +
        `(${improvement}${Math.abs(comparison.improvement).toFixed(1)}%)`
      )
    }
  }

  /**
   * Log memory usage
   */
  logMemoryUsage(name: string, bytesUsed: number): void {
    const mb = bytesUsed / 1024 / 1024
    this.logMetric({
      name: `Memory: ${name}`,
      duration: mb,
      unit: 'MB',
    })
  }

  /**
   * Get summary of all metrics
   */
  getSummary(): { metrics: PerformanceMetric[], comparisons: PerformanceComparison[] } {
    return {
      metrics: [...this.metrics],
      comparisons: [...this.comparisons],
    }
  }

  /**
   * Clear all recorded metrics
   */
  clear(): void {
    this.metrics = []
    this.comparisons = []
  }

  /**
   * Print a summary report (only when enabled)
   */
  printSummary(): void {
    if (!this.enabled || this.metrics.length === 0) return

    console.info('\n=== Performance Test Summary ===')
    console.info(`Total metrics recorded: ${this.metrics.length}`)
    
    // Group metrics by name prefix
    const grouped = this.metrics.reduce((acc, metric) => {
      const prefix = metric.name.split(':')[0]
      if (prefix && !acc[prefix]) acc[prefix] = []
      if (prefix && acc[prefix]) acc[prefix].push(metric)
      return acc
    }, {} as Record<string, PerformanceMetric[]>)

    Object.entries(grouped).forEach(([group, metrics]) => {
      console.info(`\n${group}:`)
      metrics.forEach(m => {
        console.info(`  - ${m.name}: ${m.duration.toFixed(2)}${m.unit || 'ms'}`)
      })
    })

    if (this.comparisons.length > 0) {
      console.info('\nComparisons:')
      this.comparisons.forEach(c => {
        const improvement = c.improvement > 0 ? 'faster' : 'slower'
        console.info(
          `  - ${c.name}: ${Math.abs(c.improvement).toFixed(1)}% ${improvement}`
        )
      })
    }
    
    console.info('===============================\n')
  }
}

// Export singleton instance
export const perfReporter = new PerformanceReporter()

// Export helper functions for common operations
export function logPerformance(name: string, duration: number, metadata?: Record<string, any>): void {
  perfReporter.logMetric({ name, duration, metadata: metadata || {} })
}

export function logComparison(
  name: string, 
  baseline: number, 
  current: number,
  unit?: string
): void {
  // Handle division by zero - if baseline is 0, we can't calculate percentage improvement
  let improvement = 0
  if (baseline !== 0) {
    improvement = ((baseline - current) / baseline) * 100
  } else if (current > 0) {
    // If baseline is 0 but current is positive, this is technically infinite% worse
    improvement = -100 // Cap at -100% for practical purposes
  }
  // If both are 0, improvement remains 0
  
  perfReporter.logComparison({ name, baseline, current, improvement, unit: unit || 'ms' })
}

export function logMemory(name: string, bytes: number): void {
  perfReporter.logMemoryUsage(name, bytes)
}
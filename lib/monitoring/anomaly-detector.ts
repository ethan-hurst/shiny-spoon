// PRP-016: Data Accuracy Monitor - Anomaly Detection
import { createAdminClient } from '@/lib/supabase/admin'
import { DiscrepancyResult, AnomalyResult } from './types'

interface AnomalyDetectionConfig {
  discrepancies: DiscrepancyResult[]
  historicalData: HistoricalDiscrepancy[]
}

interface HistoricalDiscrepancy {
  entityType: string
  fieldName: string
  discrepancyType: string
  count: number
  avgSeverity: number
  timestamp: Date
}

export class AnomalyDetector {
  private supabase = createAdminClient()
  
  // Statistical thresholds
  private readonly Z_SCORE_THRESHOLD = 2.5 // 99% confidence
  private readonly MIN_HISTORICAL_POINTS = 10
  private readonly PATTERN_CONFIDENCE_THRESHOLD = 0.8

  async detectAnomalies(
    config: AnomalyDetectionConfig
  ): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = []

    // Group discrepancies by entity type and field
    const groupedDiscrepancies = this.groupDiscrepancies(config.discrepancies)

    for (const [key, discrepancies] of Object.entries(groupedDiscrepancies)) {
      const [entityType, fieldName] = key.split(':')
      
      // Get historical data for this entity/field combination
      const historicalData = config.historicalData.filter(
        h => h.entityType === entityType && h.fieldName === fieldName
      )

      if (historicalData.length >= this.MIN_HISTORICAL_POINTS) {
        // Statistical anomaly detection
        const statisticalAnomalies = this.detectStatisticalAnomalies(
          discrepancies,
          historicalData,
          entityType
        )
        anomalies.push(...statisticalAnomalies)

        // Pattern-based anomaly detection
        const patternAnomalies = this.detectPatternAnomalies(
          discrepancies,
          historicalData,
          entityType
        )
        anomalies.push(...patternAnomalies)
      }

      // Threshold-based anomaly detection (always run)
      const thresholdAnomalies = this.detectThresholdAnomalies(
        discrepancies,
        entityType
      )
      anomalies.push(...thresholdAnomalies)
    }

    // Deduplicate and sort by confidence
    return this.deduplicateAndRankAnomalies(anomalies)
  }

  private groupDiscrepancies(
    discrepancies: DiscrepancyResult[]
  ): Record<string, DiscrepancyResult[]> {
    const grouped: Record<string, DiscrepancyResult[]> = {}

    for (const discrepancy of discrepancies) {
      const key = `${discrepancy.entityType}:${discrepancy.fieldName}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(discrepancy)
    }

    return grouped
  }

  private detectStatisticalAnomalies(
    discrepancies: DiscrepancyResult[],
    historicalData: HistoricalDiscrepancy[],
    entityType: string
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = []

    // Calculate historical statistics
    const historicalCounts = historicalData.map(h => h.count)
    const mean = this.calculateMean(historicalCounts)
    const stdDev = this.calculateStandardDeviation(historicalCounts, mean)

    // Current count
    const currentCount = discrepancies.length

    // Calculate Z-score
    const zScore = stdDev > 0 ? (currentCount - mean) / stdDev : 0

    if (Math.abs(zScore) > this.Z_SCORE_THRESHOLD) {
      anomalies.push({
        entityId: entityType,
        anomalyType: 'statistical',
        confidence: this.zScoreToConfidence(zScore),
        deviationScore: Math.abs(zScore),
        historicalAverage: mean,
        currentValue: currentCount,
        explanation: `Discrepancy count (${currentCount}) is ${Math.abs(zScore).toFixed(1)} standard deviations from historical average (${mean.toFixed(1)})`
      })
    }

    // Check severity distribution
    const severityAnomaly = this.detectSeverityAnomaly(
      discrepancies,
      historicalData
    )
    if (severityAnomaly) {
      anomalies.push(severityAnomaly)
    }

    return anomalies
  }

  private detectPatternAnomalies(
    discrepancies: DiscrepancyResult[],
    historicalData: HistoricalDiscrepancy[],
    entityType: string
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = []

    // Time-based pattern detection
    const timePattern = this.detectTimePattern(historicalData)
    if (timePattern) {
      const expectedCount = this.getExpectedCountFromPattern(
        timePattern,
        new Date()
      )
      const actualCount = discrepancies.length
      const deviation = Math.abs(actualCount - expectedCount) / expectedCount

      if (deviation > 0.5) { // 50% deviation from pattern
        anomalies.push({
          entityId: entityType,
          anomalyType: 'pattern',
          confidence: timePattern.confidence * (1 - deviation / 2),
          deviationScore: deviation,
          historicalAverage: expectedCount,
          currentValue: actualCount,
          explanation: `Current count (${actualCount}) deviates ${(deviation * 100).toFixed(0)}% from expected pattern (${expectedCount.toFixed(0)})`
        })
      }
    }

    // Sudden change detection
    const suddenChange = this.detectSuddenChange(
      discrepancies.length,
      historicalData
    )
    if (suddenChange) {
      anomalies.push(suddenChange)
    }

    return anomalies
  }

  private detectThresholdAnomalies(
    discrepancies: DiscrepancyResult[],
    entityType: string
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = []

    // Critical severity threshold
    const criticalCount = discrepancies.filter(
      d => d.severity === 'critical'
    ).length
    
    if (criticalCount > 0) {
      anomalies.push({
        entityId: entityType,
        anomalyType: 'threshold',
        confidence: 1.0,
        deviationScore: criticalCount,
        currentValue: criticalCount,
        explanation: `${criticalCount} critical severity discrepancies detected`
      })
    }

    // High confidence mismatches
    const highConfidenceMismatches = discrepancies.filter(
      d => d.discrepancyType === 'mismatch' && d.confidence > 0.9
    ).length

    if (highConfidenceMismatches > 5) {
      anomalies.push({
        entityId: entityType,
        anomalyType: 'threshold',
        confidence: 0.9,
        deviationScore: highConfidenceMismatches / 5,
        currentValue: highConfidenceMismatches,
        explanation: `${highConfidenceMismatches} high-confidence data mismatches detected`
      })
    }

    // Stale data threshold
    const staleCount = discrepancies.filter(
      d => d.discrepancyType === 'stale'
    ).length
    const stalePercentage = (staleCount / discrepancies.length) * 100

    if (stalePercentage > 30) {
      anomalies.push({
        entityId: entityType,
        anomalyType: 'threshold',
        confidence: 0.85,
        deviationScore: stalePercentage / 30,
        currentValue: stalePercentage,
        explanation: `${stalePercentage.toFixed(0)}% of data is stale (threshold: 30%)`
      })
    }

    return anomalies
  }

  private detectSeverityAnomaly(
    discrepancies: DiscrepancyResult[],
    historicalData: HistoricalDiscrepancy[]
  ): AnomalyResult | null {
    // Calculate current severity distribution
    const currentSeverityScore = this.calculateSeverityScore(discrepancies)
    
    // Calculate historical average severity
    const historicalAvgSeverity = this.calculateMean(
      historicalData.map(h => h.avgSeverity)
    )

    const severityDeviation = Math.abs(
      currentSeverityScore - historicalAvgSeverity
    )

    if (severityDeviation > 0.3) { // 30% deviation in severity
      return {
        entityId: discrepancies[0].entityType,
        anomalyType: 'statistical',
        confidence: 0.8,
        deviationScore: severityDeviation,
        historicalAverage: historicalAvgSeverity,
        currentValue: currentSeverityScore,
        explanation: `Average severity score (${currentSeverityScore.toFixed(2)}) deviates significantly from historical average (${historicalAvgSeverity.toFixed(2)})`
      }
    }

    return null
  }

  private detectTimePattern(
    historicalData: HistoricalDiscrepancy[]
  ): TimePattern | null {
    // Simple pattern detection - could be enhanced with FFT or other algorithms
    if (historicalData.length < 14) return null

    // Check for weekly pattern
    const weeklyPattern = this.checkWeeklyPattern(historicalData)
    if (weeklyPattern.confidence > this.PATTERN_CONFIDENCE_THRESHOLD) {
      return weeklyPattern
    }

    // Check for daily pattern
    const dailyPattern = this.checkDailyPattern(historicalData)
    if (dailyPattern.confidence > this.PATTERN_CONFIDENCE_THRESHOLD) {
      return dailyPattern
    }

    return null
  }

  private checkWeeklyPattern(
    data: HistoricalDiscrepancy[]
  ): TimePattern {
    // Group by day of week
    const byDayOfWeek: Record<number, number[]> = {}
    
    for (const point of data) {
      const dayOfWeek = point.timestamp.getDay()
      if (!byDayOfWeek[dayOfWeek]) {
        byDayOfWeek[dayOfWeek] = []
      }
      byDayOfWeek[dayOfWeek].push(point.count)
    }

    // Calculate variance within each day
    let totalVariance = 0
    let totalMean = 0
    let dayCount = 0

    for (const [day, counts] of Object.entries(byDayOfWeek)) {
      if (counts.length > 1) {
        const mean = this.calculateMean(counts)
        const variance = this.calculateVariance(counts, mean)
        totalVariance += variance
        totalMean += mean
        dayCount++
      }
    }

    // Calculate overall variance
    const allCounts = data.map(d => d.count)
    const overallVariance = this.calculateVariance(
      allCounts,
      this.calculateMean(allCounts)
    )

    // Pattern confidence based on variance reduction
    const confidence = overallVariance > 0
      ? 1 - (totalVariance / dayCount) / overallVariance
      : 0

    return {
      type: 'weekly',
      confidence,
      parameters: byDayOfWeek
    }
  }

  private checkDailyPattern(
    data: HistoricalDiscrepancy[]
  ): TimePattern {
    // Group by hour of day
    const byHourOfDay: Record<number, number[]> = {}
    
    for (const point of data) {
      const hourOfDay = point.timestamp.getHours()
      if (!byHourOfDay[hourOfDay]) {
        byHourOfDay[hourOfDay] = []
      }
      byHourOfDay[hourOfDay].push(point.count)
    }

    // Similar calculation as weekly pattern
    let totalVariance = 0
    let hourCount = 0

    for (const [hour, counts] of Object.entries(byHourOfDay)) {
      if (counts.length > 1) {
        const mean = this.calculateMean(counts)
        const variance = this.calculateVariance(counts, mean)
        totalVariance += variance
        hourCount++
      }
    }

    const allCounts = data.map(d => d.count)
    const overallVariance = this.calculateVariance(
      allCounts,
      this.calculateMean(allCounts)
    )

    const confidence = overallVariance > 0 && hourCount > 0
      ? 1 - (totalVariance / hourCount) / overallVariance
      : 0

    return {
      type: 'daily',
      confidence,
      parameters: byHourOfDay
    }
  }

  private getExpectedCountFromPattern(
    pattern: TimePattern,
    currentTime: Date
  ): number {
    if (pattern.type === 'weekly') {
      const dayOfWeek = currentTime.getDay()
      const dayCounts = pattern.parameters[dayOfWeek] || []
      return dayCounts.length > 0 ? this.calculateMean(dayCounts) : 0
    } else if (pattern.type === 'daily') {
      const hourOfDay = currentTime.getHours()
      const hourCounts = pattern.parameters[hourOfDay] || []
      return hourCounts.length > 0 ? this.calculateMean(hourCounts) : 0
    }
    return 0
  }

  private detectSuddenChange(
    currentCount: number,
    historicalData: HistoricalDiscrepancy[]
  ): AnomalyResult | null {
    if (historicalData.length < 2) return null

    // Get most recent historical point
    const sortedHistory = [...historicalData].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    )
    const mostRecent = sortedHistory[0]

    // Calculate change rate
    const changeRate = mostRecent.count > 0
      ? Math.abs(currentCount - mostRecent.count) / mostRecent.count
      : currentCount > 0 ? 1 : 0

    if (changeRate > 1) { // 100% change
      return {
        entityId: historicalData[0].entityType,
        anomalyType: 'pattern',
        confidence: Math.min(0.95, 0.5 + changeRate / 4),
        deviationScore: changeRate,
        historicalAverage: mostRecent.count,
        currentValue: currentCount,
        explanation: `Sudden ${changeRate > 1 ? 'increase' : 'decrease'} of ${(changeRate * 100).toFixed(0)}% from last period`
      }
    }

    return null
  }

  private calculateSeverityScore(discrepancies: DiscrepancyResult[]): number {
    const severityWeights = {
      critical: 1.0,
      high: 0.7,
      medium: 0.4,
      low: 0.1
    }

    let totalScore = 0
    for (const discrepancy of discrepancies) {
      totalScore += severityWeights[discrepancy.severity] || 0
    }

    return discrepancies.length > 0 ? totalScore / discrepancies.length : 0
  }

  private deduplicateAndRankAnomalies(
    anomalies: AnomalyResult[]
  ): AnomalyResult[] {
    // Remove duplicates based on entityId and anomalyType
    const uniqueAnomalies = new Map<string, AnomalyResult>()

    for (const anomaly of anomalies) {
      const key = `${anomaly.entityId}:${anomaly.anomalyType}`
      const existing = uniqueAnomalies.get(key)
      
      // Keep the one with higher confidence
      if (!existing || anomaly.confidence > existing.confidence) {
        uniqueAnomalies.set(key, anomaly)
      }
    }

    // Sort by confidence descending
    return Array.from(uniqueAnomalies.values()).sort(
      (a, b) => b.confidence - a.confidence
    )
  }

  // Statistical helper methods
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private calculateStandardDeviation(
    values: number[],
    mean: number
  ): number {
    if (values.length <= 1) return 0
    
    const variance = this.calculateVariance(values, mean)
    return Math.sqrt(variance)
  }

  private calculateVariance(values: number[], mean: number): number {
    if (values.length <= 1) return 0
    
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1)
  }

  private zScoreToConfidence(zScore: number): number {
    // Convert Z-score to confidence level (0-1)
    const absZ = Math.abs(zScore)
    if (absZ >= 3) return 0.99
    if (absZ >= 2.5) return 0.95
    if (absZ >= 2) return 0.90
    if (absZ >= 1.5) return 0.80
    return 0.70
  }
}

interface TimePattern {
  type: 'daily' | 'weekly'
  confidence: number
  parameters: Record<number, number[]>
}
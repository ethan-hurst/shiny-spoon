// PRP-016: Data Accuracy Monitor - Accuracy Scorer
import { createAdminClient } from '@/lib/supabase/admin'
import { AccuracyMetric, AccuracyTrendPoint, DiscrepancyResult } from './types'

interface ScoringConfig {
  organizationId: string
  integrationId?: string
  startDate?: Date
  endDate?: Date
  bucketDuration?: number // seconds
}

interface AccuracyBreakdown {
  overall: number
  byEntityType: Record<string, number>
  bySeverity: Record<string, number>
  byDiscrepancyType: Record<string, number>
}

interface TrendAnalysis {
  trend: 'improving' | 'stable' | 'declining'
  changeRate: number // percentage change
  volatility: number // standard deviation
  forecast: number // predicted next period score
}

export class AccuracyScorer {
  private supabase = createAdminClient()

  // Scoring weights
  private readonly SEVERITY_WEIGHTS = {
    critical: 1.0,
    high: 0.7,
    medium: 0.3,
    low: 0.1,
  }

  private readonly ENTITY_WEIGHTS = {
    inventory: 1.0,
    pricing: 0.9,
    product: 0.8,
    customer: 0.7,
  }

  async calculateScore(
    totalRecords: number,
    discrepancies: DiscrepancyResult[]
  ): Promise<number> {
    if (totalRecords === 0) return 100

    // Calculate weighted discrepancy impact
    let weightedImpact = 0

    for (const discrepancy of discrepancies) {
      const severityWeight = this.SEVERITY_WEIGHTS[discrepancy.severity] || 0.5
      const entityWeight = this.ENTITY_WEIGHTS[discrepancy.entityType] || 0.5
      const confidenceWeight = discrepancy.confidence

      // Combined weight considers severity, entity importance, and confidence
      const combinedWeight = severityWeight * entityWeight * confidenceWeight
      weightedImpact += combinedWeight
    }

    // Calculate base score
    const baseScore = 100 - (weightedImpact / totalRecords) * 100

    // Apply additional factors
    const adjustedScore = this.applyAdjustments(baseScore, discrepancies, totalRecords)

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, adjustedScore))
  }

  private applyAdjustments(
    baseScore: number,
    discrepancies: DiscrepancyResult[],
    totalRecords: number
  ): number {
    let adjustedScore = baseScore

    // Penalty for high concentration of critical issues
    const criticalCount = discrepancies.filter(d => d.severity === 'critical').length
    const criticalRatio = criticalCount / totalRecords
    if (criticalRatio > 0.01) { // More than 1% critical
      adjustedScore *= (1 - criticalRatio * 0.5) // Up to 50% penalty
    }

    // Bonus for low overall discrepancy rate
    const discrepancyRate = discrepancies.length / totalRecords
    if (discrepancyRate < 0.01) { // Less than 1% discrepancies
      adjustedScore += (100 - adjustedScore) * 0.1 // 10% bonus towards perfect
    }

    // Penalty for stale data
    const staleCount = discrepancies.filter(d => d.discrepancyType === 'stale').length
    const staleRatio = staleCount / totalRecords
    if (staleRatio > 0.05) { // More than 5% stale
      adjustedScore *= 0.95 // 5% penalty
    }

    return adjustedScore
  }

  async getAccuracyBreakdown(
    config: ScoringConfig
  ): Promise<AccuracyBreakdown> {
    // Get latest check results
    const { data: latestCheck } = await this.supabase
      .from('accuracy_checks')
      .select('*')
      .eq('organization_id', config.organizationId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (!latestCheck) {
      return {
        overall: 100,
        byEntityType: {},
        bySeverity: {},
        byDiscrepancyType: {},
      }
    }

    // Get discrepancies for this check
    const { data: discrepancies } = await this.supabase
      .from('discrepancies')
      .select('*')
      .eq('accuracy_check_id', latestCheck.id)

    if (!discrepancies || discrepancies.length === 0) {
      return {
        overall: latestCheck.accuracy_score || 100,
        byEntityType: {},
        bySeverity: {},
        byDiscrepancyType: {},
      }
    }

    // Calculate breakdowns
    const byEntityType = this.calculateEntityBreakdown(
      discrepancies,
      latestCheck.records_checked
    )
    
    const bySeverity = this.calculateSeverityBreakdown(
      discrepancies,
      latestCheck.records_checked
    )
    
    const byDiscrepancyType = this.calculateTypeBreakdown(
      discrepancies,
      latestCheck.records_checked
    )

    return {
      overall: latestCheck.accuracy_score || 100,
      byEntityType,
      bySeverity,
      byDiscrepancyType,
    }
  }

  private calculateEntityBreakdown(
    discrepancies: any[],
    totalRecords: number
  ): Record<string, number> {
    const breakdown: Record<string, number> = {}
    const entityCounts: Record<string, number> = {}

    // Count discrepancies by entity type
    for (const discrepancy of discrepancies) {
      entityCounts[discrepancy.entity_type] = 
        (entityCounts[discrepancy.entity_type] || 0) + 1
    }

    // Calculate accuracy for each entity type
    for (const [entityType, count] of Object.entries(entityCounts)) {
      // Estimate records per entity type (in production, query actual counts)
      const estimatedRecords = totalRecords / Object.keys(entityCounts).length
      const entityScore = ((estimatedRecords - count) / estimatedRecords) * 100
      breakdown[entityType] = Math.max(0, Math.min(100, entityScore))
    }

    return breakdown
  }

  private calculateSeverityBreakdown(
    discrepancies: any[],
    totalRecords: number
  ): Record<string, number> {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }

    for (const discrepancy of discrepancies) {
      severityCounts[discrepancy.severity as keyof typeof severityCounts]++
    }

    const breakdown: Record<string, number> = {}
    
    for (const [severity, count] of Object.entries(severityCounts)) {
      // Higher severity has more impact
      const weight = this.SEVERITY_WEIGHTS[severity as keyof typeof this.SEVERITY_WEIGHTS]
      const impact = (count * weight) / totalRecords
      breakdown[severity] = Math.max(0, 100 - impact * 100)
    }

    return breakdown
  }

  private calculateTypeBreakdown(
    discrepancies: any[],
    totalRecords: number
  ): Record<string, number> {
    const typeCounts = {
      missing: 0,
      mismatch: 0,
      stale: 0,
      duplicate: 0,
    }

    for (const discrepancy of discrepancies) {
      typeCounts[discrepancy.discrepancy_type as keyof typeof typeCounts]++
    }

    const breakdown: Record<string, number> = {}
    
    for (const [type, count] of Object.entries(typeCounts)) {
      const ratio = count / totalRecords
      breakdown[type] = Math.max(0, 100 - ratio * 100)
    }

    return breakdown
  }

  async getTrendAnalysis(
    config: ScoringConfig
  ): Promise<TrendAnalysis> {
    // Get historical metrics
    const query = this.supabase
      .from('accuracy_metrics')
      .select('*')
      .eq('organization_id', config.organizationId)
      .order('metric_timestamp', { ascending: false })
      .limit(30) // Last 30 data points

    if (config.integrationId) {
      query.eq('integration_id', config.integrationId)
    }

    if (config.startDate) {
      query.gte('metric_timestamp', config.startDate.toISOString())
    }

    if (config.endDate) {
      query.lte('metric_timestamp', config.endDate.toISOString())
    }

    const { data: metrics } = await query

    if (!metrics || metrics.length < 2) {
      return {
        trend: 'stable',
        changeRate: 0,
        volatility: 0,
        forecast: 100,
      }
    }

    // Calculate trend
    const scores = metrics.map(m => m.accuracy_score).reverse()
    const trend = this.calculateTrend(scores)
    
    // Calculate change rate
    const latestScore = scores[scores.length - 1]
    const firstScore = scores[0]
    const changeRate = ((latestScore - firstScore) / firstScore) * 100

    // Calculate volatility (standard deviation)
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
    const volatility = Math.sqrt(variance)

    // Simple forecast (linear regression)
    const forecast = this.forecastNextScore(scores)

    return {
      trend: trend > 0.1 ? 'improving' : trend < -0.1 ? 'declining' : 'stable',
      changeRate,
      volatility,
      forecast,
    }
  }

  private calculateTrend(scores: number[]): number {
    if (scores.length < 2) return 0

    // Simple linear regression slope
    const n = scores.length
    const xSum = (n * (n - 1)) / 2
    const xMean = xSum / n
    const yMean = scores.reduce((sum, y) => sum + y, 0) / n

    let numerator = 0
    let denominator = 0

    for (let i = 0; i < n; i++) {
      const x = i
      const y = scores[i]
      numerator += (x - xMean) * (y - yMean)
      denominator += Math.pow(x - xMean, 2)
    }

    return denominator === 0 ? 0 : numerator / denominator
  }

  private forecastNextScore(scores: number[]): number {
    if (scores.length === 0) return 100
    if (scores.length === 1) return scores[0]

    // Simple moving average for forecast
    const recentScores = scores.slice(-5) // Last 5 scores
    const average = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length

    // Apply trend adjustment
    const trend = this.calculateTrend(scores)
    const forecast = average + trend

    // Ensure forecast is within valid range
    return Math.max(0, Math.min(100, forecast))
  }

  async getHistoricalTrend(
    config: ScoringConfig
  ): Promise<AccuracyTrendPoint[]> {
    const query = this.supabase
      .from('accuracy_metrics')
      .select('*')
      .eq('organization_id', config.organizationId)
      .order('metric_timestamp', { ascending: true })

    if (config.integrationId) {
      query.eq('integration_id', config.integrationId)
    }

    if (config.startDate) {
      query.gte('metric_timestamp', config.startDate.toISOString())
    }

    if (config.endDate) {
      query.lte('metric_timestamp', config.endDate.toISOString())
    }

    const { data: metrics } = await query

    if (!metrics) return []

    return metrics.map(metric => ({
      timestamp: new Date(metric.metric_timestamp),
      accuracyScore: metric.accuracy_score,
      recordsChecked: metric.total_records,
      discrepancyCount: metric.discrepancy_count,
      integrationId: metric.integration_id,
    }))
  }

  async storeMetrics(
    organizationId: string,
    integrationId: string | undefined,
    accuracyScore: number,
    totalRecords: number,
    discrepancyCount: number,
    metricsByType?: Record<string, number>
  ): Promise<void> {
    const bucketDuration = 300 // 5 minutes

    await this.supabase
      .from('accuracy_metrics')
      .insert({
        organization_id: organizationId,
        integration_id: integrationId,
        accuracy_score: accuracyScore,
        total_records: totalRecords,
        discrepancy_count: discrepancyCount,
        metrics_by_type: metricsByType || {},
        metric_timestamp: new Date().toISOString(),
        bucket_duration: bucketDuration,
      })
  }

  async getBenchmarkComparison(
    organizationId: string
  ): Promise<{
    organizationScore: number
    industryAverage: number
    percentile: number
  }> {
    // Get organization's latest score
    const { data: orgMetric } = await this.supabase
      .from('accuracy_metrics')
      .select('accuracy_score')
      .eq('organization_id', organizationId)
      .order('metric_timestamp', { ascending: false })
      .limit(1)
      .single()

    const organizationScore = orgMetric?.accuracy_score || 100

    // In production, this would query industry benchmarks
    // For now, using mock data
    const industryAverage = 95.5
    const industryStdDev = 2.5

    // Calculate percentile based on normal distribution
    const zScore = (organizationScore - industryAverage) / industryStdDev
    const percentile = this.zScoreToPercentile(zScore)

    return {
      organizationScore,
      industryAverage,
      percentile,
    }
  }

  private zScoreToPercentile(zScore: number): number {
    // Approximation of normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(zScore))
    const d = 0.3989423 * Math.exp(-zScore * zScore / 2)
    const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    
    if (zScore > 0) {
      return (1 - probability) * 100
    } else {
      return probability * 100
    }
  }

  async getAccuracyReport(
    config: ScoringConfig
  ): Promise<{
    summary: AccuracyBreakdown
    trend: TrendAnalysis
    benchmark: {
      organizationScore: number
      industryAverage: number
      percentile: number
    }
    recommendations: string[]
  }> {
    const [summary, trend, benchmark] = await Promise.all([
      this.getAccuracyBreakdown(config),
      this.getTrendAnalysis(config),
      this.getBenchmarkComparison(config.organizationId),
    ])

    const recommendations = this.generateRecommendations(summary, trend, benchmark)

    return {
      summary,
      trend,
      benchmark,
      recommendations,
    }
  }

  private generateRecommendations(
    summary: AccuracyBreakdown,
    trend: TrendAnalysis,
    benchmark: { percentile: number }
  ): string[] {
    const recommendations: string[] = []

    // Trend-based recommendations
    if (trend.trend === 'declining') {
      recommendations.push(
        'Accuracy is trending downward. Review recent system changes and integration configurations.'
      )
    }

    if (trend.volatility > 5) {
      recommendations.push(
        'High volatility detected. Consider implementing more frequent sync schedules to maintain consistency.'
      )
    }

    // Score-based recommendations
    if (summary.overall < 95) {
      recommendations.push(
        'Overall accuracy below 95%. Focus on resolving critical discrepancies first.'
      )
    }

    // Entity-specific recommendations
    for (const [entity, score] of Object.entries(summary.byEntityType)) {
      if (score < 90) {
        recommendations.push(
          `${entity} accuracy is low (${score.toFixed(1)}%). Review ${entity} sync mappings and validation rules.`
        )
      }
    }

    // Benchmark recommendations
    if (benchmark.percentile < 50) {
      recommendations.push(
        'Your accuracy is below industry average. Consider implementing automated validation rules.'
      )
    }

    // Severity-based recommendations
    if (summary.bySeverity.critical && summary.bySeverity.critical < 100) {
      recommendations.push(
        'Critical discrepancies detected. These should be addressed immediately to prevent business impact.'
      )
    }

    return recommendations
  }
}
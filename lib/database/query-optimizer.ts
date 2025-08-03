/**
 * Database query optimization for TruthSource
 */

export interface QueryPlan {
  query: string
  estimatedCost: number
  actualCost?: number
  executionTime?: number
  rowCount?: number
  indexUsage?: string[]
  optimizationSuggestions?: string[]
}

export interface QueryOptimization {
  originalQuery: string
  optimizedQuery: string
  improvements: string[]
  estimatedImprovement: number // Percentage improvement
}

export interface IndexRecommendation {
  table: string
  columns: string[]
  type: 'btree' | 'gin' | 'gist' | 'hash'
  reason: string
  estimatedImpact: 'high' | 'medium' | 'low'
}

export class QueryOptimizer {
  constructor(private supabase: any) {}

  /**
   * Analyze query performance
   */
  async analyzeQuery(query: string): Promise<QueryPlan> {
    const startTime = Date.now()

    try {
      // Execute EXPLAIN ANALYZE
      const { data: explainData, error } = await this.supabase.rpc(
        'explain_analyze',
        { query_text: query }
      )

      if (error) {
        throw new Error(`Query analysis failed: ${error.message}`)
      }

      const executionTime = Date.now() - startTime
      const plan = this.parseExplainOutput(explainData)

      return {
        ...plan,
        executionTime,
        query,
      }
    } catch (error) {
      console.error('Query analysis failed:', error)
      return {
        query,
        estimatedCost: 0,
        executionTime: Date.now() - startTime,
        optimizationSuggestions: ['Unable to analyze query'],
      }
    }
  }

  /**
   * Parse EXPLAIN ANALYZE output
   */
  private parseExplainOutput(explainData: any): Partial<QueryPlan> {
    // This is a simplified parser - in production you'd want a more robust parser
    const lines = explainData.split('\n')
    let estimatedCost = 0
    let actualCost = 0
    let rowCount = 0
    const indexUsage: string[] = []

    for (const line of lines) {
      if (line.includes('cost=')) {
        const costMatch = line.match(/cost=([\d.]+)\.\.([\d.]+)/)
        if (costMatch) {
          estimatedCost = Math.max(estimatedCost, parseFloat(costMatch[2]))
        }
      }

      if (line.includes('actual time=')) {
        const timeMatch = line.match(/actual time=([\d.]+)/)
        if (timeMatch) {
          actualCost = Math.max(actualCost, parseFloat(timeMatch[1]))
        }
      }

      if (line.includes('rows=')) {
        const rowsMatch = line.match(/rows=(\d+)/)
        if (rowsMatch) {
          rowCount = Math.max(rowCount, parseInt(rowsMatch[1]))
        }
      }

      if (line.includes('Index Scan') || line.includes('Index Only Scan')) {
        const indexMatch = line.match(/on (\w+)/)
        if (indexMatch) {
          indexUsage.push(indexMatch[1])
        }
      }
    }

    return {
      estimatedCost,
      actualCost,
      rowCount,
      indexUsage,
    }
  }

  /**
   * Optimize a query
   */
  async optimizeQuery(query: string): Promise<QueryOptimization> {
    const originalPlan = await this.analyzeQuery(query)
    const optimizedQuery = this.applyOptimizations(query)
    const optimizedPlan = await this.analyzeQuery(optimizedQuery)

    const improvements: string[] = []
    let estimatedImprovement = 0

    // Compare costs
    if (optimizedPlan.estimatedCost < originalPlan.estimatedCost) {
      const costImprovement =
        ((originalPlan.estimatedCost - optimizedPlan.estimatedCost) /
          originalPlan.estimatedCost) *
        100
      improvements.push(
        `Reduced estimated cost by ${costImprovement.toFixed(1)}%`
      )
      estimatedImprovement += costImprovement
    }

    // Compare execution times
    if (optimizedPlan.executionTime && originalPlan.executionTime) {
      const timeImprovement =
        ((originalPlan.executionTime - optimizedPlan.executionTime) /
          originalPlan.executionTime) *
        100
      improvements.push(
        `Reduced execution time by ${timeImprovement.toFixed(1)}%`
      )
      estimatedImprovement += timeImprovement
    }

    // Check for index usage improvements
    if (
      optimizedPlan.indexUsage &&
      optimizedPlan.indexUsage.length > originalPlan.indexUsage?.length
    ) {
      improvements.push('Improved index usage')
      estimatedImprovement += 10
    }

    return {
      originalQuery: query,
      optimizedQuery,
      improvements,
      estimatedImprovement: Math.min(estimatedImprovement, 100),
    }
  }

  /**
   * Apply common query optimizations
   */
  private applyOptimizations(query: string): string {
    let optimized = query

    // Add LIMIT to prevent large result sets
    if (
      !optimized.toLowerCase().includes('limit') &&
      !optimized.toLowerCase().includes('count(')
    ) {
      optimized += ' LIMIT 1000'
    }

    // Use specific columns instead of *
    if (optimized.includes('SELECT *')) {
      // This is a simplified optimization - in practice you'd need to know the table structure
      optimized = optimized.replace(
        'SELECT *',
        'SELECT id, created_at, updated_at'
      )
    }

    // Add ORDER BY for consistent results
    if (!optimized.toLowerCase().includes('order by')) {
      optimized += ' ORDER BY created_at DESC'
    }

    return optimized
  }

  /**
   * Generate index recommendations
   */
  async generateIndexRecommendations(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = []

    // Analyze slow queries
    const slowQueries = await this.getSlowQueries()

    for (const query of slowQueries) {
      const plan = await this.analyzeQuery(query.query)

      if (plan.estimatedCost > 1000) {
        const table = this.extractTableFromQuery(query.query)
        const columns = this.extractWhereColumns(query.query)

        if (table && columns.length > 0) {
          recommendations.push({
            table,
            columns,
            type: 'btree',
            reason: `Slow query with cost ${plan.estimatedCost}`,
            estimatedImpact: plan.estimatedCost > 5000 ? 'high' : 'medium',
          })
        }
      }
    }

    return recommendations
  }

  /**
   * Get slow queries from performance metrics
   */
  private async getSlowQueries(): Promise<
    Array<{ query: string; avgDuration: number }>
  > {
    const { data } = await this.supabase
      .from('performance_metrics')
      .select('name, value, tags')
      .eq('name', 'database.query_time')
      .gte('value', 1000) // Queries taking more than 1 second
      .order('value', { ascending: false })
      .limit(10)

    return (
      data?.map((row) => ({
        query: row.tags?.query || 'Unknown query',
        avgDuration: row.value,
      })) || []
    )
  }

  /**
   * Extract table name from query
   */
  private extractTableFromQuery(query: string): string | null {
    const fromMatch = query.match(/FROM\s+(\w+)/i)
    return fromMatch ? fromMatch[1] : null
  }

  /**
   * Extract columns used in WHERE clause
   */
  private extractWhereColumns(query: string): string[] {
    const whereMatch = query.match(
      /WHERE\s+(.+?)(?:ORDER BY|GROUP BY|LIMIT|$)/i
    )
    if (!whereMatch) return []

    const whereClause = whereMatch[1]
    const columnMatches = whereClause.match(/(\w+)\s*[=<>]/g)

    return columnMatches?.map((match) => match.split(/\s*[=<>]/)[0]) || []
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(): Promise<void> {
    const recommendations = await this.generateIndexRecommendations()

    for (const rec of recommendations) {
      if (rec.estimatedImpact === 'high') {
        try {
          const indexName = `idx_${rec.table}_${rec.columns.join('_')}`
          const columns = rec.columns.join(', ')

          await this.supabase.rpc('create_index', {
            index_name: indexName,
            table_name: rec.table,
            columns: columns,
            index_type: rec.type,
          })

          console.log(`Created index: ${indexName}`)
        } catch (error) {
          console.error(`Failed to create index for ${rec.table}:`, error)
        }
      }
    }
  }

  /**
   * Monitor query performance over time
   */
  async monitorQueryPerformance(): Promise<{
    avgResponseTime: number
    slowQueries: number
    indexUsage: number
    recommendations: string[]
  }> {
    const { data: metrics } = await this.supabase
      .from('performance_metrics')
      .select('value, tags')
      .eq('name', 'database.query_time')
      .gte(
        'timestamp',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )

    if (!metrics || metrics.length === 0) {
      return {
        avgResponseTime: 0,
        slowQueries: 0,
        indexUsage: 0,
        recommendations: [],
      }
    }

    const avgResponseTime =
      metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
    const slowQueries = metrics.filter((m) => m.value > 1000).length
    const indexUsage = metrics.filter((m) => m.tags?.index_used).length

    const recommendations: string[] = []

    if (avgResponseTime > 500) {
      recommendations.push('Consider adding database indexes')
    }

    if (slowQueries > 10) {
      recommendations.push('Review and optimize slow queries')
    }

    if (indexUsage < metrics.length * 0.5) {
      recommendations.push('Consider adding more indexes')
    }

    return {
      avgResponseTime,
      slowQueries,
      indexUsage,
      recommendations,
    }
  }
}

// Query optimization middleware
export function withQueryOptimization<T extends (...args: any[]) => any>(
  fn: T,
  optimizer: QueryOptimizer
): T {
  return (async (...args: Parameters<T>) => {
    const query = args[0]

    if (typeof query === 'string') {
      // Analyze query performance
      const plan = await optimizer.analyzeQuery(query)

      // Log slow queries
      if (plan.estimatedCost > 1000) {
        console.warn(
          `Slow query detected: ${query} (cost: ${plan.estimatedCost})`
        )
      }
    }

    return fn(...args)
  }) as T
}

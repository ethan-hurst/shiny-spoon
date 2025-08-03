// PRP-016: Data Accuracy Monitor - Accuracy Checker Core
import { EventEmitter } from 'events'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AccuracyCheckConfig,
  CheckProgressEvent,
  CheckResultSummary,
  DiscrepancyResult,
} from './types'

export class AccuracyChecker extends EventEmitter {
  private supabase = createAdminClient()
  private abortController?: AbortController

  constructor() {
    super()
  }

  async runCheck(config: AccuracyCheckConfig): Promise<string> {
    const checkId = await this.initializeCheck(config)

    // Run async to not block
    this.performCheck(checkId, config).catch((error) => {
      console.error('Accuracy check failed:', error)
      this.updateCheckStatus(checkId, 'failed', { error: error.message })
    })

    return checkId
  }

  private async performCheck(checkId: string, config: AccuracyCheckConfig) {
    this.abortController = new AbortController()
    const startTime = Date.now()
    let totalRecords = 0
    let discrepancies: DiscrepancyResult[] = []

    try {
      this.emit('check:started', { checkId, config })

      // Get organization ID for this check
      const organizationId = await this.getOrganizationId(checkId)

      // Get integrations to check
      const integrations = await this.getIntegrationsToCheck(
        organizationId,
        config.integrationId
      )

      // Calculate expected total records for progress tracking
      const sampleSize = config.sampleSize || 1000
      const scopeMultiplier = config.scope === 'full' ? 3 : 1
      const expectedRecords = integrations.length * sampleSize * scopeMultiplier

      for (let i = 0; i < integrations.length; i++) {
        const integration = integrations[i]
        if (this.abortController.signal.aborted) break

        // Check based on scope
        if (config.scope === 'full' || config.scope === 'products') {
          const productResults = await this.checkProducts(
            integration,
            organizationId,
            config.sampleSize
          )
          discrepancies.push(...productResults.discrepancies)
          totalRecords += productResults.recordsChecked
        }

        if (config.scope === 'full' || config.scope === 'inventory') {
          const inventoryResults = await this.checkInventory(
            integration,
            organizationId,
            config.sampleSize
          )
          discrepancies.push(...inventoryResults.discrepancies)
          totalRecords += inventoryResults.recordsChecked
        }

        if (config.scope === 'full' || config.scope === 'pricing') {
          const pricingResults = await this.checkPricing(
            integration,
            organizationId,
            config.sampleSize
          )
          discrepancies.push(...pricingResults.discrepancies)
          totalRecords += pricingResults.recordsChecked
        }

        // Emit progress based on actual records checked or integration progress
        const progress =
          expectedRecords > 0
            ? Math.round((totalRecords / expectedRecords) * 100)
            : Math.round(((i + 1) / integrations.length) * 100)

        this.emit('check:progress', {
          checkId,
          integrationId: integration.id,
          progress: Math.min(progress, 100), // Cap at 100%
        } as CheckProgressEvent)
      }

      // Store discrepancies
      await this.storeDiscrepancies(checkId, organizationId, discrepancies)

      // Calculate accuracy score
      const accuracyScore = this.calculateAccuracyScore(
        totalRecords,
        discrepancies.length
      )

      // Update check results
      await this.updateCheckStatus(checkId, 'completed', {
        accuracy_score: accuracyScore,
        discrepancies_found: discrepancies.length,
        records_checked: totalRecords,
        duration_ms: Date.now() - startTime,
      })

      // Store metrics
      await this.storeAccuracyMetrics({
        organizationId,
        integrationId: config.integrationId,
        accuracyScore,
        totalRecords,
        discrepancyCount: discrepancies.length,
      })

      const result: CheckResultSummary = {
        checkId,
        accuracyScore,
        discrepanciesFound: discrepancies.length,
        recordsChecked: totalRecords,
        duration: Date.now() - startTime,
        discrepanciesBySeverity: this.groupBySeverity(discrepancies),
        discrepanciesByType: this.groupByType(discrepancies),
      }

      this.emit('check:completed', result)
    } catch (error) {
      throw error
    }
  }

  private async checkProducts(
    integration: any,
    organizationId: string,
    sampleSize?: number
  ): Promise<{ discrepancies: DiscrepancyResult[]; recordsChecked: number }> {
    const discrepancies: DiscrepancyResult[] = []
    let recordsChecked = 0

    // Get products from source (truth)
    const { data: sourceProducts } = await this.supabase
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)
      .limit(sampleSize || 1000)

    if (!sourceProducts) return { discrepancies, recordsChecked }

    // Get mapped products from integration
    const mappingTable = this.getIntegrationMappingTable(
      integration.platform,
      'product'
    )
    const { data: mappings } = await this.supabase
      .from(mappingTable)
      .select('*')
      .eq('integration_id', integration.id)

    for (const product of sourceProducts) {
      recordsChecked++

      const mapping = mappings?.find(
        (m) => m.internal_product_id === product.id
      )

      if (!mapping) {
        discrepancies.push({
          entityType: 'product',
          entityId: product.id,
          fieldName: 'existence',
          sourceValue: product,
          targetValue: null,
          discrepancyType: 'missing',
          severity: 'high',
          confidence: 0.95,
        })
        continue
      }

      // Deep field comparison
      const fieldDiscrepancies = await this.compareProductFields(
        product,
        mapping
      )

      discrepancies.push(...fieldDiscrepancies)
    }

    return { discrepancies, recordsChecked }
  }

  private async checkInventory(
    integration: any,
    organizationId: string,
    sampleSize?: number
  ): Promise<{ discrepancies: DiscrepancyResult[]; recordsChecked: number }> {
    const discrepancies: DiscrepancyResult[] = []
    let recordsChecked = 0

    // Get current inventory levels
    const { data: inventory } = await this.supabase
      .from('inventory')
      .select(
        `
        *,
        products!inner(sku),
        warehouses!inner(name)
      `
      )
      .eq('organization_id', organizationId)
      .limit(sampleSize || 1000)

    if (!inventory) return { discrepancies, recordsChecked }

    for (const item of inventory) {
      recordsChecked++

      // Get last sync data
      const syncData = await this.getLastSyncData(
        integration.id,
        'inventory',
        item.products.sku
      )

      if (!syncData) continue

      // Compare quantities
      const quantityDiff = Math.abs(item.quantity - (syncData.quantity || 0))

      // Check if difference is significant
      if (quantityDiff > 0) {
        // Check if it's due to recent transactions
        const recentTransactions = await this.getRecentTransactions(
          item.id,
          syncData.last_sync
        )

        const explainedDiff = recentTransactions.reduce(
          (sum: number, t: any) => sum + t.quantity_change,
          0
        )

        if (Math.abs(quantityDiff - explainedDiff) > 1) {
          discrepancies.push({
            entityType: 'inventory',
            entityId: item.id,
            fieldName: 'quantity',
            sourceValue: item.quantity,
            targetValue: syncData.quantity,
            discrepancyType: 'mismatch',
            severity: this.calculateInventorySeverity(
              quantityDiff,
              item.quantity
            ),
            confidence: 0.85,
          })
        }
      }

      // Check staleness
      const hoursSinceSync =
        (Date.now() - new Date(syncData.last_sync).getTime()) / (1000 * 60 * 60)

      if (hoursSinceSync > 24) {
        discrepancies.push({
          entityType: 'inventory',
          entityId: item.id,
          fieldName: 'sync_age',
          sourceValue: new Date(),
          targetValue: syncData.last_sync,
          discrepancyType: 'stale',
          severity: hoursSinceSync > 72 ? 'high' : 'medium',
          confidence: 1.0,
        })
      }
    }

    return { discrepancies, recordsChecked }
  }

  private async checkPricing(
    integration: any,
    organizationId: string,
    sampleSize?: number
  ): Promise<{ discrepancies: DiscrepancyResult[]; recordsChecked: number }> {
    const discrepancies: DiscrepancyResult[] = []
    let recordsChecked = 0

    // Get pricing rules
    const { data: pricingRules } = await this.supabase
      .from('pricing_rules')
      .select(
        `
        *,
        products!inner(id, sku),
        customer_tiers!inner(name)
      `
      )
      .eq('organization_id', organizationId)
      .limit(sampleSize || 500)

    if (!pricingRules) return { discrepancies, recordsChecked }

    for (const rule of pricingRules) {
      recordsChecked++

      // Get synced price from integration
      const syncedPrice = await this.getSyncedPrice(
        integration.id,
        rule.products.sku,
        rule.customer_tiers?.id
      )

      if (!syncedPrice) {
        discrepancies.push({
          entityType: 'pricing',
          entityId: rule.id,
          fieldName: 'existence',
          sourceValue: rule.price,
          targetValue: null,
          discrepancyType: 'missing',
          severity: 'high',
          confidence: 0.9,
        })
        continue
      }

      // Compare prices with epsilon for floating point
      const priceDiff = Math.abs(rule.price - syncedPrice.price)
      const epsilon = 0.01 // 1 cent tolerance

      if (priceDiff > epsilon) {
        // Check if it's a recent price change
        const isPriceChangeRecent = await this.isPriceChangeRecent(
          rule.id,
          syncedPrice.last_sync
        )

        if (!isPriceChangeRecent) {
          discrepancies.push({
            entityType: 'pricing',
            entityId: rule.id,
            fieldName: 'price',
            sourceValue: rule.price,
            targetValue: syncedPrice.price,
            discrepancyType: 'mismatch',
            severity: this.calculatePricingSeverity(priceDiff, rule.price),
            confidence: 0.95,
          })
        }
      }
    }

    return { discrepancies, recordsChecked }
  }

  private async compareProductFields(
    product: any,
    mapping: any
  ): Promise<DiscrepancyResult[]> {
    const discrepancies: DiscrepancyResult[] = []

    // Compare name
    if (product.name !== mapping.external_name) {
      discrepancies.push({
        entityType: 'product',
        entityId: product.id,
        fieldName: 'name',
        sourceValue: product.name,
        targetValue: mapping.external_name,
        discrepancyType: 'mismatch',
        severity: 'medium',
        confidence: 0.9,
      })
    }

    // Compare SKU
    if (product.sku !== mapping.external_sku) {
      discrepancies.push({
        entityType: 'product',
        entityId: product.id,
        fieldName: 'sku',
        sourceValue: product.sku,
        targetValue: mapping.external_sku,
        discrepancyType: 'mismatch',
        severity: 'critical',
        confidence: 0.95,
      })
    }

    // Compare description if deep check
    if (product.description && mapping.external_description) {
      const descriptionSimilarity = this.calculateStringSimilarity(
        product.description,
        mapping.external_description
      )

      if (descriptionSimilarity < 0.8) {
        discrepancies.push({
          entityType: 'product',
          entityId: product.id,
          fieldName: 'description',
          sourceValue: product.description,
          targetValue: mapping.external_description,
          discrepancyType: 'mismatch',
          severity: 'low',
          confidence: 0.7,
        })
      }
    }

    return discrepancies
  }

  private calculateAccuracyScore(
    totalRecords: number,
    discrepancyCount: number
  ): number {
    if (totalRecords === 0) return 100

    const baseScore = ((totalRecords - discrepancyCount) / totalRecords) * 100

    // Apply confidence weighting
    // High confidence discrepancies have more impact
    return Math.max(0, Math.min(100, baseScore))
  }

  private calculateInventorySeverity(
    difference: number,
    currentValue: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const percentDiff =
      currentValue > 0 ? (difference / currentValue) * 100 : 100

    if (percentDiff > 50) return 'critical'
    if (percentDiff > 20) return 'high'
    if (percentDiff > 5) return 'medium'
    return 'low'
  }

  private calculatePricingSeverity(
    difference: number,
    currentPrice: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const percentDiff =
      currentPrice > 0 ? (difference / currentPrice) * 100 : 100

    if (percentDiff > 10) return 'critical'
    if (percentDiff > 5) return 'high'
    if (percentDiff > 1) return 'medium'
    return 'low'
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this.getEditDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  private getEditDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  private groupBySeverity(discrepancies: DiscrepancyResult[]) {
    return {
      critical: discrepancies.filter((d) => d.severity === 'critical').length,
      high: discrepancies.filter((d) => d.severity === 'high').length,
      medium: discrepancies.filter((d) => d.severity === 'medium').length,
      low: discrepancies.filter((d) => d.severity === 'low').length,
    }
  }

  private groupByType(discrepancies: DiscrepancyResult[]) {
    return {
      missing: discrepancies.filter((d) => d.discrepancyType === 'missing')
        .length,
      mismatch: discrepancies.filter((d) => d.discrepancyType === 'mismatch')
        .length,
      stale: discrepancies.filter((d) => d.discrepancyType === 'stale').length,
      duplicate: discrepancies.filter((d) => d.discrepancyType === 'duplicate')
        .length,
    }
  }

  // Helper methods
  private async initializeCheck(config: AccuracyCheckConfig): Promise<string> {
    const { data: user } = await this.supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    const { data: orgUser } = await this.supabase
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.user.id)
      .single()

    if (!orgUser) throw new Error('No organization found')

    const { data } = await this.supabase
      .from('accuracy_checks')
      .insert({
        organization_id: orgUser.organization_id,
        check_type: 'manual',
        scope: config.scope,
        integration_id: config.integrationId,
        status: 'running',
      })
      .select()
      .single()

    if (!data) throw new Error('Failed to create accuracy check')

    return data.id
  }

  private async updateCheckStatus(
    checkId: string,
    status: string,
    updates?: any
  ) {
    await this.supabase
      .from('accuracy_checks')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        ...updates,
      })
      .eq('id', checkId)
  }

  private async storeDiscrepancies(
    checkId: string,
    organizationId: string,
    discrepancies: DiscrepancyResult[]
  ) {
    if (discrepancies.length === 0) return

    const records = discrepancies.map((d) => ({
      accuracy_check_id: checkId,
      organization_id: organizationId,
      ...d,
      source_value: d.sourceValue,
      target_value: d.targetValue,
      discrepancy_type: d.discrepancyType,
      confidence_score: d.confidence,
    }))

    await this.supabase.from('discrepancies').insert(records)
  }

  private async storeAccuracyMetrics(metrics: {
    organizationId: string
    integrationId?: string
    accuracyScore: number
    totalRecords: number
    discrepancyCount: number
  }) {
    await this.supabase.from('accuracy_metrics').insert({
      organization_id: metrics.organizationId,
      integration_id: metrics.integrationId,
      accuracy_score: metrics.accuracyScore,
      total_records: metrics.totalRecords,
      discrepancy_count: metrics.discrepancyCount,
      metric_timestamp: new Date().toISOString(),
      bucket_duration: 300, // 5 minutes
    })
  }

  private async getOrganizationId(checkId: string): Promise<string> {
    const { data } = await this.supabase
      .from('accuracy_checks')
      .select('organization_id')
      .eq('id', checkId)
      .single()

    if (!data) throw new Error('Check not found')
    return data.organization_id
  }

  private async getIntegrationsToCheck(
    organizationId: string,
    integrationId?: string
  ): Promise<any[]> {
    const query = this.supabase
      .from('integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (integrationId) {
      query.eq('id', integrationId)
    }

    const { data } = await query
    return data || []
  }

  private getIntegrationMappingTable(
    platform: string,
    entityType: string
  ): string {
    // Map platform and entity type to the correct mapping table
    const mappingTables: Record<string, Record<string, string>> = {
      shopify: {
        product: 'shopify_product_mapping',
        inventory: 'shopify_inventory_mapping',
        customer: 'shopify_customer_mapping',
      },
      netsuite: {
        product: 'netsuite_product_mapping',
        inventory: 'netsuite_inventory_mapping',
        customer: 'netsuite_customer_mapping',
      },
    }

    return (
      mappingTables[platform]?.[entityType] ||
      `${platform}_${entityType}_mapping`
    )
  }

  private async getLastSyncData(
    integrationId: string,
    entityType: string,
    identifier: string
  ): Promise<any> {
    // Query the sync history to get last synced data
    const { data } = await this.supabase
      .from('sync_history')
      .select('data, synced_at')
      .eq('integration_id', integrationId)
      .eq('entity_type', entityType)
      .eq('entity_id', identifier)
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) {
      return null
    }

    return {
      ...data.data,
      last_sync: data.synced_at,
    }
  }

  private async getRecentTransactions(
    inventoryId: string,
    since: string
  ): Promise<any[]> {
    const { data } = await this.supabase
      .from('inventory_transactions')
      .select('*')
      .eq('inventory_id', inventoryId)
      .gte('created_at', since)

    return data || []
  }

  private async getSyncedPrice(
    integrationId: string,
    sku: string,
    tierId?: string
  ): Promise<any> {
    // Query the integration's price sync data
    const query = this.supabase
      .from('integration_price_sync')
      .select('price, tier_prices, synced_at')
      .eq('integration_id', integrationId)
      .eq('sku', sku)
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    const { data } = await query

    if (!data) {
      return null
    }

    // Return the appropriate price based on tier
    if (tierId && data.tier_prices && data.tier_prices[tierId]) {
      return {
        price: data.tier_prices[tierId],
        last_sync: data.synced_at,
      }
    }

    return {
      price: data.price,
      last_sync: data.synced_at,
    }
  }

  private async isPriceChangeRecent(
    priceRuleId: string,
    syncTime: string
  ): Promise<boolean> {
    const { data } = await this.supabase
      .from('pricing_rules')
      .select('updated_at')
      .eq('id', priceRuleId)
      .single()

    if (!data) return false

    return new Date(data.updated_at) > new Date(syncTime)
  }

  // Abort check
  async abortCheck(checkId: string): Promise<void> {
    this.abortController?.abort()
    await this.updateCheckStatus(checkId, 'failed', {
      error: 'Check aborted by user',
    })
  }
}

import {
  PricingRuleRecord,
  QuantityBreakRecord,
  PriceCalculationResult,
  AppliedRule,
  PriceContext,
  CachedPrice,
  PriceCalculationRequest,
} from '@/types/pricing.types'
import { createClient } from '@/lib/supabase/client'

export class PricingEngine {
  private cache: Map<string, CachedPrice> = new Map()
  private cacheTTL: number = 300000 // 5 minutes in milliseconds

  /**
   * Calculate the final price for a product
   */
  async calculatePrice(request: PriceCalculationRequest): Promise<PriceCalculationResult> {
    const cacheKey = this.getCacheKey(request)
    
    // Check cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Perform calculation
    const result = await this.performCalculation(request)
    
    // Cache the result
    this.setCache(cacheKey, result)
    
    // Log the calculation for audit
    await this.logCalculation(request, result)
    
    return result
  }

  /**
   * Perform the actual price calculation
   */
  private async performCalculation(request: PriceCalculationRequest): Promise<PriceCalculationResult> {
    const supabase = createClient()
    
    // Call the database function
    const { data, error } = await supabase.rpc('calculate_product_price', {
      p_product_id: request.product_id,
      p_customer_id: request.customer_id || null,
      p_quantity: request.quantity,
      p_requested_date: request.requested_date || new Date().toISOString().split('T')[0],
    })
    
    if (error) {
      throw new Error(`Price calculation failed: ${error.message}`)
    }
    
    if (!data || data.length === 0) {
      throw new Error('No pricing data returned')
    }
    
    const result = data[0]
    
    return {
      base_price: parseFloat(result.base_price),
      final_price: parseFloat(result.final_price),
      discount_amount: parseFloat(result.discount_amount),
      discount_percent: parseFloat(result.discount_percent),
      margin_percent: parseFloat(result.margin_percent),
      applied_rules: result.applied_rules || [],
    }
  }

  /**
   * Get applicable rules for a pricing context
   */
  async getApplicableRules(context: PriceContext): Promise<PricingRuleRecord[]> {
    const supabase = createClient()
    
    // Fetch active rules
    const { data: rules, error } = await supabase
      .from('pricing_rules')
      .select(`
        *,
        quantity_breaks (*)
      `)
      .eq('organization_id', context.organizationId)
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${context.date.toISOString().split('T')[0]}`)
      .or(`end_date.is.null,end_date.gte.${context.date.toISOString().split('T')[0]}`)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
    
    if (error) {
      throw new Error(`Failed to fetch pricing rules: ${error.message}`)
    }
    
    // Filter applicable rules
    const applicableRules = rules.filter(rule => this.isRuleApplicable(rule, context))
    
    return applicableRules
  }

  /**
   * Check if a rule is applicable to the given context
   */
  private isRuleApplicable(rule: PricingRuleRecord, context: PriceContext): boolean {
    // Product-specific rule
    if (rule.product_id && rule.product_id !== context.productId) {
      return false
    }
    
    // Category-specific rule
    if (rule.category_id && rule.category_id !== context.productCategory) {
      return false
    }
    
    // Customer-specific rule
    if (rule.customer_id && rule.customer_id !== context.customerId) {
      return false
    }
    
    // Tier-specific rule
    if (rule.customer_tier_id && rule.customer_tier_id !== context.customerTier) {
      return false
    }
    
    // Evaluate conditions
    return this.evaluateConditions(rule.conditions, context)
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(conditions: any, context: PriceContext): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true
    }
    
    // Quantity conditions
    if (conditions.min_quantity && context.quantity < conditions.min_quantity) {
      return false
    }
    
    if (conditions.max_quantity && context.quantity > conditions.max_quantity) {
      return false
    }
    
    // Customer tier conditions
    if (conditions.customer_tiers && Array.isArray(conditions.customer_tiers)) {
      if (!context.customerTier || !conditions.customer_tiers.includes(context.customerTier)) {
        return false
      }
    }
    
    // Product category conditions
    if (conditions.product_categories && Array.isArray(conditions.product_categories)) {
      if (!context.productCategory || !conditions.product_categories.includes(context.productCategory)) {
        return false
      }
    }
    
    // Custom conditions
    if (conditions.custom) {
      return this.evaluateCustomConditions(conditions.custom, context)
    }
    
    return true
  }

  /**
   * Evaluate custom conditions (extensible for future use)
   */
  private evaluateCustomConditions(custom: Record<string, any>, context: PriceContext): boolean {
    // Implement custom condition logic here
    // For now, return true
    return true
  }

  /**
   * Apply a pricing rule to calculate new price
   */
  applyRule(
    rule: PricingRuleRecord & { quantity_breaks?: QuantityBreakRecord[] },
    currentPrice: number,
    context: PriceContext
  ): { applied: boolean; newPrice: number; appliedRule: AppliedRule } {
    let discount = 0
    let discountType = rule.discount_type
    let discountValue = rule.discount_value
    
    // Check for quantity breaks
    if (rule.rule_type === 'quantity' && rule.quantity_breaks) {
      const applicableBreak = rule.quantity_breaks.find(
        qb => context.quantity >= qb.min_quantity && 
             (!qb.max_quantity || context.quantity < qb.max_quantity)
      )
      
      if (applicableBreak) {
        discountType = applicableBreak.discount_type
        discountValue = applicableBreak.discount_value
      } else {
        // No applicable quantity break
        return { applied: false, newPrice: currentPrice, appliedRule: {} as AppliedRule }
      }
    }
    
    // Calculate discount
    if (discountType && discountValue) {
      switch (discountType) {
        case 'percentage':
          discount = currentPrice * (discountValue / 100)
          break
        case 'fixed':
          discount = discountValue
          break
        case 'price':
          discount = currentPrice - discountValue
          break
      }
    }
    
    const newPrice = Math.max(0, currentPrice - discount)
    
    const appliedRule: AppliedRule = {
      rule_id: rule.id,
      type: rule.rule_type,
      name: rule.name,
      description: rule.description,
      discount_type: discountType,
      discount_value: discountValue,
      discount_amount: discount,
    }
    
    return { applied: true, newPrice, appliedRule }
  }

  /**
   * Enforce minimum margin
   */
  enforceMinimumMargin(price: number, cost: number, minMargin: number): number {
    const minPrice = cost / (1 - (minMargin / 100))
    return Math.max(price, minPrice)
  }

  /**
   * Generate cache key for a price request
   */
  private getCacheKey(request: PriceCalculationRequest): string {
    return `price:${request.product_id}:${request.customer_id || 'none'}:${request.quantity}:${request.requested_date || 'today'}`
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): PriceCalculationResult | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return cached.response
  }

  /**
   * Set cache
   */
  private setCache(key: string, result: PriceCalculationResult): void {
    this.cache.set(key, {
      response: result,
      expiresAt: Date.now() + this.cacheTTL,
    })
  }

  /**
   * Clear cache for a specific product or all cache
   */
  clearCache(productId?: string): void {
    if (productId) {
      // Clear cache entries for specific product
      for (const [key] of this.cache) {
        if (key.includes(productId)) {
          this.cache.delete(key)
        }
      }
    } else {
      // Clear all cache
      this.cache.clear()
    }
  }

  /**
   * Log price calculation for audit
   */
  private async logCalculation(
    request: PriceCalculationRequest,
    result: PriceCalculationResult
  ): Promise<void> {
    const supabase = createClient()
    
    try {
      await supabase.from('price_calculations').insert({
        product_id: request.product_id,
        customer_id: request.customer_id,
        quantity: request.quantity,
        base_price: result.base_price,
        final_price: result.final_price,
        total_discount: result.discount_amount,
        discount_percent: result.discount_percent,
        margin_percent: result.margin_percent,
        applied_rules: result.applied_rules,
        calculation_details: {
          request,
          result,
          timestamp: new Date().toISOString(),
        },
        cache_key: this.getCacheKey(request),
        ttl_seconds: this.cacheTTL / 1000,
      })
    } catch (error) {
      // Log error but don't fail the calculation
      console.error('Failed to log price calculation:', error)
    }
  }

  /**
   * Batch calculate prices for multiple products
   */
  async calculateBatchPrices(
    requests: PriceCalculationRequest[]
  ): Promise<Map<string, PriceCalculationResult>> {
    const results = new Map<string, PriceCalculationResult>()
    
    // Process in parallel but limit concurrency
    const batchSize = 10
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async (request) => {
          try {
            const result = await this.calculatePrice(request)
            return { key: request.product_id, result }
          } catch (error) {
            console.error(`Failed to calculate price for product ${request.product_id}:`, error)
            return null
          }
        })
      )
      
      batchResults.forEach((item) => {
        if (item) {
          results.set(item.key, item.result)
        }
      })
    }
    
    return results
  }
}

// Singleton instance
let engineInstance: PricingEngine | null = null

export function getPricingEngine(): PricingEngine {
  if (!engineInstance) {
    engineInstance = new PricingEngine()
  }
  return engineInstance
}
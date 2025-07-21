import { PriceCalculationRequest, PriceCalculationResult } from '@/types/pricing.types'
import { getPricingEngine } from './pricing-engine'

/**
 * Calculate price for a single product
 */
export async function calculatePrice(
  request: PriceCalculationRequest
): Promise<PriceCalculationResult> {
  const engine = getPricingEngine()
  return engine.calculatePrice(request)
}

/**
 * Calculate prices for multiple products
 */
export async function calculateBatchPrices(
  requests: PriceCalculationRequest[]
): Promise<Map<string, PriceCalculationResult>> {
  const engine = getPricingEngine()
  return engine.calculateBatchPrices(requests)
}

/**
 * Quick price calculation for UI display
 */
export async function getQuickPrice(
  productId: string,
  customerId?: string,
  quantity: number = 1
): Promise<number> {
  try {
    const result = await calculatePrice({
      product_id: productId,
      customer_id: customerId,
      quantity,
    })
    return result.final_price
  } catch (error) {
    console.error('Quick price calculation failed:', error)
    return 0
  }
}

/**
 * Calculate price with explanation for display
 */
export async function calculatePriceWithExplanation(
  request: PriceCalculationRequest
): Promise<{
  result: PriceCalculationResult
  explanation: string[]
}> {
  const result = await calculatePrice(request)
  const explanation: string[] = []
  
  // Build explanation
  explanation.push(`Base price: $${result.base_price.toFixed(2)}`)
  
  if (result.applied_rules.length > 0) {
    explanation.push('Applied discounts:')
    
    result.applied_rules.forEach((rule) => {
      let ruleText = `• ${rule.name || rule.type}`
      
      if (rule.discount_type === 'percentage') {
        ruleText += ` (${rule.discount_value}% off)`
      } else if (rule.discount_type === 'fixed') {
        ruleText += ` ($${rule.discount_value} off)`
      } else if (rule.discount_type === 'price') {
        ruleText += ` (special price: $${rule.discount_value})`
      }
      
      if (rule.discount_amount) {
        ruleText += ` = -$${rule.discount_amount.toFixed(2)}`
      }
      
      explanation.push(ruleText)
    })
  }
  
  if (result.discount_amount > 0) {
    explanation.push(`Total discount: $${result.discount_amount.toFixed(2)} (${result.discount_percent.toFixed(1)}%)`)
  }
  
  explanation.push(`Final price: $${result.final_price.toFixed(2)}`)
  
  if (result.margin_percent !== undefined) {
    explanation.push(`Margin: ${result.margin_percent.toFixed(1)}%`)
  }
  
  return { result, explanation }
}

/**
 * Compare prices for different scenarios
 */
export async function comparePrices(
  productId: string,
  scenarios: Array<{
    customerId?: string
    quantity: number
    label: string
  }>
): Promise<Array<{
  scenario: typeof scenarios[0]
  result: PriceCalculationResult
  savings: number
  savingsPercent: number
}>> {
  const results = await Promise.all(
    scenarios.map(async (scenario) => {
      const result = await calculatePrice({
        product_id: productId,
        customer_id: scenario.customerId,
        quantity: scenario.quantity,
      })
      
      return {
        scenario,
        result,
        savings: result.discount_amount,
        savingsPercent: result.discount_percent,
      }
    })
  )
  
  return results
}

/**
 * Calculate quantity break prices for display
 */
export async function getQuantityBreakPrices(
  productId: string,
  customerId?: string,
  quantities: number[] = [1, 10, 25, 50, 100]
): Promise<Array<{
  quantity: number
  unitPrice: number
  totalPrice: number
  savings: number
  savingsPercent: number
}>> {
  const results = await Promise.all(
    quantities.map(async (quantity) => {
      const result = await calculatePrice({
        product_id: productId,
        customer_id: customerId,
        quantity,
      })
      
      return {
        quantity,
        unitPrice: result.final_price,
        totalPrice: result.final_price * quantity,
        savings: result.discount_amount * quantity,
        savingsPercent: result.discount_percent,
      }
    })
  )
  
  return results
}

/**
 * Validate if a price meets minimum margin requirements
 */
export function validatePriceMargin(
  price: number,
  cost: number,
  minMarginPercent: number
): {
  isValid: boolean
  currentMargin: number
  requiredPrice: number
} {
  const currentMargin = ((price - cost) / price) * 100
  const requiredPrice = cost / (1 - (minMarginPercent / 100))
  
  return {
    isValid: currentMargin >= minMarginPercent,
    currentMargin,
    requiredPrice,
  }
}

/**
 * Clear pricing cache
 */
export function clearPricingCache(productId?: string): void {
  const engine = getPricingEngine()
  engine.clearCache(productId)
}
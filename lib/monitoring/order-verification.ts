import { createServerClient } from '@/lib/supabase/server'
import { createBrowserClient } from '@/lib/supabase/client'
import { z } from 'zod'

// Verification schemas
const OrderVerificationSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  verification_type: z.enum(['pricing', 'inventory', 'customer', 'shipping', 'complete']),
  status: z.enum(['pending', 'verified', 'failed', 'error']),
  erp_data: z.record(z.any()),
  ecommerce_data: z.record(z.any()),
  differences: z.array(z.object({
    field: z.string(),
    erp_value: z.any(),
    ecommerce_value: z.any(),
    severity: z.enum(['low', 'medium', 'high', 'critical'])
  })),
  verified_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string()
})

const FixVerificationSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  error_id: z.string(),
  fix_applied: z.boolean(),
  fix_type: z.enum(['automatic', 'manual', 'ai_assisted']),
  fix_details: z.record(z.any()),
  verification_result: z.enum(['success', 'partial', 'failed']),
  before_state: z.record(z.any()),
  after_state: z.record(z.any()),
  fix_duration_ms: z.number(),
  created_at: z.string()
})

export class OrderVerificationEngine {
  private supabase: any
  private realtimeChannel: any

  constructor() {
    this.supabase = createServerClient()
  }

  /**
   * Monitor order in real-time and verify fixes
   */
  async monitorOrderFix(orderId: string, errorId: string) {
    const startTime = Date.now()
    
    // Subscribe to real-time updates
    this.realtimeChannel = this.supabase
      .channel(`order-fix-${orderId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'order_errors' },
        (payload: any) => {
          if (payload.new?.id === errorId && payload.new?.fixed) {
            this.verifyFix(orderId, errorId, startTime)
          }
        }
      )
      .subscribe()

    // Set up timeout for verification
    setTimeout(() => {
      this.realtimeChannel?.unsubscribe()
    }, 30000) // 30 second timeout
  }

  /**
   * Verify that a fix was actually applied correctly
   */
  async verifyFix(orderId: string, errorId: string, startTime: number) {
    try {
      // Get the error details
      const { data: error } = await this.supabase
        .from('order_errors')
        .select('*')
        .eq('id', errorId)
        .single()

      if (!error) {
        throw new Error('Error not found')
      }

      // Get order data before and after fix
      const beforeState = await this.getOrderState(orderId, 'before')
      const afterState = await this.getOrderState(orderId, 'after')

      // Verify the fix was applied correctly
      const verificationResult = await this.verifyFixApplication(
        error,
        beforeState,
        afterState
      )

      // Record the fix verification
      const fixDuration = Date.now() - startTime
      await this.recordFixVerification({
        order_id: orderId,
        error_id: errorId,
        fix_applied: verificationResult.success,
        fix_type: verificationResult.fixType,
        fix_details: verificationResult.details,
        verification_result: verificationResult.result,
        before_state: beforeState,
        after_state: afterState,
        fix_duration_ms: fixDuration
      })

      return verificationResult

    } catch (error) {
      console.error('Fix verification failed:', error)
      return {
        success: false,
        result: 'failed' as const,
        fixType: 'automatic' as const,
        details: { error: error.message }
      }
    }
  }

  /**
   * Verify that the fix was applied correctly based on error type
   */
  private async verifyFixApplication(error: any, beforeState: any, afterState: any) {
    switch (error.error_type) {
      case 'pricing':
        return this.verifyPricingFix(error, beforeState, afterState)
      case 'inventory':
        return this.verifyInventoryFix(error, beforeState, afterState)
      case 'customer':
        return this.verifyCustomerFix(error, beforeState, afterState)
      case 'shipping':
        return this.verifyShippingFix(error, beforeState, afterState)
      default:
        return this.verifyGenericFix(error, beforeState, afterState)
    }
  }

  private async verifyPricingFix(error: any, beforeState: any, afterState: any) {
    const beforePricing = beforeState.pricing || {}
    const afterPricing = afterState.pricing || {}

    // Check if pricing discrepancies were resolved
    const pricingFixed = this.comparePricingData(beforePricing, afterPricing)
    
    return {
      success: pricingFixed,
      result: pricingFixed ? 'success' : 'failed',
      fixType: 'automatic' as const,
      details: {
        pricing_accuracy: this.calculatePricingAccuracy(beforePricing, afterPricing),
        discrepancies_resolved: pricingFixed
      }
    }
  }

  private async verifyInventoryFix(error: any, beforeState: any, afterState: any) {
    const beforeInventory = beforeState.inventory || {}
    const afterInventory = afterState.inventory || {}

    // Check if inventory levels are now accurate
    const inventoryFixed = this.compareInventoryData(beforeInventory, afterInventory)

    return {
      success: inventoryFixed,
      result: inventoryFixed ? 'success' : 'failed',
      fixType: 'automatic' as const,
      details: {
        inventory_accuracy: this.calculateInventoryAccuracy(beforeInventory, afterInventory),
        stock_levels_synced: inventoryFixed
      }
    }
  }

  private async verifyCustomerFix(error: any, beforeState: any, afterState: any) {
    const beforeCustomer = beforeState.customer || {}
    const afterCustomer = afterState.customer || {}

    // Check if customer data is now consistent
    const customerFixed = this.compareCustomerData(beforeCustomer, afterCustomer)

    return {
      success: customerFixed,
      result: customerFixed ? 'success' : 'failed',
      fixType: 'automatic' as const,
      details: {
        customer_data_consistency: this.calculateCustomerConsistency(beforeCustomer, afterCustomer),
        customer_info_synced: customerFixed
      }
    }
  }

  private async verifyShippingFix(error: any, beforeState: any, afterState: any) {
    const beforeShipping = beforeState.shipping || {}
    const afterShipping = afterState.shipping || {}

    // Check if shipping information is now accurate
    const shippingFixed = this.compareShippingData(beforeShipping, afterShipping)

    return {
      success: shippingFixed,
      result: shippingFixed ? 'success' : 'failed',
      fixType: 'automatic' as const,
      details: {
        shipping_accuracy: this.calculateShippingAccuracy(beforeShipping, afterShipping),
        shipping_info_synced: shippingFixed
      }
    }
  }

  private async verifyGenericFix(error: any, beforeState: any, afterState: any) {
    // Generic verification for unknown error types
    const differences = this.findDifferences(beforeState, afterState)
    const fixed = differences.length === 0

    return {
      success: fixed,
      result: fixed ? 'success' : 'failed',
      fixType: 'automatic' as const,
      details: {
        differences_resolved: differences.length === 0,
        remaining_differences: differences
      }
    }
  }

  /**
   * Compare pricing data between ERP and e-commerce
   */
  private comparePricingData(beforePricing: any, afterPricing: any): boolean {
    const criticalFields = ['unit_price', 'total_price', 'discount_amount', 'tax_amount']
    
    for (const field of criticalFields) {
      if (beforePricing[field] !== afterPricing[field]) {
        return false
      }
    }
    
    return true
  }

  /**
   * Compare inventory data between ERP and e-commerce
   */
  private compareInventoryData(beforeInventory: any, afterInventory: any): boolean {
    const criticalFields = ['available_quantity', 'reserved_quantity', 'total_quantity']
    
    for (const field of criticalFields) {
      if (beforeInventory[field] !== afterInventory[field]) {
        return false
      }
    }
    
    return true
  }

  /**
   * Compare customer data between ERP and e-commerce
   */
  private compareCustomerData(beforeCustomer: any, afterCustomer: any): boolean {
    const criticalFields = ['customer_id', 'email', 'shipping_address', 'billing_address']
    
    for (const field of criticalFields) {
      if (beforeCustomer[field] !== afterCustomer[field]) {
        return false
      }
    }
    
    return true
  }

  /**
   * Compare shipping data between ERP and e-commerce
   */
  private compareShippingData(beforeShipping: any, afterShipping: any): boolean {
    const criticalFields = ['shipping_method', 'shipping_cost', 'delivery_date', 'tracking_number']
    
    for (const field of criticalFields) {
      if (beforeShipping[field] !== afterShipping[field]) {
        return false
      }
    }
    
    return true
  }

  /**
   * Calculate accuracy percentages for different data types
   */
  private calculatePricingAccuracy(before: any, after: any): number {
    const fields = Object.keys(before)
    if (fields.length === 0) return 100

    let accurateFields = 0
    for (const field of fields) {
      if (before[field] === after[field]) {
        accurateFields++
      }
    }

    return (accurateFields / fields.length) * 100
  }

  private calculateInventoryAccuracy(before: any, after: any): number {
    return this.calculatePricingAccuracy(before, after) // Same logic
  }

  private calculateCustomerConsistency(before: any, after: any): number {
    return this.calculatePricingAccuracy(before, after) // Same logic
  }

  private calculateShippingAccuracy(before: any, after: any): number {
    return this.calculatePricingAccuracy(before, after) // Same logic
  }

  /**
   * Find differences between two data objects
   */
  private findDifferences(before: any, after: any): any[] {
    const differences = []
    
    for (const key in before) {
      if (before[key] !== after[key]) {
        differences.push({
          field: key,
          before_value: before[key],
          after_value: after[key]
        })
      }
    }
    
    return differences
  }

  /**
   * Get order state from different sources
   */
  private async getOrderState(orderId: string, timing: 'before' | 'after') {
    // In a real implementation, this would fetch from ERP and e-commerce APIs
    // For now, we'll simulate the data
    return {
      order_id: orderId,
      pricing: {
        unit_price: timing === 'after' ? 100 : 95,
        total_price: timing === 'after' ? 1000 : 950,
        discount_amount: 0,
        tax_amount: timing === 'after' ? 80 : 76
      },
      inventory: {
        available_quantity: timing === 'after' ? 50 : 45,
        reserved_quantity: 10,
        total_quantity: timing === 'after' ? 60 : 55
      },
      customer: {
        customer_id: 'CUST-001',
        email: 'customer@example.com',
        shipping_address: '123 Main St',
        billing_address: '123 Main St'
      },
      shipping: {
        shipping_method: 'Standard',
        shipping_cost: timing === 'after' ? 15 : 10,
        delivery_date: '2024-01-15',
        tracking_number: timing === 'after' ? 'TRK123456' : null
      }
    }
  }

  /**
   * Record fix verification in database
   */
  private async recordFixVerification(verificationData: any) {
    try {
      const { error } = await this.supabase
        .from('fix_verifications')
        .insert({
          ...verificationData,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Failed to record fix verification:', error)
      }
    } catch (error) {
      console.error('Error recording fix verification:', error)
    }
  }

  /**
   * Generate verification report
   */
  async generateVerificationReport(startDate: string, endDate: string) {
    const { data: verifications } = await this.supabase
      .from('fix_verifications')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const report = {
      totalFixes: verifications?.length || 0,
      successfulFixes: verifications?.filter(v => v.verification_result === 'success').length || 0,
      failedFixes: verifications?.filter(v => v.verification_result === 'failed').length || 0,
      averageFixTime: verifications?.reduce((sum, v) => sum + v.fix_duration_ms, 0) / (verifications?.length || 1),
      fixSuccessRate: 0,
      breakdownByType: {} as Record<string, any>
    }

    if (report.totalFixes > 0) {
      report.fixSuccessRate = (report.successfulFixes / report.totalFixes) * 100
    }

    // Breakdown by fix type
    const fixTypes = ['pricing', 'inventory', 'customer', 'shipping']
    for (const type of fixTypes) {
      const typeVerifications = verifications?.filter(v => 
        v.fix_details?.type === type || v.fix_details?.error_type === type
      ) || []
      
      report.breakdownByType[type] = {
        total: typeVerifications.length,
        successful: typeVerifications.filter(v => v.verification_result === 'success').length,
        successRate: typeVerifications.length > 0 ? 
          (typeVerifications.filter(v => v.verification_result === 'success').length / typeVerifications.length) * 100 : 0
      }
    }

    return report
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
    }
  }
} 
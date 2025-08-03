import {
  checkRuleConflicts,
  createCustomerPricingSchema,
  createPricingRuleSchema,
  createProductPricingSchema,
  formatQuantityBreaksDisplay,
  parseQuantityBreaksCSV,
  priceCalculationRequestSchema,
  pricingRuleFiltersSchema,
  pricingRuleImportSchema,
  productPricingImportSchema,
  transformPricingRuleImport,
  transformProductPricingImport,
  updateCustomerPricingSchema,
  updatePricingRuleSchema,
  updateProductPricingSchema,
  validateDateRange,
  validateMargin,
  validatePriceGreaterThanCost,
  validateQuantityBreaks,
} from '@/lib/pricing/validations'
import {
  customerPricingBaseSchema,
  customerPricingSchema,
  PricingRule,
  pricingRuleBaseSchema,
  PricingRuleRecord,
  pricingRuleSchema,
  ProductPricing,
  productPricingSchema,
  QuantityBreak,
  quantityBreakSchema,
} from '@/types/pricing.types'

// Mock dependencies
jest.mock('@/types/pricing.types', () => ({
  customerPricingSchema: {
    parse: jest.fn(),
    safeParse: jest.fn(),
  },
  customerPricingBaseSchema: {
    partial: jest.fn().mockReturnValue({
      shape: {},
    }),
  },
  pricingRuleSchema: {
    shape: {},
    parse: jest.fn(),
    safeParse: jest.fn(),
  },
  pricingRuleBaseSchema: {
    partial: jest.fn().mockReturnValue({
      shape: {},
    }),
  },
  productPricingSchema: {
    extend: jest.fn().mockReturnValue({
      refine: jest.fn().mockReturnValue({
        parse: jest.fn(),
        safeParse: jest.fn(),
      }),
    }),
    partial: jest.fn().mockReturnValue({
      extend: jest.fn().mockReturnValue({
        parse: jest.fn(),
        safeParse: jest.fn(),
      }),
    }),
    parse: jest.fn(),
    safeParse: jest.fn(),
  },
  quantityBreakSchema: {
    shape: {},
    parse: jest.fn(),
    safeParse: jest.fn(),
  },
}))

describe('Pricing Validations', () => {
  const validProductPricing = {
    product_id: '123e4567-e89b-12d3-a456-426614174000',
    cost: 50,
    base_price: 100,
    min_margin_percent: 20,
    currency: 'USD',
    pricing_unit: 'EACH' as const,
    unit_quantity: 1,
  }

  const validPricingRule = {
    name: 'VIP Discount',
    description: 'Discount for VIP customers',
    rule_type: 'tier' as const,
    priority: 100,
    discount_type: 'percentage' as const,
    discount_value: 10,
    is_active: true,
  }

  const validCustomerPricing = {
    customer_id: '123e4567-e89b-12d3-a456-426614174000',
    product_id: '987e6543-e21b-12d3-a456-426614174000',
    override_price: 85,
    contract_number: 'CONT-2024-001',
  }

  const validQuantityBreaks: QuantityBreak[] = [
    {
      min_quantity: 1,
      max_quantity: 10,
      discount_type: 'percentage' as const,
      discount_value: 5,
      sort_order: 0,
    },
    {
      min_quantity: 11,
      max_quantity: 50,
      discount_type: 'percentage' as const,
      discount_value: 10,
      sort_order: 1,
    },
    {
      min_quantity: 51,
      discount_type: 'percentage' as const,
      discount_value: 15,
      sort_order: 2,
    },
  ]

  describe('createProductPricingSchema', () => {
    it('should validate product pricing with positive margin', () => {
      const mockRefine = jest.fn().mockReturnValue({
        parse: jest.fn().mockReturnValue(validProductPricing),
        safeParse: jest
          .fn()
          .mockReturnValue({ success: true, data: validProductPricing }),
      })
      const mockExtend = jest.fn().mockReturnValue({
        refine: mockRefine,
      })
      ;(productPricingSchema.extend as jest.Mock).mockReturnValue({
        refine: mockRefine,
      })

      const result = createProductPricingSchema.safeParse(validProductPricing)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(validProductPricing)
    })

    it('should reject when base price is not greater than cost', () => {
      const invalidPricing = {
        ...validProductPricing,
        base_price: 40, // Less than cost of 50
        cost: 50,
      }

      const mockRefine = jest.fn().mockImplementation((refineFn, options) => ({
        safeParse: jest.fn().mockImplementation((data) => {
          const isValid = refineFn(data)
          return {
            success: isValid,
            error: isValid ? undefined : { message: options.message },
          }
        }),
      }))
      ;(productPricingSchema.extend as jest.Mock).mockReturnValue({
        refine: mockRefine,
      })

      const result = createProductPricingSchema.safeParse(invalidPricing)

      expect(result.success).toBe(false)
    })

    it('should accept when base price equals cost', () => {
      const equalPricing = {
        ...validProductPricing,
        base_price: 50,
        cost: 50,
      }

      const result = createProductPricingSchema.safeParse(equalPricing)

      // Should be false because base_price must be GREATER than cost, not equal
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('updateProductPricingSchema', () => {
    it('should make all fields optional except id', () => {
      const updateData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        base_price: 120,
      }

      const result = updateProductPricingSchema.safeParse(updateData)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(updateData)
    })
  })

  describe('createPricingRuleSchema', () => {
    it('should accept pricing rule with quantity breaks', () => {
      const ruleWithBreaks = {
        ...validPricingRule,
        quantity_breaks: validQuantityBreaks,
      }

      const result = createPricingRuleSchema.safeParse(ruleWithBreaks)

      expect(result.success).toBe(true)
    })

    it('should accept pricing rule without quantity breaks', () => {
      const result = createPricingRuleSchema.safeParse(validPricingRule)

      expect(result.success).toBe(true)
    })

    it('should validate quantity breaks structure', () => {
      const ruleWithInvalidBreaks = {
        ...validPricingRule,
        quantity_breaks: [
          {
            min_quantity: 'invalid', // Should be number
            discount_type: 'percentage',
            discount_value: 10,
          },
        ],
      }

      const result = createPricingRuleSchema.safeParse(ruleWithInvalidBreaks)

      expect(result.success).toBe(false)
    })
  })

  describe('updatePricingRuleSchema', () => {
    it('should handle quantity break updates with actions', () => {
      const updateData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Updated Rule',
        quantity_breaks: [
          {
            id: '987e6543-e21b-12d3-a456-426614174000',
            min_quantity: 1,
            max_quantity: 15,
            discount_type: 'percentage' as const,
            discount_value: 8,
            sort_order: 0,
            _action: 'update' as const,
          },
          {
            min_quantity: 16,
            discount_type: 'percentage' as const,
            discount_value: 12,
            sort_order: 1,
            _action: 'create' as const,
          },
        ],
      }

      const result = updatePricingRuleSchema.safeParse(updateData)

      expect(result.success).toBe(true)
    })

    it('should validate action enum values', () => {
      const invalidActionData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        quantity_breaks: [
          {
            min_quantity: 1,
            discount_type: 'percentage' as const,
            discount_value: 10,
            sort_order: 0,
            _action: 'invalid_action',
          },
        ],
      }

      const result = updatePricingRuleSchema.safeParse(invalidActionData)

      expect(result.success).toBe(false)
    })
  })

  describe('createCustomerPricingSchema', () => {
    it('should validate customer pricing data', () => {
      const mockSafeParse = jest.fn().mockReturnValue({
        success: true,
        data: validCustomerPricing,
      })
      ;(customerPricingSchema.safeParse as jest.Mock).mockReturnValue({
        success: true,
        data: validCustomerPricing,
      })

      const result = createCustomerPricingSchema.safeParse(validCustomerPricing)

      expect(result.success).toBe(true)
    })
  })

  describe('updateCustomerPricingSchema', () => {
    it('should make fields optional except id', () => {
      const updateData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        override_price: 90,
      }

      const result = updateCustomerPricingSchema.safeParse(updateData)

      expect(result.success).toBe(true)
    })
  })

  describe('Import schemas', () => {
    describe('pricingRuleImportSchema', () => {
      const validImportRule = {
        name: 'Imported Rule',
        description: 'Rule from import',
        rule_type: 'quantity' as const,
        priority: 150,
        discount_type: 'percentage' as const,
        discount_value: 12,
        product_sku: 'WIDGET-001',
        customer_name: 'Acme Corp',
        is_active: true,
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        quantity_breaks: '1-10:5%;11-50:10%;51+:15%',
      }

      it('should validate complete import data', () => {
        const result = pricingRuleImportSchema.safeParse(validImportRule)

        expect(result.success).toBe(true)
      })

      it('should require minimum fields', () => {
        const minimalRule = {
          name: 'Minimal Rule',
          rule_type: 'tier' as const,
        }

        const result = pricingRuleImportSchema.safeParse(minimalRule)

        expect(result.success).toBe(true)
      })

      it('should validate rule_type enum', () => {
        const invalidTypeRule = {
          name: 'Invalid Type Rule',
          rule_type: 'invalid_type',
        }

        const result = pricingRuleImportSchema.safeParse(invalidTypeRule)

        expect(result.success).toBe(false)
      })
    })

    describe('productPricingImportSchema', () => {
      const validImportPricing = {
        product_sku: 'WIDGET-001',
        cost: 25,
        base_price: 50,
        min_margin_percent: 25,
        currency: 'USD',
        pricing_unit: 'EACH' as const,
        unit_quantity: 1,
        effective_date: '2024-01-01',
        expiry_date: '2024-12-31',
      }

      it('should validate complete import data', () => {
        const result = productPricingImportSchema.safeParse(validImportPricing)

        expect(result.success).toBe(true)
      })

      it('should require minimum fields', () => {
        const minimalPricing = {
          product_sku: 'WIDGET-001',
          cost: 25,
          base_price: 50,
        }

        const result = productPricingImportSchema.safeParse(minimalPricing)

        expect(result.success).toBe(true)
      })

      it('should validate pricing_unit enum', () => {
        const invalidUnitPricing = {
          ...validImportPricing,
          pricing_unit: 'INVALID_UNIT',
        }

        const result = productPricingImportSchema.safeParse(invalidUnitPricing)

        expect(result.success).toBe(false)
      })

      it('should validate currency length', () => {
        const invalidCurrencyPricing = {
          ...validImportPricing,
          currency: 'USDA', // Too long
        }

        const result = productPricingImportSchema.safeParse(
          invalidCurrencyPricing
        )

        expect(result.success).toBe(false)
      })
    })
  })

  describe('priceCalculationRequestSchema', () => {
    it('should validate price calculation request', () => {
      const validRequest = {
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_id: '987e6543-e21b-12d3-a456-426614174000',
        quantity: 5,
        requested_date: '2024-01-15T10:00:00Z',
      }

      const result = priceCalculationRequestSchema.safeParse(validRequest)

      expect(result.success).toBe(true)
    })

    it('should use default quantity when not provided', () => {
      const requestWithoutQuantity = {
        product_id: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = priceCalculationRequestSchema.safeParse(
        requestWithoutQuantity
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(1)
      }
    })

    it('should reject non-positive quantities', () => {
      const invalidRequest = {
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 0,
      }

      const result = priceCalculationRequestSchema.safeParse(invalidRequest)

      expect(result.success).toBe(false)
    })
  })

  describe('pricingRuleFiltersSchema', () => {
    it('should validate filter parameters', () => {
      const validFilters = {
        search: 'VIP',
        rule_type: 'tier' as const,
        is_active: true,
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        category_id: '987e6543-e21b-12d3-a456-426614174000',
        customer_id: '456e7890-e21b-12d3-a456-426614174000',
        tier_id: '789e0123-e21b-12d3-a456-426614174000',
        date: '2024-01-15T10:00:00Z',
      }

      const result = pricingRuleFiltersSchema.safeParse(validFilters)

      expect(result.success).toBe(true)
    })

    it('should allow partial filter data', () => {
      const partialFilters = {
        search: 'Discount',
        is_active: true,
      }

      const result = pricingRuleFiltersSchema.safeParse(partialFilters)

      expect(result.success).toBe(true)
    })

    it('should validate UUID fields', () => {
      const invalidUUIDFilters = {
        product_id: 'invalid-uuid',
      }

      const result = pricingRuleFiltersSchema.safeParse(invalidUUIDFilters)

      expect(result.success).toBe(false)
    })
  })

  describe('Validation helper functions', () => {
    describe('validatePriceGreaterThanCost', () => {
      it('should return true when price is greater than cost', () => {
        expect(validatePriceGreaterThanCost(100, 50)).toBe(true)
      })

      it('should return false when price equals cost', () => {
        expect(validatePriceGreaterThanCost(50, 50)).toBe(false)
      })

      it('should return false when price is less than cost', () => {
        expect(validatePriceGreaterThanCost(40, 50)).toBe(false)
      })
    })

    describe('validateMargin', () => {
      it('should return true when margin meets minimum', () => {
        // Price: 100, Cost: 50, Margin: 50%
        expect(validateMargin(100, 50, 30)).toBe(true)
      })

      it('should return false when margin is below minimum', () => {
        // Price: 100, Cost: 80, Margin: 20%
        expect(validateMargin(100, 80, 30)).toBe(false)
      })

      it('should calculate margin correctly', () => {
        // Price: 100, Cost: 60, Margin: 40%
        expect(validateMargin(100, 60, 40)).toBe(true)
        expect(validateMargin(100, 60, 50)).toBe(false)
      })

      it('should handle edge case with zero cost', () => {
        expect(validateMargin(100, 0, 50)).toBe(true)
      })
    })

    describe('validateDateRange', () => {
      it('should return true for valid date range', () => {
        expect(validateDateRange('2024-01-01', '2024-12-31')).toBe(true)
      })

      it('should return false when start date is after end date', () => {
        expect(validateDateRange('2024-12-31', '2024-01-01')).toBe(false)
      })

      it('should return true when dates are equal', () => {
        expect(validateDateRange('2024-01-01', '2024-01-01')).toBe(true)
      })

      it('should return true when one or both dates are undefined', () => {
        expect(validateDateRange(undefined, '2024-12-31')).toBe(true)
        expect(validateDateRange('2024-01-01', undefined)).toBe(true)
        expect(validateDateRange(undefined, undefined)).toBe(true)
      })
    })

    describe('validateQuantityBreaks', () => {
      it('should return no errors for valid quantity breaks', () => {
        const errors = validateQuantityBreaks(validQuantityBreaks)
        expect(errors).toHaveLength(0)
      })

      it('should detect when max_quantity is not greater than min_quantity', () => {
        const invalidBreaks = [
          {
            min_quantity: 10,
            max_quantity: 5, // Invalid: less than min
            discount_type: 'percentage' as const,
            discount_value: 10,
            sort_order: 0,
          },
        ]

        const errors = validateQuantityBreaks(invalidBreaks)
        expect(errors).toContain(
          'Break 1: Max quantity must be greater than min quantity'
        )
      })

      it('should detect gaps between quantity breaks', () => {
        const breaksWithGap = [
          {
            min_quantity: 1,
            max_quantity: 10,
            discount_type: 'percentage' as const,
            discount_value: 5,
            sort_order: 0,
          },
          {
            min_quantity: 15, // Gap: 11-14 missing
            max_quantity: 25,
            discount_type: 'percentage' as const,
            discount_value: 10,
            sort_order: 1,
          },
        ]

        const errors = validateQuantityBreaks(breaksWithGap)
        expect(errors).toContain('Gap between quantities 10 and 15')
      })

      it('should detect overlaps between quantity breaks', () => {
        const overlappingBreaks = [
          {
            min_quantity: 1,
            max_quantity: 15,
            discount_type: 'percentage' as const,
            discount_value: 5,
            sort_order: 0,
          },
          {
            min_quantity: 10, // Overlap: 10-15 covered by both
            max_quantity: 25,
            discount_type: 'percentage' as const,
            discount_value: 10,
            sort_order: 1,
          },
        ]

        const errors = validateQuantityBreaks(overlappingBreaks)
        expect(errors).toContain('Overlap between breaks at quantity 10')
      })

      it('should handle breaks without max_quantity', () => {
        const breaksWithoutMax = [
          {
            min_quantity: 1,
            max_quantity: 10,
            discount_type: 'percentage' as const,
            discount_value: 5,
            sort_order: 0,
          },
          {
            min_quantity: 11,
            discount_type: 'percentage' as const,
            discount_value: 10,
            sort_order: 1,
          },
        ]

        const errors = validateQuantityBreaks(breaksWithoutMax)
        expect(errors).toHaveLength(0) // Should be valid
      })
    })
  })

  describe('Quantity breaks parsing and formatting', () => {
    describe('parseQuantityBreaksCSV', () => {
      it('should parse percentage discounts', () => {
        const csv = '1-10:5%;11-50:10%;51+:15%'
        const breaks = parseQuantityBreaksCSV(csv)

        expect(breaks).toHaveLength(3)
        expect(breaks[0]).toEqual({
          min_quantity: 1,
          max_quantity: 10,
          discount_type: 'percentage',
          discount_value: 5,
          sort_order: 0,
        })
        expect(breaks[2]).toEqual({
          min_quantity: 51,
          max_quantity: undefined,
          discount_type: 'percentage',
          discount_value: 15,
          sort_order: 2,
        })
      })

      it('should parse fixed amount discounts', () => {
        const csv = '1-10:$5off;11+:$10off'
        const breaks = parseQuantityBreaksCSV(csv)

        expect(breaks).toHaveLength(2)
        expect(breaks[0]).toEqual({
          min_quantity: 1,
          max_quantity: 10,
          discount_type: 'fixed',
          discount_value: 5,
          sort_order: 0,
        })
      })

      it('should parse fixed price discounts', () => {
        const csv = '1-10:$45;11+:$40'
        const breaks = parseQuantityBreaksCSV(csv)

        expect(breaks).toHaveLength(2)
        expect(breaks[0]).toEqual({
          min_quantity: 1,
          max_quantity: 10,
          discount_type: 'price',
          discount_value: 45,
          sort_order: 0,
        })
      })

      it('should handle empty or malformed CSV', () => {
        expect(parseQuantityBreaksCSV('')).toEqual([])
        expect(parseQuantityBreaksCSV('invalid')).toEqual([])
        expect(parseQuantityBreaksCSV('1-10')).toEqual([]) // Missing discount
      })

      it('should handle whitespace and empty segments', () => {
        const csv = ' 1-10:5% ; ; 11+:10% '
        const breaks = parseQuantityBreaksCSV(csv)

        expect(breaks).toHaveLength(2)
        expect(breaks[0].min_quantity).toBe(1)
        expect(breaks[1].min_quantity).toBe(11)
      })
    })

    describe('formatQuantityBreaksDisplay', () => {
      it('should format percentage discounts', () => {
        const breaks = [
          {
            min_quantity: 1,
            max_quantity: 10,
            discount_type: 'percentage' as const,
            discount_value: 5,
            sort_order: 0,
          },
          {
            min_quantity: 11,
            discount_type: 'percentage' as const,
            discount_value: 10,
            sort_order: 1,
          },
        ]

        const display = formatQuantityBreaksDisplay(breaks)
        expect(display).toBe('1-10: 5%; 11+: 10%')
      })

      it('should format fixed amount discounts', () => {
        const breaks = [
          {
            min_quantity: 1,
            max_quantity: 10,
            discount_type: 'fixed' as const,
            discount_value: 5,
            sort_order: 0,
          },
        ]

        const display = formatQuantityBreaksDisplay(breaks)
        expect(display).toBe('1-10: $5 off')
      })

      it('should format price discounts', () => {
        const breaks = [
          {
            min_quantity: 1,
            max_quantity: 10,
            discount_type: 'price' as const,
            discount_value: 45,
            sort_order: 0,
          },
        ]

        const display = formatQuantityBreaksDisplay(breaks)
        expect(display).toBe('1-10: $45')
      })

      it('should sort breaks by min_quantity', () => {
        const unsortedBreaks = [
          {
            min_quantity: 11,
            discount_type: 'percentage' as const,
            discount_value: 10,
            sort_order: 1,
          },
          {
            min_quantity: 1,
            max_quantity: 10,
            discount_type: 'percentage' as const,
            discount_value: 5,
            sort_order: 0,
          },
        ]

        const display = formatQuantityBreaksDisplay(unsortedBreaks)
        expect(display).toBe('1-10: 5%; 11+: 10%')
      })
    })
  })

  describe('Transform functions', () => {
    describe('transformPricingRuleImport', () => {
      it('should transform import data to pricing rule format', () => {
        const importData = {
          name: 'Imported Rule',
          description: 'Test import',
          rule_type: 'quantity' as const,
          priority: 150,
          discount_type: 'percentage' as const,
          discount_value: 10,
          is_active: true,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          quantity_breaks: '1-10:5%;11+:10%',
        }

        const result = transformPricingRuleImport(importData)

        expect(result.rule).toEqual({
          name: 'Imported Rule',
          description: 'Test import',
          rule_type: 'quantity',
          priority: 150,
          discount_type: 'percentage',
          discount_value: 10,
          is_active: true,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          conditions: {},
        })

        expect(result.quantity_breaks).toHaveLength(2)
        expect(result.quantity_breaks![0].min_quantity).toBe(1)
      })

      it('should apply default values', () => {
        const minimalData = {
          name: 'Minimal Rule',
          rule_type: 'tier' as const,
        }

        const result = transformPricingRuleImport(minimalData)

        expect(result.rule.priority).toBe(100)
        expect(result.rule.is_active).toBe(true)
        expect(result.rule.conditions).toEqual({})
      })

      it('should handle missing quantity breaks', () => {
        const dataWithoutBreaks = {
          name: 'No Breaks Rule',
          rule_type: 'tier' as const,
        }

        const result = transformPricingRuleImport(dataWithoutBreaks)

        expect(result.quantity_breaks).toBeUndefined()
      })
    })

    describe('transformProductPricingImport', () => {
      it('should transform import data to product pricing format', () => {
        const importData = {
          product_sku: 'WIDGET-001',
          cost: 25,
          base_price: 50,
          min_margin_percent: 30,
          currency: 'EUR',
          pricing_unit: 'CASE' as const,
          unit_quantity: 12,
          effective_date: '2024-01-01',
          expiry_date: '2024-12-31',
        }

        const result = transformProductPricingImport(importData)

        expect(result).toEqual({
          cost: 25,
          base_price: 50,
          min_margin_percent: 30,
          currency: 'EUR',
          pricing_unit: 'CASE',
          unit_quantity: 12,
          effective_date: '2024-01-01',
          expiry_date: '2024-12-31',
        })
      })

      it('should apply default values', () => {
        const minimalData = {
          product_sku: 'WIDGET-001',
          cost: 25,
          base_price: 50,
        }

        const result = transformProductPricingImport(minimalData)

        expect(result.min_margin_percent).toBe(20)
        expect(result.currency).toBe('USD')
        expect(result.pricing_unit).toBe('EACH')
        expect(result.unit_quantity).toBe(1)
      })
    })
  })

  describe('checkRuleConflicts', () => {
    const existingRules: PricingRuleRecord[] = [
      {
        id: '1',
        organization_id: 'org-1',
        name: 'Existing VIP Rule',
        rule_type: 'tier',
        priority: 100,
        product_id: 'product-1',
        is_exclusive: true,
        is_active: true,
        start_date: '2024-01-01',
        end_date: '2024-06-30',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        description: '',
        conditions: {},
        category_id: null,
        customer_id: null,
        customer_tier_id: null,
        discount_type: 'percentage',
        discount_value: 10,
        can_stack: true,
      },
      {
        id: '2',
        organization_id: 'org-1',
        name: 'Existing Quantity Rule',
        rule_type: 'quantity',
        priority: 200,
        product_id: 'product-1',
        is_exclusive: false,
        is_active: true,
        start_date: '2024-03-01',
        end_date: '2024-09-30',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        description: '',
        conditions: {},
        category_id: null,
        customer_id: null,
        customer_tier_id: null,
        discount_type: 'percentage',
        discount_value: 15,
        can_stack: true,
      },
    ]

    it('should detect conflicts with same priority', () => {
      const newRule: Partial<PricingRule> = {
        name: 'New Rule',
        rule_type: 'tier',
        priority: 100, // Same as existing rule
        product_id: 'product-1',
        start_date: '2024-02-01',
        end_date: '2024-05-31',
      }

      const conflicts = checkRuleConflicts(newRule, existingRules)

      expect(conflicts).toContain(
        'Conflicts with rule "Existing VIP Rule" - same priority (100)'
      )
    })

    it('should detect conflicts with exclusive rules', () => {
      const newRule: Partial<PricingRule> = {
        name: 'New Exclusive Rule',
        rule_type: 'tier',
        priority: 150,
        product_id: 'product-1',
        is_exclusive: true,
        start_date: '2024-02-01',
        end_date: '2024-05-31',
      }

      const conflicts = checkRuleConflicts(newRule, existingRules)

      expect(conflicts).toContain(
        'Conflicts with exclusive rule "Existing VIP Rule"'
      )
    })

    it('should not detect conflicts for different products', () => {
      const newRule: Partial<PricingRule> = {
        name: 'Different Product Rule',
        rule_type: 'tier',
        priority: 100,
        product_id: 'product-2', // Different product
        start_date: '2024-02-01',
        end_date: '2024-05-31',
      }

      const conflicts = checkRuleConflicts(newRule, existingRules)

      expect(conflicts).toHaveLength(0)
    })

    it('should not detect conflicts for non-overlapping dates', () => {
      const newRule: Partial<PricingRule> = {
        name: 'Non-overlapping Rule',
        rule_type: 'tier',
        priority: 100,
        product_id: 'product-1',
        start_date: '2024-07-01', // After existing rule ends
        end_date: '2024-12-31',
      }

      const conflicts = checkRuleConflicts(newRule, existingRules)

      expect(conflicts).toHaveLength(0)
    })

    it('should not detect conflicts for different rule types', () => {
      const newRule: Partial<PricingRule> = {
        name: 'Different Type Rule',
        rule_type: 'promotion', // Different from 'tier'
        priority: 100,
        product_id: 'product-1',
        start_date: '2024-02-01',
        end_date: '2024-05-31',
      }

      const conflicts = checkRuleConflicts(newRule, existingRules)

      expect(conflicts).toHaveLength(0)
    })

    it('should handle rules without dates (open-ended)', () => {
      const newRule: Partial<PricingRule> = {
        name: 'Open-ended Rule',
        rule_type: 'tier',
        priority: 100,
        product_id: 'product-1',
        // No start_date or end_date
      }

      const conflicts = checkRuleConflicts(newRule, existingRules)

      expect(conflicts.length).toBeGreaterThan(0) // Should conflict with existing rules
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    it('should work together for complete pricing rule workflow', () => {
      // Step 1: Validate import data
      const importData = {
        name: 'Integration Test Rule',
        rule_type: 'quantity' as const,
        discount_type: 'percentage' as const,
        discount_value: 10,
        quantity_breaks: '1-10:5%;11+:10%',
      }

      const importResult = pricingRuleImportSchema.safeParse(importData)
      expect(importResult.success).toBe(true)

      // Step 2: Transform to internal format
      const transformed = transformPricingRuleImport(importData)
      expect(transformed.rule.name).toBe('Integration Test Rule')
      expect(transformed.quantity_breaks).toHaveLength(2)

      // Step 3: Validate quantity breaks
      const breakErrors = validateQuantityBreaks(transformed.quantity_breaks!)
      expect(breakErrors).toHaveLength(0)

      // Step 4: Format for display
      const display = formatQuantityBreaksDisplay(transformed.quantity_breaks!)
      expect(display).toBe('1-10: 5%; 11+: 10%')
    })

    it('should handle validation errors consistently', () => {
      const invalidData = {
        name: '', // Empty required field
        rule_type: 'invalid_type',
      }

      const result = pricingRuleImportSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })
})

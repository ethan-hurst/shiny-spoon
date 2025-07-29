import { cn, formatCurrency, formatPercent, formatDate } from '@/lib/utils'

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      expect(cn('base-class', isActive && 'active-class')).toBe('base-class active-class')
    })

    it('should handle conditional classes with false values', () => {
      const isActive = false
      expect(cn('base-class', isActive && 'active-class')).toBe('base-class')
    })

    it('should handle arrays of classes', () => {
      expect(cn(['text-red-500', 'bg-blue-500'])).toBe('text-red-500 bg-blue-500')
    })

    it('should handle mixed input types', () => {
      expect(cn('base', ['array-class'], { 'conditional': true, 'false': false })).toBe('base array-class conditional')
    })

    it('should handle empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(null, undefined)).toBe('')
    })

    it('should deduplicate conflicting Tailwind classes', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    })
  })

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,235')
      expect(formatCurrency(1000)).toBe('$1,000')
      expect(formatCurrency(0)).toBe('$0')
    })

    it('should format with custom currency', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,235')
      expect(formatCurrency(1234.56, 'GBP')).toBe('£1,235')
    })

    it('should handle decimal places correctly', () => {
      expect(formatCurrency(1234.567)).toBe('$1,235')
      expect(formatCurrency(1234.1)).toBe('$1,234')
    })

    it('should handle negative amounts', () => {
      expect(formatCurrency(-1234.56)).toBe('-$1,235')
    })

    it('should handle very large numbers', () => {
      expect(formatCurrency(999999999.99)).toBe('$1,000,000,000')
    })

    it('should handle very small numbers', () => {
      expect(formatCurrency(0.01)).toBe('$0')
    })
  })

  describe('formatPercent', () => {
    it('should format percentages correctly', () => {
      expect(formatPercent(50)).toBe('50%')
      expect(formatPercent(25.5)).toBe('25.5%')
      expect(formatPercent(0)).toBe('0%')
    })

    it('should handle decimal percentages', () => {
      expect(formatPercent(12.345)).toBe('12.3%')
      expect(formatPercent(99.999)).toBe('100%')
    })

    it('should handle negative percentages', () => {
      expect(formatPercent(-25)).toBe('-25%')
    })

    it('should handle very large percentages', () => {
      expect(formatPercent(1000)).toBe('1,000%')
    })

    it('should handle very small percentages', () => {
      expect(formatPercent(0.1)).toBe('0.1%')
    })
  })

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2023-12-25')
      expect(formatDate(date)).toBe('12/25/2023')
    })

    it('should handle different date formats', () => {
      const date1 = new Date('2023-01-01')
      const date2 = new Date('2023-12-31')
      expect(formatDate(date1)).toBe('1/1/2023')
      expect(formatDate(date2)).toBe('12/31/2023')
    })

    it('should handle current date', () => {
      const now = new Date()
      const formatted = formatDate(now)
      expect(formatted).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
    })

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid')
      expect(() => formatDate(invalidDate)).not.toThrow()
    })
  })
})
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges classes correctly', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'conditional')).toBe('base')
    expect(cn('base', true && 'conditional')).toBe('base conditional')
  })

  it('handles undefined and null values', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('handles empty strings', () => {
    expect(cn('', 'base', '')).toBe('base')
  })

  it('merges Tailwind classes intelligently', () => {
    // Should replace conflicting classes
    expect(cn('p-4', 'p-8')).toBe('p-8')
    expect(cn('mt-4 mb-4', 'mt-8')).toBe('mb-4 mt-8')
  })

  it('handles arrays of classes', () => {
    expect(cn(['base', 'text-lg'], 'extra')).toBe('base text-lg extra')
  })

  it('handles objects with boolean values', () => {
    expect(
      cn({
        'text-red-500': false,
        'text-blue-500': true,
        'font-bold': true,
      })
    ).toBe('text-blue-500 font-bold')
  })

  it('handles complex combinations', () => {
    const isActive = true
    const isDisabled = false

    expect(
      cn(
        'base-class',
        isActive && 'active-class',
        isDisabled && 'disabled-class',
        {
          'hover:bg-gray-100': !isDisabled,
          'cursor-not-allowed': isDisabled,
        },
        ['array-class-1', 'array-class-2']
      )
    ).toBe(
      'base-class active-class hover:bg-gray-100 array-class-1 array-class-2'
    )
  })

  it('handles no arguments', () => {
    expect(cn()).toBe('')
  })

  it('handles single argument', () => {
    expect(cn('single-class')).toBe('single-class')
  })

  it('deduplicates classes', () => {
    expect(cn('duplicate', 'duplicate', 'unique')).toBe('duplicate unique')
  })

  it('preserves important modifiers', () => {
    expect(cn('!text-red-500', 'text-blue-500')).toBe(
      '!text-red-500 text-blue-500'
    )
  })

  it('handles responsive modifiers correctly', () => {
    expect(cn('sm:p-4', 'md:p-6', 'lg:p-8')).toBe('sm:p-4 md:p-6 lg:p-8')
    expect(cn('sm:text-sm md:text-base', 'lg:text-lg')).toBe(
      'sm:text-sm md:text-base lg:text-lg'
    )
  })

  it('handles hover and focus states', () => {
    expect(cn('hover:bg-gray-100', 'focus:outline-none')).toBe(
      'hover:bg-gray-100 focus:outline-none'
    )
  })

  it('handles dark mode classes', () => {
    expect(cn('text-gray-900', 'dark:text-gray-100')).toBe(
      'text-gray-900 dark:text-gray-100'
    )
  })
})

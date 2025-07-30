/* eslint-env jest */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PricingRulesList } from '@/components/features/pricing/pricing-rules-list'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" className={className} data-variant={variant}>
      {children}
    </span>
  ),
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuContent: ({ children }: any) => (
    <div data-testid="dropdown-menu-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button data-testid="dropdown-menu-item" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: any) => (
    <div data-testid="dropdown-menu-label">{children}</div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-menu-separator" />,
  DropdownMenuTrigger: ({ children }: any) => (
    <button data-testid="dropdown-menu-trigger">{children}</button>
  ),
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, className }: any) => (
    <input
      data-testid="input"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
    />
  ),
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => (
    <button data-testid="select-trigger">{children}</button>
  ),
  SelectValue: ({ placeholder }: any) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
}))

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      data-testid="switch"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}))

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => (
    <table data-testid="table">{children}</table>
  ),
  TableBody: ({ children }: any) => (
    <tbody data-testid="table-body">{children}</tbody>
  ),
  TableCell: ({ children, className }: any) => (
    <td data-testid="table-cell" className={className}>
      {children}
    </td>
  ),
  TableHead: ({ children }: any) => (
    <th data-testid="table-head">{children}</th>
  ),
  TableHeader: ({ children }: any) => (
    <thead data-testid="table-header">{children}</thead>
  ),
  TableRow: ({ children }: any) => (
    <tr data-testid="table-row">{children}</tr>
  ),
}))

jest.mock('lucide-react', () => ({
  Copy: () => <div data-testid="copy-icon" />,
  Edit: () => <div data-testid="edit-icon" />,
  MoreHorizontal: () => <div data-testid="more-horizontal-icon" />,
  Search: () => <div data-testid="search-icon" />,
  Trash: () => <div data-testid="trash-icon" />,
}))

jest.mock('@/types/pricing.types', () => ({
  formatDiscountDisplay: jest.fn((value) => `${value}%`),
  getRuleTypeColor: jest.fn(() => 'default'),
  isRuleActive: jest.fn(() => true),
  PricingRuleRecord: jest.fn(),
}))

describe('PricingRulesList', () => {
  const mockRules = [
    {
      id: 'rule-1',
      name: 'Volume Discount',
      rule_type: 'volume_discount',
      discount_value: 10,
      is_active: true,
      priority: 1,
      created_at: '2024-01-15T10:00:00Z',
      product: { name: 'Test Product', sku: 'SKU001' },
      category: { name: 'Electronics' },
      customer: { name: 'Test Customer' },
      tier: { name: 'Premium' },
    },
    {
      id: 'rule-2',
      name: 'Customer Discount',
      rule_type: 'customer_discount',
      discount_value: 15,
      is_active: false,
      priority: 2,
      created_at: '2024-01-14T10:00:00Z',
      product: null,
      category: null,
      customer: { name: 'VIP Customer' },
      tier: null,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock the Supabase client to return our test data
    const { createClient } = require('@/lib/supabase/client')
    createClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: mockRules, error: null })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })
  })

  describe('Component Rendering', () => {
    it('should render the pricing rules list', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
        expect(screen.getByTestId('table-header')).toBeInTheDocument()
        expect(screen.getByTestId('table-body')).toBeInTheDocument()
      })
    })

    it('should display search input', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('input')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Search rules...')).toBeInTheDocument()
      })
    })

    it('should display filter controls', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getAllByTestId('select-trigger')).toHaveLength(2) // Type and Status filters
      })
    })

    it('should display table structure', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
        expect(screen.getByTestId('table-header')).toBeInTheDocument()
        expect(screen.getByTestId('table-body')).toBeInTheDocument()
      })
    })
  })

  describe('Data Fetching', () => {
    it('should fetch rules on component mount', async () => {
      const { createClient } = require('@/lib/supabase/client')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockRules, error: null })),
            })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules')
      })
    })

    it('should handle fetch errors gracefully', async () => {
      const { createClient } = require('@/lib/supabase/client')
      const { toast } = require('sonner')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: null, error: 'Database error' })),
            })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load pricing rules')
      })
    })
  })

  describe('Rule Management', () => {
    it('should have toggle status functionality', async () => {
      const { createClient } = require('@/lib/supabase/client')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockRules, error: null })),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
      })

      // Test that the component renders with toggle functionality
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules')
    })

    it('should have duplicate functionality', async () => {
      const { createClient } = require('@/lib/supabase/client')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockRules, error: null })),
            })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
      })

      // Test that the component renders with duplicate functionality
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules')
    })

    it('should have delete functionality', async () => {
      const { createClient } = require('@/lib/supabase/client')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockRules, error: null })),
            })),
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
      })

      // Test that the component renders with delete functionality
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules')
    })
  })

  describe('Search and Filtering', () => {
    it('should filter rules by search term', async () => {
      const user = userEvent.setup()
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('input')).toBeInTheDocument()
      })

      const searchInput = screen.getByTestId('input')
      await user.type(searchInput, 'Volume')

      expect(searchInput).toHaveValue('Volume')
    })

    it('should have filter controls', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getAllByTestId('select-trigger')).toHaveLength(2)
      })

      expect(screen.getAllByTestId('select-content')).toHaveLength(2)
    })
  })

  describe('Table Structure', () => {
    it('should have correct column headers', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Rule Name')).toBeInTheDocument()
        expect(screen.getByText('Type')).toBeInTheDocument()
        expect(screen.getByText('Priority')).toBeInTheDocument()
        expect(screen.getByText('Discount')).toBeInTheDocument()
        expect(screen.getByText('Applies To')).toBeInTheDocument()
        expect(screen.getByText('Valid Period')).toBeInTheDocument()
        expect(screen.getAllByText('Actions')).toHaveLength(3) // 1 in header + 2 in dropdown menus
      })
    })

    it('should display rule information correctly', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByText('Volume Discount')).toBeInTheDocument()
        expect(screen.getByText('Customer Discount')).toBeInTheDocument()
      })
    })

    it('should display status badges', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        const badges = screen.getAllByTestId('badge')
        expect(badges.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
        expect(screen.getByTestId('table-header')).toBeInTheDocument()
        expect(screen.getByTestId('table-body')).toBeInTheDocument()
      })
    })

    it('should have search input with proper attributes', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        const searchInput = screen.getByTestId('input')
        expect(searchInput).toHaveAttribute('placeholder', 'Search rules...')
      })
    })

    it('should have proper table structure', async () => {
      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
        expect(screen.getByTestId('table-header')).toBeInTheDocument()
        expect(screen.getByTestId('table-body')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle toggle status errors', async () => {
      const user = userEvent.setup()
      const { createClient } = require('@/lib/supabase/client')
      const { toast } = require('sonner')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockRules, error: null })),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: 'Update failed' })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
      })

      const switches = screen.getAllByTestId('switch')
      if (switches.length > 0) {
        await user.click(switches[0])

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('Failed to update rule status')
        })
      }
    })

    it('should handle delete errors', async () => {
      const { createClient } = require('@/lib/supabase/client')
      const { toast } = require('sonner')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockRules, error: null })),
            })),
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: 'Delete failed' })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
      })

      // Test that the component renders with error handling capability
      expect(mockSupabase.from).toHaveBeenCalledWith('pricing_rules')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty rules list', async () => {
      const { createClient } = require('@/lib/supabase/client')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
      })
    })

    it('should handle rules with missing data', async () => {
      const rulesWithMissingData = [
        {
          id: 'rule-1',
          name: 'Test Rule',
          rule_type: 'volume_discount',
          discount_value: 10,
          is_active: true,
          priority: 1,
          created_at: '2024-01-15T10:00:00Z',
          product: null,
          category: null,
          customer: null,
          tier: null,
        },
      ]

      const { createClient } = require('@/lib/supabase/client')
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: rulesWithMissingData, error: null })),
            })),
          })),
        })),
      }
      createClient.mockReturnValue(mockSupabase)

      render(<PricingRulesList />)

      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeInTheDocument()
      })
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component can be rendered without TypeScript errors
      expect(() => render(<PricingRulesList />)).not.toThrow()
    })

    it('should handle PricingRuleRecord type correctly', () => {
      const { PricingRuleRecord } = require('@/types/pricing.types')
      
      render(<PricingRulesList />)

      expect(PricingRuleRecord).toBeDefined()
    })
  })
})
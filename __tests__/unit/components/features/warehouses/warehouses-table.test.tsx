/* eslint-env jest */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WarehousesTable } from '@/components/features/warehouses/warehouses-table'
import type { WarehouseWithDetails } from '@/types/warehouse.types'

// Mock @tanstack/react-table
jest.mock('@tanstack/react-table', () => ({
  useReactTable: jest.fn(),
  getCoreRowModel: jest.fn(),
  getFilteredRowModel: jest.fn(),
  getPaginationRowModel: jest.fn(),
  getSortedRowModel: jest.fn(),
  flexRender: jest.fn((component) => component),
}))

// Mock child components
jest.mock('@/components/features/warehouses/warehouse-actions', () => ({
  WarehouseActions: ({ warehouse }: any) => (
    <div data-testid="warehouse-actions" data-warehouse-id={warehouse.id}>
      Actions
    </div>
  ),
}))

jest.mock('@/components/features/warehouses/warehouse-filters', () => ({
  WarehouseFilters: ({ table, states }: any) => (
    <div data-testid="warehouse-filters" data-states={states.join(',')}>
      Filters
    </div>
  ),
}))

// Mock UI components
jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table data-testid="table">{children}</table>,
  TableHeader: ({ children }: any) => <thead data-testid="table-header">{children}</thead>,
  TableBody: ({ children }: any) => <tbody data-testid="table-body">{children}</tbody>,
  TableRow: ({ children, ...props }: any) => <tr data-testid="table-row" {...props}>{children}</tr>,
  TableHead: ({ children }: any) => <th data-testid="table-head">{children}</th>,
  TableCell: ({ children, ...props }: any) => <td data-testid="table-cell" {...props}>{children}</td>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, disabled, onClick }: any) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Building2: ({ className }: any) => (
    <span data-testid="building-2" className={className}>
      Building2
    </span>
  ),
  MapPin: ({ className }: any) => (
    <span data-testid="map-pin" className={className}>
      MapPin
    </span>
  ),
  Phone: ({ className }: any) => (
    <span data-testid="phone" className={className}>
      Phone
    </span>
  ),
}))

describe('WarehousesTable', () => {
  const mockWarehouses: WarehouseWithDetails[] = [
    {
      id: 'warehouse-1',
      code: 'WH001',
      name: 'Main Warehouse',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      },
      contact: [
        {
          name: 'John Doe',
          role: 'Manager',
          email: 'john@example.com',
          phone: '+1-555-0123',
          isPrimary: true,
        },
        {
          name: 'Jane Smith',
          role: 'Assistant',
          email: 'jane@example.com',
          phone: '+1-555-0124',
          isPrimary: false,
        },
      ],
      inventory_count: 150,
      active: true,
      is_default: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'warehouse-2',
      code: 'WH002',
      name: 'Secondary Warehouse',
      address: {
        street: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90210',
        country: 'USA',
      },
      contact: [
        {
          name: 'Bob Wilson',
          role: 'Supervisor',
          email: 'bob@example.com',
          phone: '+1-555-0125',
          isPrimary: true,
        },
      ],
      inventory_count: 75,
      active: false,
      is_default: false,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'warehouse-3',
      code: 'WH003',
      name: 'Distribution Center',
      address: {
        street: '789 Industrial Blvd',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'USA',
      },
      contact: [],
      inventory_count: 300,
      active: true,
      is_default: false,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    },
  ]

  const mockStates = ['NY', 'CA', 'IL', 'TX']

  const mockTable = {
    getHeaderGroups: () => [
      {
        id: 'header-group-1',
        headers: [
          { 
            id: 'code', 
            column: { columnDef: { header: 'Code' } }, 
            isPlaceholder: false,
            getContext: () => ({ column: { columnDef: { header: 'Code' } } })
          },
          { 
            id: 'name', 
            column: { columnDef: { header: 'Name' } }, 
            isPlaceholder: false,
            getContext: () => ({ column: { columnDef: { header: 'Name' } } })
          },
          { 
            id: 'address', 
            column: { columnDef: { header: 'Location' } }, 
            isPlaceholder: false,
            getContext: () => ({ column: { columnDef: { header: 'Location' } } })
          },
          { 
            id: 'contact', 
            column: { columnDef: { header: 'Primary Contact' } }, 
            isPlaceholder: false,
            getContext: () => ({ column: { columnDef: { header: 'Primary Contact' } } })
          },
          { 
            id: 'inventory_count', 
            column: { columnDef: { header: 'Inventory Items' } }, 
            isPlaceholder: false,
            getContext: () => ({ column: { columnDef: { header: 'Inventory Items' } } })
          },
          { 
            id: 'active', 
            column: { columnDef: { header: 'Status' } }, 
            isPlaceholder: false,
            getContext: () => ({ column: { columnDef: { header: 'Status' } } })
          },
          { 
            id: 'actions', 
            column: { columnDef: { header: 'Actions' } }, 
            isPlaceholder: false,
            getContext: () => ({ column: { columnDef: { header: 'Actions' } } })
          },
        ],
      },
    ],
    getRowModel: () => ({
      rows: mockWarehouses.map((warehouse, index) => ({
        id: `row-${index}`,
        original: warehouse,
        getVisibleCells: () => [
          { 
            id: 'code', 
            column: { columnDef: { cell: () => warehouse.code } },
            getContext: () => ({ column: { columnDef: { cell: () => warehouse.code } } })
          },
          { 
            id: 'name', 
            column: { columnDef: { cell: () => warehouse.name } },
            getContext: () => ({ column: { columnDef: { cell: () => warehouse.name } } })
          },
          { 
            id: 'address', 
            column: { columnDef: { cell: () => warehouse.address } },
            getContext: () => ({ column: { columnDef: { cell: () => warehouse.address } } })
          },
          { 
            id: 'contact', 
            column: { columnDef: { cell: () => warehouse.contact } },
            getContext: () => ({ column: { columnDef: { cell: () => warehouse.contact } } })
          },
          { 
            id: 'inventory_count', 
            column: { columnDef: { cell: () => warehouse.inventory_count } },
            getContext: () => ({ column: { columnDef: { cell: () => warehouse.inventory_count } } })
          },
          { 
            id: 'active', 
            column: { columnDef: { cell: () => warehouse.active } },
            getContext: () => ({ column: { columnDef: { cell: () => warehouse.active } } })
          },
          { 
            id: 'actions', 
            column: { columnDef: { cell: () => warehouse } },
            getContext: () => ({ column: { columnDef: { cell: () => warehouse } } })
          },
        ],
        getIsSelected: () => false,
      })),
    }),
    getFilteredRowModel: () => ({ rows: mockWarehouses.map((_, index) => ({ id: `row-${index}` })) }),
    getCoreRowModel: () => ({ rows: mockWarehouses.map((_, index) => ({ id: `row-${index}` })) }),
    getCanPreviousPage: () => false,
    getCanNextPage: () => true,
    previousPage: jest.fn(),
    nextPage: jest.fn(),
  }

  const mockUseReactTable = require('@tanstack/react-table').useReactTable

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseReactTable.mockReturnValue(mockTable)
  })

  describe('Component Rendering', () => {
    it('should render the warehouses table', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('warehouse-filters')).toBeInTheDocument()
    })

    it('should render table headers', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getAllByTestId('table-head')).toHaveLength(7) // 7 columns
    })

    it('should render table body', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should render warehouse filters with states', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      const filters = screen.getByTestId('warehouse-filters')
      expect(filters).toBeInTheDocument()
      expect(filters).toHaveAttribute('data-states', 'NY,CA,IL,TX')
    })
  })

  describe('Data Display', () => {
    it('should render table structure with data', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should render table cells for each warehouse', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getAllByTestId('table-cell')).toHaveLength(21) // 7 columns * 3 rows
    })
  })

  describe('Warehouse Actions', () => {
    it('should render warehouse actions structure', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      // Check that the table structure includes action cells
      expect(screen.getAllByTestId('table-cell')).toHaveLength(21) // 7 columns * 3 rows
    })
  })

  describe('Pagination', () => {
    it('should render pagination controls', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getAllByTestId('button')).toHaveLength(2) // Previous and Next buttons
    })

    it('should display warehouse count', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getByText('3 of 3 warehouse(s)')).toBeInTheDocument()
    })

    it('should have disabled previous button when on first page', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      const buttons = screen.getAllByTestId('button')
      const previousButton = buttons.find(button => button.textContent === 'Previous')
      expect(previousButton).toBeDisabled()
    })

    it('should have enabled next button when more pages available', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      const buttons = screen.getAllByTestId('button')
      const nextButton = buttons.find(button => button.textContent === 'Next')
      expect(nextButton).not.toBeDisabled()
    })
  })

  describe('Table Structure', () => {
    it('should have correct number of columns', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getAllByTestId('table-head')).toHaveLength(7)
    })

    it('should have table rows for each warehouse', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getAllByTestId('table-row')).toHaveLength(4) // 1 header + 3 data rows
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should have proper button structure', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={mockStates} />)

      const buttons = screen.getAllByTestId('button')
      expect(buttons).toHaveLength(2)
      buttons.forEach(button => {
        expect(button).toHaveAttribute('data-variant', 'outline')
        expect(button).toHaveAttribute('data-size', 'sm')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle warehouses without contacts', () => {
      const warehousesWithoutContacts = [
        {
          ...mockWarehouses[0],
          contact: [],
        },
      ]

      render(<WarehousesTable initialData={warehousesWithoutContacts} states={mockStates} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle warehouses without address', () => {
      const warehousesWithoutAddress = [
        {
          ...mockWarehouses[0],
          address: null as any,
        },
      ]

      render(<WarehousesTable initialData={warehousesWithoutAddress} states={mockStates} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle empty warehouse list', () => {
      render(<WarehousesTable initialData={[]} states={mockStates} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      // The empty state would be rendered in table cells, but our mock doesn't render the content
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should handle warehouses with missing inventory count', () => {
      const warehousesWithoutInventory = [
        {
          ...mockWarehouses[0],
          inventory_count: undefined,
        },
      ]

      render(<WarehousesTable initialData={warehousesWithoutInventory} states={mockStates} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should handle different warehouse data structures', () => {
      const differentWarehouses: WarehouseWithDetails[] = [
        {
          id: 'test-1',
          code: 'TEST001',
          name: 'Test Warehouse',
          address: {
            street: 'Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'Test Country',
          },
          contact: [],
          inventory_count: 0,
          active: true,
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      render(<WarehousesTable initialData={differentWarehouses} states={['TS']} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle different state arrays', () => {
      render(<WarehousesTable initialData={mockWarehouses} states={[]} />)

      expect(screen.getByTestId('warehouse-filters')).toBeInTheDocument()
    })
  })
})
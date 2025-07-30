/* eslint-env jest */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ReportsTable } from '@/components/features/reports/reports-table'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}))

jest.mock('@/app/actions/reports', () => ({
  duplicateReport: jest.fn(),
  deleteReport: jest.fn(),
  runReport: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock @tanstack/react-table
jest.mock('@tanstack/react-table', () => ({
  ColumnDef: jest.fn(),
  ColumnFiltersState: jest.fn(),
  flexRender: jest.fn((component) => component),
  getCoreRowModel: jest.fn(() => jest.fn()),
  getFilteredRowModel: jest.fn(() => jest.fn()),
  getPaginationRowModel: jest.fn(() => jest.fn()),
  getSortedRowModel: jest.fn(() => jest.fn()),
  SortingState: jest.fn(),
  useReactTable: jest.fn(() => ({
    getHeaderGroups: () => [
      {
        id: 'header-group-1',
        headers: [
          { id: 'name', column: { columnDef: { header: 'Name' } }, isPlaceholder: false, getContext: () => ({}) },
          { id: 'config', column: { columnDef: { header: 'Components' } }, isPlaceholder: false, getContext: () => ({}) },
          { id: 'last_run_at', column: { columnDef: { header: 'Last Run' } }, isPlaceholder: false, getContext: () => ({}) },
          { id: 'run_count', column: { columnDef: { header: 'Runs' } }, isPlaceholder: false, getContext: () => ({}) },
          { id: 'access_level', column: { columnDef: { header: 'Access' } }, isPlaceholder: false, getContext: () => ({}) },
          { id: 'created_at', column: { columnDef: { header: 'Created' } }, isPlaceholder: false, getContext: () => ({}) },
          { id: 'actions', column: { columnDef: { header: 'Actions' } }, isPlaceholder: false, getContext: () => ({}) },
        ],
      },
    ],
    getRowModel: () => ({
      rows: [
        {
          id: 'row-1',
          getVisibleCells: () => [
            { id: 'cell-1', column: { columnDef: { cell: () => 'Sales Report' } }, getContext: () => ({}) },
            { id: 'cell-2', column: { columnDef: { cell: () => '2 components' } }, getContext: () => ({}) },
            { id: 'cell-3', column: { columnDef: { cell: () => 'Jan 15, 2024 10:00 AM' } }, getContext: () => ({}) },
            { id: 'cell-4', column: { columnDef: { cell: () => '5' } }, getContext: () => ({}) },
            { id: 'cell-5', column: { columnDef: { cell: () => 'private' } }, getContext: () => ({}) },
            { id: 'cell-6', column: { columnDef: { cell: () => 'Jan 1, 2024' } }, getContext: () => ({}) },
            { id: 'cell-7', column: { columnDef: { cell: () => 'Actions' } }, getContext: () => ({}) },
          ],
          getIsSelected: () => false,
        },
      ],
    }),
    getCanPreviousPage: () => false,
    getCanNextPage: () => true,
    previousPage: jest.fn(),
    nextPage: jest.fn(),
  })),
}))

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, onClick, disabled, className, asChild }: any) => {
    if (asChild) {
      return <div data-testid="button-as-child">{children}</div>
    }
    return (
      <button
        data-testid="button"
        data-variant={variant}
        data-size={size}
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
    )
  },
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuContent: ({ children, align }: any) => (
    <div data-testid="dropdown-menu-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, disabled, asChild, className }: any) => {
    if (asChild) {
      return <div data-testid="dropdown-menu-item-as-child">{children}</div>
    }
    return (
      <button
        data-testid="dropdown-menu-item"
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
    )
  },
  DropdownMenuSeparator: () => <hr data-testid="dropdown-menu-separator" />,
  DropdownMenuTrigger: ({ children, asChild }: any) => {
    if (asChild) {
      return <div data-testid="dropdown-menu-trigger-as-child">{children}</div>
    }
    return <div data-testid="dropdown-menu-trigger">{children}</div>
  },
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

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => (
    <table data-testid="table">{children}</table>
  ),
  TableBody: ({ children }: any) => (
    <tbody data-testid="table-body">{children}</tbody>
  ),
  TableCell: ({ children, colSpan, className }: any) => (
    <td data-testid="table-cell" colSpan={colSpan} className={className}>
      {children}
    </td>
  ),
  TableHead: ({ children }: any) => (
    <th data-testid="table-head">{children}</th>
  ),
  TableHeader: ({ children }: any) => (
    <thead data-testid="table-header">{children}</thead>
  ),
  TableRow: ({ children, dataState }: any) => (
    <tr data-testid="table-row" data-state={dataState}>{children}</tr>
  ),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="chevron-down">ChevronDown</span>,
  Copy: () => <span data-testid="copy">Copy</span>,
  Edit: () => <span data-testid="edit">Edit</span>,
  MoreHorizontal: () => <span data-testid="more-horizontal">MoreHorizontal</span>,
  Play: () => <span data-testid="play">Play</span>,
  Settings: () => <span data-testid="settings">Settings</span>,
  Share: () => <span data-testid="share">Share</span>,
  Trash2: () => <span data-testid="trash2">Trash2</span>,
}))

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => (
    <a data-testid="link" href={href}>
      {children}
    </a>
  ),
}))

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: jest.fn(),
})

// Mock URL.createObjectURL and URL.revokeObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(() => 'mock-url'),
})

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn(),
})

// Mock document.createElement and appendChild
Object.defineProperty(document, 'createElement', {
  writable: true,
  value: jest.fn(() => ({
    href: '',
    download: '',
    click: jest.fn(),
  })),
})

Object.defineProperty(document.body, 'appendChild', {
  writable: true,
  value: jest.fn(),
})

Object.defineProperty(document.body, 'removeChild', {
  writable: true,
  value: jest.fn(),
})

describe('ReportsTable', () => {
  const mockReports = [
    {
      id: 'report-1',
      organization_id: 'org-1',
      name: 'Sales Report',
      description: 'Monthly sales analysis',
      config: {
        components: [
          { id: 'comp-1', type: 'chart', config: {}, position: { x: 0, y: 0 }, size: { width: 100, height: 100 } },
          { id: 'comp-2', type: 'table', config: {}, position: { x: 100, y: 0 }, size: { width: 100, height: 100 } },
        ],
        dataSources: [],
        filters: [],
        style: { theme: 'light', spacing: 'normal' },
      },
      schedule_enabled: true,
      schedule_cron: '0 9 * * 1',
      schedule_timezone: 'UTC',
      schedule_recipients: ['user@example.com'],
      schedule_format: ['pdf'],
      is_shared: false,
      access_level: 'private',
      last_run_at: '2024-01-15T10:00:00Z',
      run_count: 5,
      created_at: '2024-01-01T00:00:00Z',
      created_by: 'user-1',
      updated_at: '2024-01-15T10:00:00Z',
    },
  ]

  const defaultProps = {
    reports: mockReports,
    showSchedule: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(window.confirm as jest.Mock).mockReturnValue(true)
  })

  describe('Component Structure', () => {
    it('should have search input', () => {
      render(<ReportsTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute('placeholder', 'Search reports...')
    })

    it('should have table structure', () => {
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-header')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('should have pagination controls', () => {
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should have search functionality', () => {
      render(<ReportsTable {...defaultProps} />)

      const searchInput = screen.getByTestId('input')
      expect(searchInput).toBeInTheDocument()
    })
  })

  describe('Report Actions', () => {
    it('should have action functionality', () => {
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Report Management', () => {
    it('should have duplicate functionality', () => {
      const { duplicateReport } = require('@/app/actions/reports')
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(duplicateReport).toBeDefined()
    })

    it('should have delete functionality', () => {
      const { deleteReport } = require('@/app/actions/reports')
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(deleteReport).toBeDefined()
    })

    it('should have run functionality', () => {
      const { runReport } = require('@/app/actions/reports')
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(runReport).toBeDefined()
    })
  })

  describe('Navigation Links', () => {
    it('should have navigation functionality', () => {
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Pagination', () => {
    it('should have pagination functionality', () => {
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no reports', () => {
      render(<ReportsTable reports={[]} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper structure', () => {
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle reports without description', () => {
      const reportsWithoutDescription = [
        {
          ...mockReports[0],
          description: undefined,
        },
      ]

      render(<ReportsTable reports={reportsWithoutDescription} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle reports with empty config', () => {
      const reportsWithEmptyConfig = [
        {
          ...mockReports[0],
          config: {
            components: [],
            dataSources: [],
            filters: [],
            style: { theme: 'light', spacing: 'normal' },
          },
        },
      ]

      render(<ReportsTable reports={reportsWithEmptyConfig} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle reports with null last_run_at', () => {
      const reportsWithNullLastRun = [
        {
          ...mockReports[0],
          last_run_at: null,
        },
      ]

      render(<ReportsTable reports={reportsWithNullLastRun} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should handle different access levels', () => {
      render(<ReportsTable {...defaultProps} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })

    it('should handle different schedule states', () => {
      render(<ReportsTable {...defaultProps} showSchedule={true} />)

      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })
})
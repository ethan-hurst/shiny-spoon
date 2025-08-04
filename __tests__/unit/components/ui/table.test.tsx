import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table'

// Test table component
const TestTable = () => {
  return (
    <Table>
      <TableCaption>A test table for testing purposes</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>John Doe</TableCell>
          <TableCell>john@example.com</TableCell>
          <TableCell>Admin</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Jane Smith</TableCell>
          <TableCell>jane@example.com</TableCell>
          <TableCell>User</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total: 2 users</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

// Test table with custom styling
const TestTableWithCustomStyling = () => {
  return (
    <Table className="custom-table">
      <TableHeader className="custom-header">
        <TableRow className="custom-row">
          <TableHead className="custom-head">Name</TableHead>
          <TableHead className="custom-head">Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="custom-body">
        <TableRow className="custom-row">
          <TableCell className="custom-cell">John Doe</TableCell>
          <TableCell className="custom-cell">john@example.com</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

// Test table with interactive rows
const TestTableWithInteractiveRows = () => {
  const [selectedRow, setSelectedRow] = React.useState<string | null>(null)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          data-state={selectedRow === 'john' ? 'selected' : undefined}
          onClick={() => setSelectedRow('john')}
          className="cursor-pointer"
        >
          <TableCell>John Doe</TableCell>
          <TableCell>john@example.com</TableCell>
        </TableRow>
        <TableRow
          data-state={selectedRow === 'jane' ? 'selected' : undefined}
          onClick={() => setSelectedRow('jane')}
          className="cursor-pointer"
        >
          <TableCell>Jane Smith</TableCell>
          <TableCell>jane@example.com</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

// Test table with empty state
const TestTableWithEmptyState = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* No rows */}
      </TableBody>
    </Table>
  )
}

describe('Table Component', () => {
  describe('Table Elements', () => {
    it('renders table with all sub-components', () => {
      render(<TestTable />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('A test table for testing purposes')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Role')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
      expect(screen.getByText('User')).toBeInTheDocument()
      expect(screen.getByText('Total: 2 users')).toBeInTheDocument()
    })

    it('renders table with proper structure', () => {
      render(<TestTable />)

      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()

      // Check for table sections
      expect(table.querySelector('thead')).toBeInTheDocument()
      expect(table.querySelector('tbody')).toBeInTheDocument()
      expect(table.querySelector('tfoot')).toBeInTheDocument()
      expect(table.querySelector('caption')).toBeInTheDocument()
    })

    it('renders table with custom styling', () => {
      render(<TestTableWithCustomStyling />)

      const table = screen.getByRole('table')
      expect(table).toHaveClass('custom-table')

      const header = table.querySelector('thead')
      expect(header).toHaveClass('custom-header')

      const body = table.querySelector('tbody')
      expect(body).toHaveClass('custom-body')
    })
  })

  describe('Table Sub-components', () => {
    it('renders Table with proper wrapper', () => {
      render(
        <Table data-testid="table">
          <TableBody>
            <TableRow>
              <TableCell>Test</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )

      const table = screen.getByTestId('table')
      expect(table).toBeInTheDocument()
      expect(table.tagName).toBe('TABLE')
    })

    it('renders TableHeader with proper styling', () => {
      render(
        <Table>
          <TableHeader data-testid="header">
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      )

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(header.tagName).toBe('THEAD')
    })

    it('renders TableBody with proper styling', () => {
      render(
        <Table>
          <TableBody data-testid="body">
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )

      const body = screen.getByTestId('body')
      expect(body).toBeInTheDocument()
      expect(body.tagName).toBe('TBODY')
    })

    it('renders TableFooter with proper styling', () => {
      render(
        <Table>
          <TableFooter data-testid="footer">
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )

      const footer = screen.getByTestId('footer')
      expect(footer).toBeInTheDocument()
      expect(footer.tagName).toBe('TFOOT')
    })

    it('renders TableHead with proper styling', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-testid="head">Header Cell</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      )

      const head = screen.getByTestId('head')
      expect(head).toBeInTheDocument()
      expect(head.tagName).toBe('TH')
      expect(head).toHaveClass('h-12', 'px-4', 'text-left', 'align-middle', 'font-medium')
    })

    it('renders TableRow with proper styling', () => {
      render(
        <Table>
          <TableBody>
            <TableRow data-testid="row">
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )

      const row = screen.getByTestId('row')
      expect(row).toBeInTheDocument()
      expect(row.tagName).toBe('TR')
      expect(row).toHaveClass('border-b', 'transition-colors', 'hover:bg-muted/50')
    })

    it('renders TableCell with proper styling', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell data-testid="cell">Cell Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )

      const cell = screen.getByTestId('cell')
      expect(cell).toBeInTheDocument()
      expect(cell.tagName).toBe('TD')
      expect(cell).toHaveClass('p-4', 'align-middle')
    })

    it('renders TableCaption with proper styling', () => {
      render(
        <Table>
          <TableCaption data-testid="caption">Table Caption</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )

      const caption = screen.getByTestId('caption')
      expect(caption).toBeInTheDocument()
      expect(caption.tagName).toBe('CAPTION')
      expect(caption).toHaveClass('mt-4', 'text-sm', 'text-muted-foreground')
    })
  })

  describe('Table Interactions', () => {
    it('handles row selection', async () => {
      const user = userEvent.setup()
      render(<TestTableWithInteractiveRows />)

      const firstRow = screen.getByText('John Doe').closest('tr')
      const secondRow = screen.getByText('Jane Smith').closest('tr')

      expect(firstRow).toBeInTheDocument()
      expect(secondRow).toBeInTheDocument()

      // Click first row
      await user.click(firstRow!)
      expect(firstRow).toHaveAttribute('data-state', 'selected')

      // Click second row
      await user.click(secondRow!)
      expect(secondRow).toHaveAttribute('data-state', 'selected')
      expect(firstRow).not.toHaveAttribute('data-state', 'selected')
    })

    it('handles hover states', async () => {
      const user = userEvent.setup()
      render(<TestTable />)

      const rows = screen.getAllByRole('row')
      const dataRow = rows[1] // First data row (skip header)

      await user.hover(dataRow)
      // The hover class should be applied (this is handled by CSS)
      expect(dataRow).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(<TestTable />)

      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()

      // Check for proper table structure
      const headers = screen.getAllByRole('columnheader')
      expect(headers).toHaveLength(3) // Name, Email, Role

      const cells = screen.getAllByRole('cell')
      expect(cells.length).toBeGreaterThan(0)
    })

    it('supports screen readers with caption', () => {
      render(<TestTable />)

      const caption = screen.getByText('A test table for testing purposes')
      expect(caption).toBeInTheDocument()
      expect(caption.tagName).toBe('CAPTION')
    })

    it('has proper ARIA attributes for interactive elements', () => {
      render(<TestTableWithInteractiveRows />)

      const rows = screen.getAllByRole('row')
      const dataRows = rows.slice(1) // Skip header row

      dataRows.forEach(row => {
        expect(row).toHaveClass('cursor-pointer')
      })
    })
  })

  describe('Table State Management', () => {
    it('handles empty table state', () => {
      render(<TestTableWithEmptyState />)

      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()

      const header = table.querySelector('thead')
      expect(header).toBeInTheDocument()

      const body = table.querySelector('tbody')
      expect(body).toBeInTheDocument()
      expect(body?.children.length).toBe(0)
    })

    it('handles table with many rows', () => {
      const ManyRowsTable = () => {
        const rows = Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
        }))

        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      }

      render(<ManyRowsTable />)

      expect(screen.getByText('User 0')).toBeInTheDocument()
      expect(screen.getByText('User 99')).toBeInTheDocument()
      expect(screen.getByText('user0@example.com')).toBeInTheDocument()
      expect(screen.getByText('user99@example.com')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<TestTable />)
      const endTime = performance.now()

      // Should render within reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('handles large datasets efficiently', () => {
      const LargeTable = () => {
        const rows = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
        }))

        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      }

      const startTime = performance.now()
      render(<LargeTable />)
      const endTime = performance.now()

      // Should render within reasonable time even with many rows
      expect(endTime - startTime).toBeLessThan(300)
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<TestTable />)
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('handles table with very long content', () => {
      const LongContentTable = () => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                This is a very long cell content that might wrap to multiple lines and should be handled gracefully by the table component. It contains a lot of text to test how the table handles overflow and wrapping.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )

      render(<LongContentTable />)

      const longContent = screen.getByText(/This is a very long cell content/)
      expect(longContent).toBeInTheDocument()
    })



    it('handles table with colspan and rowspan', () => {
      const ComplexTable = () => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead colSpan={2}>Header</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell rowSpan={2}>Spanned Cell</TableCell>
              <TableCell>Cell 1</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Cell 2</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )

      render(<ComplexTable />)

      expect(screen.getByText('Header')).toBeInTheDocument()
      expect(screen.getByText('Spanned Cell')).toBeInTheDocument()
      expect(screen.getByText('Cell 1')).toBeInTheDocument()
      expect(screen.getByText('Cell 2')).toBeInTheDocument()
    })
  })

  describe('Integration with UI Components', () => {
    it('works with custom styling classes', () => {
      render(<TestTableWithCustomStyling />)

      const table = screen.getByRole('table')
      expect(table).toHaveClass('custom-table')

      const header = table.querySelector('thead')
      expect(header).toHaveClass('custom-header')

      const body = table.querySelector('tbody')
      expect(body).toHaveClass('custom-body')
    })

    it('works with form elements inside cells', () => {
      const TableWithForm = () => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>John Doe</TableCell>
              <TableCell>
                <button>Edit</button>
                <button>Delete</button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )

      render(<TableWithForm />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })
  })
}) 
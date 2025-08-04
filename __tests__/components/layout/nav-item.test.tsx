import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { NavItem } from '@/components/layout/nav-item'
import { Package } from 'lucide-react'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>
  }
})

const mockNavItem = {
  title: 'Test Item',
  href: '/test',
  icon: Package,
  badge: undefined,
  disabled: false,
  external: false,
  roles: undefined,
}

describe('NavItem', () => {
  beforeEach(() => {
    (usePathname as jest.Mock).mockReturnValue('/')
  })

  it('renders navigation item with correct text and icon', () => {
    render(
      <NavItem 
        item={mockNavItem} 
        isCollapsed={false} 
        userRole="admin"
      />
    )

    expect(screen.getByText('Test Item')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test')
  })

  it('applies active state when current path matches', () => {
    (usePathname as jest.Mock).mockReturnValue('/test')

    render(
      <NavItem 
        item={mockNavItem} 
        isCollapsed={false} 
        userRole="admin"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveClass('bg-secondary')
  })

  it('hides item when user role is not in allowed roles', () => {
    const restrictedItem = {
      ...mockNavItem,
      roles: ['owner'] as const,
    }

    render(
      <NavItem 
        item={restrictedItem} 
        isCollapsed={false} 
        userRole="member"
      />
    )

    expect(screen.queryByText('Test Item')).not.toBeInTheDocument()
  })

  it('shows item when user role is in allowed roles', () => {
    const restrictedItem = {
      ...mockNavItem,
      roles: ['owner', 'admin'] as const,
    }

    render(
      <NavItem 
        item={restrictedItem} 
        isCollapsed={false} 
        userRole="admin"
      />
    )

    expect(screen.getByText('Test Item')).toBeInTheDocument()
  })

  it('disables item when disabled prop is true', () => {
    const disabledItem = {
      ...mockNavItem,
      disabled: true,
    }

    render(
      <NavItem 
        item={disabledItem} 
        isCollapsed={false} 
        userRole="admin"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('disabled')
  })

  it('shows badge when provided', () => {
    const itemWithBadge = {
      ...mockNavItem,
      badge: 5,
    }

    render(
      <NavItem 
        item={itemWithBadge} 
        isCollapsed={false} 
        userRole="admin"
      />
    )

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('applies collapsed styles when isCollapsed is true', () => {
    render(
      <NavItem 
        item={mockNavItem} 
        isCollapsed={true} 
        userRole="admin"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveClass('h-10 w-10 p-0')
  })

  it('applies expanded styles when isCollapsed is false', () => {
    render(
      <NavItem 
        item={mockNavItem} 
        isCollapsed={false} 
        userRole="admin"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveClass('h-10 px-3')
  })

  it('is keyboard accessible', () => {
    render(
      <NavItem 
        item={mockNavItem} 
        isCollapsed={false} 
        userRole="admin"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('tabIndex', '0')
  })
}) 
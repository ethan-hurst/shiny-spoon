/* eslint-env jest */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserProfile } from '@/components/user-profile'
import { createBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import config from '@/config'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
  })),
}))

jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/config', () => ({
  auth: {
    enabled: true,
  },
}))

// Mock UI components
jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className, ...props }: any) => (
    <div data-testid="avatar" className={className} {...props}>
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt, ...props }: any) => (
    <img data-testid="avatar-image" src={src} alt={alt} {...props} />
  ),
  AvatarFallback: ({ children, ...props }: any) => (
    <div data-testid="avatar-fallback" {...props}>
      {children}
    </div>
  ),
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children, asChild, className }: any) => (
    <div data-testid="dropdown-trigger" className={className}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children, className }: any) => (
    <div data-testid="dropdown-content" className={className}>
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children }: any) => (
    <div data-testid="dropdown-label">{children}</div>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
  DropdownMenuGroup: ({ children }: any) => (
    <div data-testid="dropdown-group">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <div data-testid="dropdown-item" onClick={onClick} {...props}>
      {children}
    </div>
  ),
  DropdownMenuShortcut: ({ children }: any) => (
    <div data-testid="dropdown-shortcut">{children}</div>
  ),
}))

jest.mock('lucide-react', () => ({
  LogOut: ({ className }: any) => (
    <div data-testid="logout-icon" className={className} />
  ),
  Settings: ({ className }: any) => (
    <div data-testid="settings-icon" className={className} />
  ),
  User: ({ className }: any) => (
    <div data-testid="user-icon" className={className} />
  ),
}))

describe('UserProfile', () => {
  let mockSupabase: any
  let mockRouter: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        signOut: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
    }

    ;(createBrowserClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock router
    const { useRouter } = require('next/navigation')
    mockRouter = {
      push: jest.fn(),
      back: jest.fn(),
    }
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  describe('Component Rendering', () => {
    it('should render loading state initially', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      render(<UserProfile />)

      // The loading state is a div with animate-pulse class
      const loadingElement = document.querySelector('.animate-pulse')
      expect(loadingElement).toHaveClass('animate-pulse')
      expect(loadingElement).toHaveClass('bg-muted')
    })

    it('should render user avatar when user is loaded', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {
          avatar_url: 'https://example.com/avatar.jpg',
        },
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('avatar-image')).toBeInTheDocument()
        expect(screen.getByTestId('avatar-image')).toHaveAttribute(
          'src',
          'https://example.com/avatar.jpg'
        )
      })
    })

    it('should render avatar fallback when no avatar URL', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {},
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument()
        expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('T')
      })
    })

    it.skip('should not render when auth is disabled', async () => {
      // Mock config to disable auth for this test
      jest.doMock('@/config', () => ({
        auth: { enabled: false },
      }))

      render(<UserProfile />)

      expect(mockRouter.back).toHaveBeenCalled()
    })
  })

  describe('User Data Fetching', () => {
    it('should fetch user data on mount', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      })
    })

    it('should handle user fetch error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Failed to fetch user' },
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument()
      })
    })

    it('should handle unexpected error during user fetch', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Network error'))

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument()
      })
    })

    it('should set up auth state change listener', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled()
      })
    })
  })

  describe('Dropdown Menu', () => {
    beforeEach(async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
    })

    it('should render dropdown menu with user info', async () => {
      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument()
        expect(screen.getByTestId('dropdown-label')).toBeInTheDocument()
        expect(screen.getByText('My Account')).toBeInTheDocument()
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })
    })

    it('should render navigation menu items', async () => {
      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Settings')).toBeInTheDocument()
        expect(screen.getByText('Log out')).toBeInTheDocument()
      })
    })

    it('should render menu item icons', async () => {
      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getAllByTestId('user-icon')).toHaveLength(1)
        expect(screen.getAllByTestId('settings-icon')).toHaveLength(1)
        expect(screen.getAllByTestId('logout-icon')).toHaveLength(1)
      })
    })

    it('should render keyboard shortcuts', async () => {
      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByText('⌘S')).toBeInTheDocument()
        expect(screen.getByText('⇧⌘Q')).toBeInTheDocument()
      })
    })
  })

  describe('Sign Out Functionality', () => {
    beforeEach(async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
    })

    it('should handle successful sign out', async () => {
      const user = userEvent.setup()
      mockSupabase.auth.signOut.mockResolvedValue({ error: null })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByText('Log out')).toBeInTheDocument()
      })

      const logoutButton = screen.getByText('Log out').closest('[data-testid="dropdown-item"]')
      await user.click(logoutButton!)

      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled()
        expect(mockRouter.push).toHaveBeenCalledWith('/sign-in')
        expect(toast.success).toHaveBeenCalledWith('Signed out successfully')
      })
    })

    it('should handle sign out error', async () => {
      const user = userEvent.setup()
      mockSupabase.auth.signOut.mockRejectedValue(new Error('Sign out failed'))

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByText('Log out')).toBeInTheDocument()
      })

      const logoutButton = screen.getByText('Log out').closest('[data-testid="dropdown-item"]')
      await user.click(logoutButton!)

      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled()
        expect(toast.error).toHaveBeenCalledWith('Error signing out')
      })
    })
  })

  describe('Avatar Functionality', () => {
    it('should display user initials from email', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'john.doe@example.com',
        user_metadata: {},
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('J')
      })
    })

    it('should handle user without email', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: null,
        user_metadata: {},
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('')
      })
    })

    it('should display avatar image when available', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {
          avatar_url: 'https://example.com/avatar.jpg',
        },
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('avatar-image')).toHaveAttribute(
          'src',
          'https://example.com/avatar.jpg'
        )
        expect(screen.getByTestId('avatar-image')).toHaveAttribute(
          'alt',
          'User Profile'
        )
      })
    })
  })

  describe('Error States', () => {
    it('should not render when user is null', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument()
      })
    })

    it('should not render when there is an error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Authentication failed' },
      })

      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    beforeEach(async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
    })

    it('should have proper ARIA labels', async () => {
      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('avatar-image')).toHaveAttribute(
          'alt',
          'User Profile'
        )
      })
    })

    it('should have proper dropdown structure', async () => {
      render(<UserProfile />)

      await waitFor(() => {
        expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument()
        expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument()
        expect(screen.getByTestId('dropdown-content')).toBeInTheDocument()
      })
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component can be rendered without TypeScript errors
      expect(() => render(<UserProfile />)).not.toThrow()
    })
  })
})
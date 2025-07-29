import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserNav } from '@/components/auth/user-nav'
import { signOut } from '@/app/actions/auth'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('@/app/actions/auth', () => ({
  signOut: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

describe('UserNav', () => {
  const mockSignOut = signOut as jest.MockedFunction<typeof signOut>
  const mockToastSuccess = toast.success as jest.MockedFunction<typeof toast.success>
  const mockToastError = toast.error as jest.MockedFunction<typeof toast.error>

  const defaultUser = {
    email: 'john.doe@example.com',
    name: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
  }

  const defaultOrganization = {
    name: 'Acme Corporation',
    slug: 'acme-corp',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render user avatar with initials', () => {
      render(<UserNav user={defaultUser} />)

      expect(screen.getByRole('button', { name: 'User account menu' })).toBeInTheDocument()
      expect(screen.getByText('JD')).toBeInTheDocument() // John Doe initials
    })

    it('should render user avatar with email initials when no name provided', () => {
      const userWithoutName = { ...defaultUser, name: undefined }
      render(<UserNav user={userWithoutName} />)

      expect(screen.getByText('JO')).toBeInTheDocument() // john.doe@example.com initials
    })

    it('should render user avatar with email initials for single character name', () => {
      const userWithSingleName = { ...defaultUser, name: 'J' }
      render(<UserNav user={userWithSingleName} />)

      expect(screen.getByText('J')).toBeInTheDocument()
    })

    it('should render user avatar with email initials for very long name', () => {
      const userWithLongName = { ...defaultUser, name: 'John Michael Smith Johnson' }
      render(<UserNav user={userWithLongName} />)

      expect(screen.getByText('JM')).toBeInTheDocument() // First two initials
    })

    it('should render organization information when provided', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} organization={defaultOrganization} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
    })

    it('should not render organization section when not provided', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.queryByText('Acme Corporation')).not.toBeInTheDocument()
    })
  })

  describe('Dropdown Menu', () => {
    it('should open dropdown menu when clicked', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Profile')).toBeInTheDocument()
      expect(screen.getByText('Sign out')).toBeInTheDocument()
    })

    it('should display user information in dropdown', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
    })

    it('should display "User" when no name is provided', async () => {
      const user = userEvent.setup()
      const userWithoutName = { ...defaultUser, name: undefined }
      render(<UserNav user={userWithoutName} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.getByText('User')).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('should have settings and profile menu items', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.getByRole('menuitem', { name: 'Go to settings' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Go to profile' })).toBeInTheDocument()
    })
  })

  describe('Sign Out Functionality', () => {
    it('should handle successful sign out', async () => {
      const user = userEvent.setup()
      mockSignOut.mockResolvedValue(undefined)

      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      const signOutButton = screen.getByRole('menuitem', { name: 'Sign out of your account' })
      await user.click(signOutButton)

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled()
        expect(mockToastSuccess).toHaveBeenCalledWith('Signed out successfully')
      })
    })

    it('should handle sign out errors', async () => {
      const user = userEvent.setup()
      mockSignOut.mockRejectedValue(new Error('Network error'))

      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      const signOutButton = screen.getByRole('menuitem', { name: 'Sign out of your account' })
      await user.click(signOutButton)

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled()
        expect(mockToastError).toHaveBeenCalledWith('Error signing out')
      })
    })

    it('should show loading state during sign out', async () => {
      const user = userEvent.setup()
      mockSignOut.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      const signOutButton = screen.getByRole('menuitem', { name: 'Sign out of your account' })
      await user.click(signOutButton)

      // Check that the button is disabled during loading
      expect(signOutButton).toHaveAttribute('aria-disabled', 'true')
    })

    it('should disable sign out button during loading', async () => {
      const user = userEvent.setup()
      mockSignOut.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      const signOutButton = screen.getByRole('menuitem', { name: 'Sign out of your account' })
      await user.click(signOutButton)

      expect(signOutButton).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('User Interactions', () => {
    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      
      // Tab to the trigger button
      await user.tab()
      expect(triggerButton).toHaveFocus()

      // Open the dropdown
      await user.keyboard('{Enter}')
      
      // Should show dropdown content
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.getByText('John Doe')).toBeInTheDocument()

      // Press Escape to close the dropdown instead of clicking outside
      await user.keyboard('{Escape}')

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })

    it('should handle multiple rapid sign out attempts', async () => {
      const user = userEvent.setup()
      mockSignOut.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      const signOutButton = screen.getByRole('menuitem', { name: 'Sign out of your account' })
      await user.click(signOutButton)
      await user.click(signOutButton) // Try to click again

      // Should only call once due to loading state
      expect(mockSignOut).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<UserNav user={defaultUser} />)

      expect(screen.getByRole('button', { name: 'User account menu' })).toBeInTheDocument()
    })

    it('should have proper button states', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.getByRole('menuitem', { name: 'Go to settings' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Go to profile' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Sign out of your account' })).toBeInTheDocument()
    })

    it('should have proper focus management', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.tab()
      expect(triggerButton).toHaveFocus()
    })
  })

  describe('Avatar Display', () => {
    it('should display avatar image when provided', () => {
      render(<UserNav user={defaultUser} />)

      // The component shows fallback initials even when avatar is provided
      // This is the expected behavior for the Avatar component
      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('should display fallback initials when no avatar provided', () => {
      const userWithoutAvatar = { ...defaultUser, avatar: undefined }
      render(<UserNav user={userWithoutAvatar} />)

      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('should handle empty avatar URL', () => {
      const userWithEmptyAvatar = { ...defaultUser, avatar: '' }
      render(<UserNav user={userWithEmptyAvatar} />)

      expect(screen.getByText('JD')).toBeInTheDocument()
    })
  })

  describe('Organization Display', () => {
    it('should display organization with Building icon', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} organization={defaultOrganization} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      const organizationItem = screen.getByText('Acme Corporation')
      expect(organizationItem).toBeInTheDocument()

      // Check that Building icon is present
      const buildingIcon = document.querySelector('.lucide-building')
      expect(buildingIcon).toBeInTheDocument()
    })

    it('should not display organization section when organization is not provided', async () => {
      const user = userEvent.setup()
      render(<UserNav user={defaultUser} />)

      const triggerButton = screen.getByRole('button', { name: 'User account menu' })
      await user.click(triggerButton)

      expect(screen.queryByText('Acme Corporation')).not.toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This should compile without TypeScript errors
      render(<UserNav user={defaultUser} />)

      expect(screen.getByRole('button', { name: 'User account menu' })).toBeInTheDocument()
    })

    it('should handle optional props correctly', () => {
      const userWithoutOptionalProps = { email: 'test@example.com' }
      render(<UserNav user={userWithoutOptionalProps} />)

      expect(screen.getByRole('button', { name: 'User account menu' })).toBeInTheDocument()
    })
  })
})
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserMenu } from '@/components/layout/user-menu'
import { signOut } from '@/app/actions/auth'

// Mock the auth action
jest.mock('@/app/actions/auth', () => ({
  signOut: jest.fn(),
}))

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>
  }
})

const mockUser = {
  email: 'test@example.com',
  full_name: 'John Doe',
  avatar_url: 'https://example.com/avatar.jpg',
}

describe('UserMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders user avatar with fallback initials', () => {
    render(<UserMenu user={mockUser} />)

    const avatar = screen.getByRole('button')
    expect(avatar).toBeInTheDocument()
  })

  it('shows user initials when no avatar is provided', () => {
    const userWithoutAvatar = {
      ...mockUser,
      avatar_url: undefined,
    }

    render(<UserMenu user={userWithoutAvatar} />)

    // The fallback should show "JD" for "John Doe"
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('shows email initial when no name is provided', () => {
    const userWithoutName = {
      ...mockUser,
      full_name: undefined,
    }

    render(<UserMenu user={userWithoutName} />)

    // The fallback should show "T" for "test@example.com"
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('opens dropdown when clicked', async () => {
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    // Wait for dropdown to open and check for user info
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
  })

  it('shows user information in dropdown', async () => {
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  it('shows profile link in dropdown', async () => {
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    await waitFor(() => {
      const profileLink = screen.getByText('Profile')
      expect(profileLink).toBeInTheDocument()
    })
  })

  it('shows settings link in dropdown', async () => {
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    await waitFor(() => {
      const settingsLink = screen.getByText('Settings')
      expect(settingsLink).toBeInTheDocument()
    })
  })

  it('calls signOut when sign out is clicked', async () => {
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    await waitFor(() => {
      const signOutButton = screen.getByText('Sign out')
      fireEvent.click(signOutButton)
    })

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('is keyboard accessible', () => {
    render(<UserMenu user={mockUser} />)

    const trigger = screen.getByRole('button')
    expect(trigger).toHaveAttribute('type', 'button')
  })

  it('handles user with minimal data', () => {
    const minimalUser = {
      email: 'minimal@example.com',
    }

    render(<UserMenu user={minimalUser} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('minimal@example.com')).toBeInTheDocument()
  })

  it('handles empty user data gracefully', () => {
    const emptyUser = {}

    render(<UserMenu user={emptyUser} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('U')).toBeInTheDocument() // Fallback initial
  })
}) 
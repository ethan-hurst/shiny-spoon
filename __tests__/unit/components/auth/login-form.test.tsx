import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/auth/login-form'
import { signIn } from '@/app/actions/auth'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('@/app/actions/auth', () => ({
  signIn: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}))

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

describe('LoginForm', () => {
  const mockSignIn = signIn as jest.MockedFunction<typeof signIn>
  const mockToastError = toast.error as jest.MockedFunction<typeof toast.error>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Form Structure and Accessibility', () => {
    it('should render all form elements', () => {
      render(<LoginForm />)

      expect(screen.getByLabelText('Login form')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Reset your password' })).toBeInTheDocument()
    })

    it('should have proper form labels and placeholders', () => {
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('placeholder', 'name@company.com')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')

      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('placeholder', 'Enter your password')
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
    })

    it('should have proper accessibility attributes', () => {
      render(<LoginForm />)

      const form = screen.getByLabelText('Login form')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })
      const forgotPasswordLink = screen.getByRole('link', { name: 'Reset your password' })

      expect(form).toBeInTheDocument()
      expect(submitButton).toBeInTheDocument()
      expect(forgotPasswordLink).toHaveAttribute('href', '/reset-password')
      expect(forgotPasswordLink).toHaveAttribute('aria-label', 'Reset your password')
    })
  })

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'invalid-email')
      await user.type(passwordInput, 'password123') // Need valid password too
      await user.click(submitButton)

      // The form should not submit with invalid email, so signIn should not be called
      expect(mockSignIn).not.toHaveBeenCalled()
    })

    it('should validate password length', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'short')
      await user.click(submitButton)

      // The form should not submit with invalid password, so signIn should not be called
      expect(mockSignIn).not.toHaveBeenCalled()
    })

    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const submitButton = screen.getByRole('button', { name: 'Sign in' })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument()
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
      })
    })

    it('should clear validation errors when user starts typing', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      // Trigger validation error
      await user.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument()
      })

      // Start typing valid email
      await user.clear(emailInput)
      await user.type(emailInput, 'test@example.com')

      await waitFor(() => {
        expect(screen.queryByText('Invalid email address')).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      const user = userEvent.setup()
      mockSignIn.mockResolvedValue(undefined) // Success case
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(expect.any(FormData))
      })

      const formData = mockSignIn.mock.calls[0][0] as FormData
      expect(formData.get('email')).toBe('test@example.com')
      expect(formData.get('password')).toBe('password123')
    })

    it('should show loading state during submission', async () => {
      const user = userEvent.setup()
      mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      // Should show loading state
      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled()
    })

    it('should handle signIn error', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Invalid credentials'
      mockSignIn.mockResolvedValue({ error: errorMessage })
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(errorMessage)
      })
    })

    it('should handle unexpected errors', async () => {
      const user = userEvent.setup()
      mockSignIn.mockRejectedValue(new Error('Network error'))
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('An unexpected error occurred')
      })
    })

    it('should reset loading state after error', async () => {
      const user = userEvent.setup()
      mockSignIn.mockRejectedValue(new Error('Network error'))
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      // Wait for error handling to complete
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled()
      })

      // Should be back to normal state
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled()
    })
  })

  describe('User Interactions', () => {
    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      // Tab through form elements
      await user.tab()
      expect(emailInput).toHaveFocus()

      await user.tab()
      // Skip the "Forgot password?" link
      await user.tab()
      expect(passwordInput).toHaveFocus()

      await user.tab()
      expect(submitButton).toHaveFocus()
    })

    it('should handle form submission with Enter key', async () => {
      const user = userEvent.setup()
      mockSignIn.mockResolvedValue(undefined)
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled()
      })
    })

    it('should not submit form when validation fails', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const submitButton = screen.getByRole('button', { name: 'Sign in' })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument()
      })

      expect(mockSignIn).not.toHaveBeenCalled()
    })
  })

  describe('Form State Management', () => {
    it('should maintain form state during typing', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')

      expect(emailInput).toHaveValue('test@example.com')
      expect(passwordInput).toHaveValue('password123')
    })

    it('should handle form reset', async () => {
      const user = userEvent.setup()
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')

      // Clear fields
      await user.clear(emailInput)
      await user.clear(passwordInput)

      expect(emailInput).toHaveValue('')
      expect(passwordInput).toHaveValue('')
    })
  })

  describe('Accessibility and UX', () => {
    it('should have proper ARIA labels', () => {
      render(<LoginForm />)

      expect(screen.getByLabelText('Login form')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Reset your password' })).toBeInTheDocument()
    })

    it('should disable submit button during loading', async () => {
      const user = userEvent.setup()
      mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled()
    })

    it('should show forgot password link with proper styling', () => {
      render(<LoginForm />)

      const forgotPasswordLink = screen.getByRole('link', { name: 'Reset your password' })
      
      expect(forgotPasswordLink).toHaveClass('text-sm', 'text-blue-600', 'hover:underline')
      expect(forgotPasswordLink).toHaveAttribute('href', '/reset-password')
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', async () => {
      const user = userEvent.setup()
      mockSignIn.mockResolvedValue(undefined)
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Sign in' })

      // This should compile without TypeScript errors
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(expect.any(FormData))
      })
    })
  })
})
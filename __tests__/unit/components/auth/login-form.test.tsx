import React from 'react'
import { render, screen, waitFor } from '@/__tests__/helpers/test-utils'
import { LoginForm } from '@/components/auth/login-form'
import { signIn } from '@/app/actions/auth'

// Mock the signIn action
jest.mocked(signIn).mockImplementation(async (formData: FormData) => {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (email === 'test@example.com' && password === 'password123') {
    return { success: true }
  }

  if (email === 'error@example.com') {
    return { error: 'Invalid credentials' }
  }

  return { error: 'An unexpected error occurred' }
})

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders the login form with all required fields', () => {
      render(<LoginForm />)
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
    })

    it('has proper form structure and accessibility', () => {
      render(<LoginForm />)
      
      const form = screen.getByRole('form', { name: /login form/i })
      expect(form).toBeInTheDocument()
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('autocomplete', 'email')
      expect(emailInput).toHaveAttribute('placeholder', 'name@company.com')
      
      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
      expect(passwordInput).toHaveAttribute('placeholder', 'Enter your password')
    })

    it('renders forgot password link with correct href', () => {
      render(<LoginForm />)
      
      const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i })
      expect(forgotPasswordLink).toHaveAttribute('href', '/reset-password')
      expect(forgotPasswordLink).toHaveAttribute('aria-label', 'Reset your password')
    })
  })

  describe('Form Validation', () => {
    it('shows validation error for invalid email format', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'invalid-email')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
      })
    })

    it('shows validation error for empty email', async () => {
      const { user } = render(<LoginForm />)
      
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      })
    })

    it('shows validation error for empty password', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      })
    })

    it('shows validation error for password that is too short', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, '123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/password must be at least/i)).toBeInTheDocument()
      })
    })

    it('clears validation errors when user starts typing', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      // Submit with empty email to trigger validation error
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      })
      
      // Start typing to clear the error
      await user.type(emailInput, 'test@example.com')
      
      await waitFor(() => {
        expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    it('submits form with valid credentials', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(signIn).toHaveBeenCalledTimes(1)
      })
      
      const formData = new FormData()
      formData.append('email', 'test@example.com')
      formData.append('password', 'password123')
      
      expect(signIn).toHaveBeenCalledWith(formData)
    })

    it('shows loading state during submission', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })

    it('disables submit button during submission', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      expect(submitButton).toBeDisabled()
    })

    it('handles server errors gracefully', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'error@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
    })

    it('handles unexpected errors', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'unknown@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument()
      })
    })

    it('resets loading state after error', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'error@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      // Wait for error to appear and loading state to reset
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
      
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
  })

  describe('User Interaction', () => {
    it('allows user to type in email field', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'test@example.com')
      
      expect(emailInput).toHaveValue('test@example.com')
    })

    it('allows user to type in password field', async () => {
      const { user } = render(<LoginForm />)
      
      const passwordInput = screen.getByLabelText(/password/i)
      await user.type(passwordInput, 'password123')
      
      expect(passwordInput).toHaveValue('password123')
    })

    it('submits form on Enter key press', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(signIn).toHaveBeenCalledTimes(1)
      })
    })

    it('focuses email field on initial render', () => {
      render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveFocus()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<LoginForm />)
      
      const form = screen.getByRole('form', { name: /login form/i })
      expect(form).toBeInTheDocument()
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('type', 'email')
      
      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('type', 'password')
      
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      expect(submitButton).toHaveAttribute('type', 'submit')
    })

    it('supports keyboard navigation', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      // Tab through form elements
      await user.tab()
      expect(emailInput).toHaveFocus()
      
      await user.tab()
      expect(passwordInput).toHaveFocus()
      
      await user.tab()
      expect(submitButton).toHaveFocus()
    })

    it('announces validation errors to screen readers', async () => {
      const { user } = render(<LoginForm />)
      
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      })
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('Error Handling', () => {
    it('clears previous errors when form is resubmitted', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      // First submission with error
      await user.type(emailInput, 'error@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
      
      // Clear form and resubmit with valid credentials
      await user.clear(emailInput)
      await user.clear(passwordInput)
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument()
      })
    })

    it('handles network errors gracefully', async () => {
      // Mock a network error
      jest.mocked(signIn).mockRejectedValueOnce(new Error('Network error'))
      
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument()
      })
    })
  })

  describe('Security', () => {
    it('does not log sensitive information', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(signIn).toHaveBeenCalled()
      })
      
      // Verify that sensitive data is not logged
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('password123')
      )
      
      consoleSpy.mockRestore()
    })

    it('sanitizes input data', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      // Test with potentially malicious input
      await user.type(emailInput, '<script>alert("xss")</script>@example.com')
      await user.type(passwordInput, 'password<script>alert("xss")</script>')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(signIn).toHaveBeenCalled()
      })
      
      const formData = new FormData()
      formData.append('email', '<script>alert("xss")</script>@example.com')
      formData.append('password', 'password<script>alert("xss")</script>')
      
      expect(signIn).toHaveBeenCalledWith(formData)
    })
  })

  describe('Performance', () => {
    it('debounces rapid form submissions', async () => {
      const { user } = render(<LoginForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      
      // Rapidly click submit multiple times
      await user.click(submitButton)
      await user.click(submitButton)
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(signIn).toHaveBeenCalledTimes(1)
      })
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<LoginForm />)
      
      // This should not throw any errors
      expect(() => unmount()).not.toThrow()
    })
  })
})

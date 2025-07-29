import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from '@/components/auth/signup-form'
import { signUp } from '@/app/actions/auth'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('@/app/actions/auth', () => ({
  signUp: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

describe('SignupForm', () => {
  const mockSignUp = signUp as jest.MockedFunction<typeof signUp>
  const mockToastError = toast.error as jest.MockedFunction<typeof toast.error>
  const mockToastSuccess = toast.success as jest.MockedFunction<typeof toast.success>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Form Structure and Accessibility', () => {
    it('should render all form elements', () => {
      render(<SignupForm />)

      expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Organization Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    })

    it('should have proper form labels and placeholders', () => {
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')

      expect(fullNameInput).toHaveAttribute('placeholder', 'John Doe')
      expect(fullNameInput).toHaveAttribute('autoComplete', 'name')

      expect(organizationInput).toHaveAttribute('placeholder', 'Acme Corporation')
      expect(organizationInput).toHaveAttribute('autoComplete', 'organization')

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('placeholder', 'name@company.com')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')

      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('placeholder', 'Create a strong password')
      expect(passwordInput).toHaveAttribute('autoComplete', 'new-password')

      expect(confirmPasswordInput).toHaveAttribute('type', 'password')
      expect(confirmPasswordInput).toHaveAttribute('placeholder', 'Confirm your password')
      expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password')
    })

    it('should have proper accessibility attributes', () => {
      render(<SignupForm />)

      const submitButton = screen.getByRole('button', { name: 'Create account' })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).toHaveAttribute('type', 'submit')
    })
  })

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(emailInput, 'invalid-email')
      await user.click(submitButton)

      // Form should not submit with invalid email
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('should validate password requirements', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'weak')
      await user.click(submitButton)

      // Form should not submit with weak password
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('should validate password confirmation match', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'DifferentPass123')
      await user.click(submitButton)

      // Form should not submit with mismatched passwords
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('should validate required fields', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const submitButton = screen.getByRole('button', { name: 'Create account' })
      await user.click(submitButton)

      // Form should not submit with empty required fields
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('should validate full name length', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'A') // Too short
      await user.click(submitButton)

      // Form should not submit with short name
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('should validate organization name length', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const organizationInput = screen.getByLabelText('Organization Name')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(organizationInput, 'A') // Too short
      await user.click(submitButton)

      // Form should not submit with short organization name
      expect(mockSignUp).not.toHaveBeenCalled()
    })
  })

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ success: true })
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(expect.any(FormData))
      })

      const formData = mockSignUp.mock.calls[0][0] as FormData
      expect(formData.get('fullName')).toBe('John Doe')
      expect(formData.get('organizationName')).toBe('Acme Corporation')
      expect(formData.get('email')).toBe('john@acme.com')
      expect(formData.get('password')).toBe('StrongPass123')
      expect(formData.get('confirmPassword')).toBe('StrongPass123')
    })

    it('should show loading state during submission', async () => {
      const user = userEvent.setup()
      mockSignUp.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      // Should show loading state
      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled()
    })

    it('should handle signUp error', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Email already exists'
      mockSignUp.mockResolvedValue({ error: errorMessage })
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(errorMessage)
      })
    })

    it('should handle unexpected errors', async () => {
      const user = userEvent.setup()
      mockSignUp.mockRejectedValue(new Error('Network error'))
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('An unexpected error occurred')
      })
    })

    it('should reset loading state after error', async () => {
      const user = userEvent.setup()
      mockSignUp.mockRejectedValue(new Error('Network error'))
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      // Wait for error handling to complete
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled()
      })

      // Should be back to normal state
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create account' })).not.toBeDisabled()
    })
  })

  describe('Success States', () => {
    it('should show success message for immediate success', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ success: true })
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Account created successfully!')
      })
    })

    it('should show email confirmation screen when email confirmation is required', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ 
        success: true, 
        requiresEmailConfirmation: true 
      })
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument()
        expect(screen.getByText(/We've sent a confirmation link to john@acme.com/)).toBeInTheDocument()
        expect(screen.getByText(/Didn't receive the email/)).toBeInTheDocument()
      })
    })
  })

  describe('User Interactions', () => {
    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      // Tab through form elements
      await user.tab()
      expect(fullNameInput).toHaveFocus()

      await user.tab()
      expect(organizationInput).toHaveFocus()

      await user.tab()
      expect(emailInput).toHaveFocus()

      await user.tab()
      expect(passwordInput).toHaveFocus()

      await user.tab()
      expect(confirmPasswordInput).toHaveFocus()

      await user.tab()
      expect(submitButton).toHaveFocus()
    })

    it('should handle form submission with Enter key', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ success: true })
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled()
      })
    })

    it('should not submit form when validation fails', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const submitButton = screen.getByRole('button', { name: 'Create account' })
      await user.click(submitButton)

      expect(mockSignUp).not.toHaveBeenCalled()
    })
  })

  describe('Form State Management', () => {
    it('should maintain form state during typing', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')

      expect(fullNameInput).toHaveValue('John Doe')
      expect(organizationInput).toHaveValue('Acme Corporation')
      expect(emailInput).toHaveValue('john@acme.com')
      expect(passwordInput).toHaveValue('StrongPass123')
      expect(confirmPasswordInput).toHaveValue('StrongPass123')
    })

    it('should handle form reset', async () => {
      const user = userEvent.setup()
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')

      // Clear fields
      await user.clear(fullNameInput)
      await user.clear(organizationInput)
      await user.clear(emailInput)
      await user.clear(passwordInput)
      await user.clear(confirmPasswordInput)

      expect(fullNameInput).toHaveValue('')
      expect(organizationInput).toHaveValue('')
      expect(emailInput).toHaveValue('')
      expect(passwordInput).toHaveValue('')
      expect(confirmPasswordInput).toHaveValue('')
    })
  })

  describe('Accessibility and UX', () => {
    it('should have proper ARIA labels', () => {
      render(<SignupForm />)

      expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Organization Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    })

    it('should disable submit button during loading', async () => {
      const user = userEvent.setup()
      mockSignUp.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled()
    })

    it('should show terms of service text', () => {
      render(<SignupForm />)

      expect(screen.getByText(/By creating an account, you agree to our Terms of Service and Privacy Policy/)).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ success: true })
      render(<SignupForm />)

      const fullNameInput = screen.getByLabelText('Full Name')
      const organizationInput = screen.getByLabelText('Organization Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm Password')
      const submitButton = screen.getByRole('button', { name: 'Create account' })

      // This should compile without TypeScript errors
      await user.type(fullNameInput, 'John Doe')
      await user.type(organizationInput, 'Acme Corporation')
      await user.type(emailInput, 'john@acme.com')
      await user.type(passwordInput, 'StrongPass123')
      await user.type(confirmPasswordInput, 'StrongPass123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(expect.any(FormData))
      })
    })
  })
})
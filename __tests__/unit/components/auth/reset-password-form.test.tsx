import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { resetPassword } from '@/app/actions/auth'

// Mock dependencies
jest.mock('@/app/actions/auth', () => ({
  resetPassword: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}))

describe('ResetPasswordForm', () => {
  const mockResetPassword = resetPassword as jest.MockedFunction<
    typeof resetPassword
  >
  const mockToastError = toast.error as jest.MockedFunction<typeof toast.error>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Form Structure and Accessibility', () => {
    it('should render the form with all required elements', () => {
      render(<ResetPasswordForm />)

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Send reset link' })
      ).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('name@company.com')
      ).toBeInTheDocument()
    })

    it('should have proper form accessibility attributes', () => {
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')
      expect(submitButton).toHaveAttribute('type', 'submit')
    })

    it('should have proper form structure', () => {
      render(<ResetPasswordForm />)

      // Use querySelector to find the form element since it doesn't have role="form"
      const form = document.querySelector('form')
      expect(form).toBeInTheDocument()
      expect(form).toHaveAttribute(
        'class',
        expect.stringContaining('space-y-4')
      )
    })
  })

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'invalid-email')
      await user.click(submitButton)

      // The form should not submit with invalid email, so resetPassword should not be called
      expect(mockResetPassword).not.toHaveBeenCalled()
    })

    it('should validate required email field', async () => {
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.click(submitButton)

      // The form should not submit with empty email, so resetPassword should not be called
      expect(mockResetPassword).not.toHaveBeenCalled()
    })

    it('should accept valid email format', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith(expect.any(FormData))
      })
    })
  })

  describe('Form Submission', () => {
    it('should submit form with correct data', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith(
          expect.objectContaining({
            get: expect.any(Function),
            append: expect.any(Function),
          })
        )
      })

      // Verify the FormData contains the correct email
      const formData = mockResetPassword.mock.calls[0][0] as FormData
      expect(formData.get('email')).toBe('test@example.com')
    })

    it('should handle successful submission', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument()
        expect(
          screen.getByText(
            /We've sent a password reset link to test@example.com/
          )
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            "Didn't receive the email? Check your spam folder or try again."
          )
        ).toBeInTheDocument()
      })
    })

    it('should handle submission errors', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ error: 'User not found' })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('User not found')
      })
    })

    it('should handle unexpected errors', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockRejectedValue(new Error('Network error'))
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'An unexpected error occurred'
        )
      })
    })
  })

  describe('Loading States', () => {
    it('should show loading state during submission', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(
        screen.getByRole('button', { name: 'Sending reset link...' })
      ).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('should disable submit button during loading', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(submitButton).toBeDisabled()
    })
  })

  describe('Success State', () => {
    it('should show success message with correct email', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'john@acme.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument()
        expect(
          screen.getByText(/We've sent a password reset link to john@acme.com/)
        ).toBeInTheDocument()
      })
    })

    it('should show Mail icon in success state', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        // The Mail icon should be present (Lucide icons have specific classes)
        const mailIcon = document.querySelector('.lucide-mail')
        expect(mailIcon).toBeInTheDocument()
      })
    })

    it('should have try again button in success state', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Try again' })
        ).toBeInTheDocument()
      })
    })

    it('should reset form when try again is clicked', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument()
      })

      const tryAgainButton = screen.getByRole('button', { name: 'Try again' })
      await user.click(tryAgainButton)

      // Should be back to the form
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Send reset link' })
      ).toBeInTheDocument()
      expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      // Tab through form elements
      await user.tab()
      expect(emailInput).toHaveFocus()

      await user.tab()
      expect(submitButton).toHaveFocus()
    })

    it('should handle form submission with Enter key', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')

      await user.type(emailInput, 'test@example.com')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalled()
      })
    })
  })

  describe('Form State Management', () => {
    it('should maintain form state during loading', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      // Email should still be visible during loading
      expect(emailInput).toHaveValue('test@example.com')
    })

    it('should handle multiple rapid submissions', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)
      await user.click(submitButton) // Try to submit again

      // Should only call once due to loading state
      expect(mockResetPassword).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility and UX', () => {
    it('should have proper ARIA labels', () => {
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('placeholder', 'name@company.com')
    })

    it('should have proper button states', () => {
      render(<ResetPasswordForm />)

      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })
      expect(submitButton).not.toBeDisabled()
    })

    it('should have proper form validation feedback', async () => {
      const user = userEvent.setup()
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'invalid-email')
      await user.click(submitButton)

      // Form should not submit with invalid email
      expect(mockResetPassword).not.toHaveBeenCalled()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This should compile without TypeScript errors
      render(<ResetPasswordForm />)

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })

    it('should handle form data with correct types', async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValue({ success: true })
      render(<ResetPasswordForm />)

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', {
        name: 'Send reset link',
      })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith(expect.any(FormData))
      })
    })
  })
})

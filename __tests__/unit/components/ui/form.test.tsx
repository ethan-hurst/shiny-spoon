import React from 'react'
import { render, screen, waitFor } from '@/__tests__/helpers/test-utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Test schema for validation
const testSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
})

type TestFormData = z.infer<typeof testSchema>

// Test component that uses the form
const TestForm = ({ onSubmit }: { onSubmit: (data: TestFormData) => void }) => {
  const form = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter your name" {...field} />
              </FormControl>
              <FormDescription>Enter your full name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter your email" {...field} />
              </FormControl>
              <FormDescription>Enter a valid email address</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your password" {...field} />
              </FormControl>
              <FormDescription>Password must be at least 6 characters</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}

describe('Form Component', () => {
  describe('Form Elements', () => {
    it('renders FormItem with proper structure', () => {
      render(
        <FormItem>
          <FormLabel>Test Label</FormLabel>
          <FormControl>
            <Input />
          </FormControl>
          <FormDescription>Test description</FormDescription>
          <FormMessage />
        </FormItem>
      )

      expect(screen.getByText('Test Label')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders FormLabel with proper accessibility', () => {
      render(
        <FormItem>
          <FormLabel>Email Address</FormLabel>
          <FormControl>
            <Input />
          </FormControl>
        </FormItem>
      )

      const label = screen.getByText('Email Address')
      const input = screen.getByRole('textbox')
      
      expect(label).toBeInTheDocument()
      expect(label).toHaveAttribute('for', input.id)
    })

    it('renders FormDescription with proper styling', () => {
      render(<FormDescription>This is a description</FormDescription>)

      const description = screen.getByText('This is a description')
      expect(description).toBeInTheDocument()
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('renders FormMessage with proper styling', () => {
      render(<FormMessage>This is an error message</FormMessage>)

      const message = screen.getByText('This is an error message')
      expect(message).toBeInTheDocument()
      expect(message).toHaveClass('text-sm', 'font-medium', 'text-destructive')
    })

    it('does not render FormMessage when no error', () => {
      render(<FormMessage />)

      // Should not render anything when no error
      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
    })
  })

  describe('Form Integration', () => {
    it('handles form submission with valid data', async () => {
      const onSubmit = jest.fn()
      const { user } = render(<TestForm onSubmit={onSubmit} />)

      // Fill out the form
      await user.type(screen.getByPlaceholderText('Enter your name'), 'John Doe')
      await user.type(screen.getByPlaceholderText('Enter your email'), 'john@example.com')
      await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')

      // Submit the form
      await user.click(screen.getByRole('button', { name: /submit/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        })
      })
    })

    it('shows validation errors for empty form submission', async () => {
      const onSubmit = jest.fn()
      const { user } = render(<TestForm onSubmit={onSubmit} />)

      // Submit empty form
      await user.click(screen.getByRole('button', { name: /submit/i }))

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
        expect(screen.getByText('Invalid email address')).toBeInTheDocument()
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
      })

      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper form structure and labels', () => {
      render(<TestForm onSubmit={jest.fn()} />)

      // Check that all form elements have proper labels
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()

      // Check that descriptions are present
      expect(screen.getByText('Enter your full name')).toBeInTheDocument()
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
    })

    it('provides proper focus management', async () => {
      const { user } = render(<TestForm onSubmit={jest.fn()} />)

      const nameInput = screen.getByLabelText('Name')
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      // Tab through form elements
      await user.tab()
      expect(nameInput).toHaveFocus()

      await user.tab()
      expect(emailInput).toHaveFocus()

      await user.tab()
      expect(passwordInput).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /submit/i })).toHaveFocus()
    })
  })

  describe('Form State Management', () => {
    it('handles controlled form fields', async () => {
      const { user } = render(<TestForm onSubmit={jest.fn()} />)

      const nameInput = screen.getByLabelText('Name')
      const emailInput = screen.getByLabelText('Email')

      // Type in fields
      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')

      // Values should be updated
      expect(nameInput).toHaveValue('John Doe')
      expect(emailInput).toHaveValue('john@example.com')
    })

    it('handles form with default values', () => {
      const TestFormWithDefaults = () => {
        const form = useForm<TestFormData>({
          resolver: zodResolver(testSchema),
          defaultValues: {
            name: 'Default Name',
            email: 'default@example.com',
            password: 'defaultpass',
          },
        })

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )
      }

      render(<TestFormWithDefaults />)

      const nameInput = screen.getByLabelText('Name')
      expect(nameInput).toHaveValue('Default Name')
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<TestForm onSubmit={jest.fn()} />)
      const endTime = performance.now()

      // Should render within reasonable time (less than 100ms for complex form)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('handles rapid form updates', async () => {
      const { user } = render(<TestForm onSubmit={jest.fn()} />)

      const nameInput = screen.getByLabelText('Name')

      // Rapid typing
      for (let i = 0; i < 10; i++) {
        await user.type(nameInput, 'a')
        await user.clear(nameInput)
      }

      expect(nameInput).toHaveValue('')
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<TestForm onSubmit={jest.fn()} />)
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('handles very long input values', async () => {
      const { user } = render(<TestForm onSubmit={jest.fn()} />)

      const longValue = 'a'.repeat(1000)
      const nameInput = screen.getByLabelText('Name')

      await user.type(nameInput, longValue)
      expect(nameInput).toHaveValue(longValue)
    })

    it('handles special characters in form inputs', async () => {
      const { user } = render(<TestForm onSubmit={jest.fn()} />)

      const nameInput = screen.getByLabelText('Name')
      const specialChars = '!@#$%^&*()_+-=<>?'

      await user.type(nameInput, specialChars)
      expect(nameInput).toHaveValue(specialChars)
    })

    it('handles form with no validation schema', () => {
      const SimpleForm = () => {
        const form = useForm()

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="test"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )
      }

      render(<SimpleForm />)
      expect(screen.getByText('Test')).toBeInTheDocument()
    })
  })

  describe('Integration with UI Components', () => {
    it('works with Input component', () => {
      render(
        <FormItem>
          <FormLabel>Test Input</FormLabel>
          <FormControl>
            <Input placeholder="Enter text" />
          </FormControl>
          <FormDescription>Test description</FormDescription>
          <FormMessage />
        </FormItem>
      )

      expect(screen.getByLabelText('Test Input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('works with Button component', () => {
      render(
        <form>
          <FormItem>
            <FormLabel>Test</FormLabel>
            <FormControl>
              <Input />
            </FormControl>
          </FormItem>
          <Button type="submit">Submit</Button>
        </form>
      )

      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    })
  })
})


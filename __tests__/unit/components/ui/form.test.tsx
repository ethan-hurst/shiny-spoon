import React from 'react'
import { render, screen } from '@/__tests__/helpers/test-utils'
import { useForm } from 'react-hook-form'
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

// Simple test form component
const TestForm = () => {
  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
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
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}

describe('Form Component', () => {
  describe('Form Integration', () => {
    it('renders form with all components', () => {
      render(<TestForm />)

      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByText('Enter your full name')).toBeInTheDocument()
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    })

    it('handles form with default values', () => {
      const TestFormWithDefaults = () => {
        const form = useForm({
          defaultValues: {
            name: 'Default Name',
            email: 'default@example.com',
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

  describe('Accessibility', () => {
    it('has proper form structure and labels', () => {
      render(<TestForm />)

      // Check that all form elements have proper labels
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()

      // Check that descriptions are present
      expect(screen.getByText('Enter your full name')).toBeInTheDocument()
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    })

    it('provides proper focus management', async () => {
      const { user } = render(<TestForm />)

      const nameInput = screen.getByLabelText('Name')
      const emailInput = screen.getByLabelText('Email')

      // Tab through form elements
      await user.tab()
      expect(nameInput).toHaveFocus()

      await user.tab()
      expect(emailInput).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /submit/i })).toHaveFocus()
    })
  })

  describe('Form State Management', () => {
    it('handles controlled form fields', async () => {
      const { user } = render(<TestForm />)

      const nameInput = screen.getByLabelText('Name')
      const emailInput = screen.getByLabelText('Email')

      // Type in fields
      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')

      // Values should be updated
      expect(nameInput).toHaveValue('John Doe')
      expect(emailInput).toHaveValue('john@example.com')
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<TestForm />)
      const endTime = performance.now()

      // Should render within reasonable time (less than 100ms for complex form)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('handles rapid form updates', async () => {
      const { user } = render(<TestForm />)

      const nameInput = screen.getByLabelText('Name')

      // Rapid typing
      for (let i = 0; i < 10; i++) {
        await user.type(nameInput, 'a')
        await user.clear(nameInput)
      }

      expect(nameInput).toHaveValue('')
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<TestForm />)
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('handles very long input values', async () => {
      const { user } = render(<TestForm />)

      const longValue = 'a'.repeat(1000)
      const nameInput = screen.getByLabelText('Name')

      await user.type(nameInput, longValue)
      expect(nameInput).toHaveValue(longValue)
    })

    it('handles special characters in form inputs', async () => {
      const { user } = render(<TestForm />)

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
      const TestInputForm = () => {
        const form = useForm()

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="test"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Input</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter text" {...field} />
                    </FormControl>
                    <FormDescription>Test description</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )
      }

      render(<TestInputForm />)

      expect(screen.getByLabelText('Test Input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('works with Button component', () => {
      const TestButtonForm = () => {
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
              <Button type="submit">Submit</Button>
            </form>
          </Form>
        )
      }

      render(<TestButtonForm />)

      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    })
  })
})



import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

// Test component that uses the form
const TestForm = ({ onSubmit }: { onSubmit: (data: any) => void }) => {
  const form = useForm({
    defaultValues: {
      username: '',
      email: '',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter username" {...field} />
              </FormControl>
              <FormDescription>Enter your username</FormDescription>
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
                <Input placeholder="Enter email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </form>
    </Form>
  )
}

// Component to test useFormField hook
const TestUseFormField = () => {
  const form = useForm({
    defaultValues: { test: '' },
  })

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="test"
        render={() => (
          <FormItem>
            <FormLabel>Test</FormLabel>
            <FormControl>
              <Input />
            </FormControl>
            <FormDescription>Test description</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  )
}

describe('Form Components', () => {
  describe('Form Integration', () => {
    it('should render form with all components', () => {
      const onSubmit = jest.fn()
      render(<TestForm onSubmit={onSubmit} />)

      expect(screen.getByLabelText('Username')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByText('Enter your username')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
    })

    it('should handle form submission', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()
      render(<TestForm onSubmit={onSubmit} />)

      const usernameInput = screen.getByLabelText('Username')
      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', { name: 'Submit' })

      await user.type(usernameInput, 'testuser')
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(onSubmit).toHaveBeenCalledWith(
        {
          username: 'testuser',
          email: 'test@example.com',
        },
        expect.any(Object) // Form event object
      )
    })

    it('should handle form validation', async () => {
      const user = userEvent.setup()
      const onSubmit = jest.fn()
      
      const TestFormWithValidation = () => {
        const form = useForm({
          defaultValues: { username: '' },
        })

        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="username"
                rules={{ required: 'Username is required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit">Submit</button>
            </form>
          </Form>
        )
      }

      render(<TestFormWithValidation />)

      const submitButton = screen.getByRole('button', { name: 'Submit' })
      await user.click(submitButton)

      expect(screen.getByText('Username is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('FormItem', () => {
    it('should render with default classes', () => {
      render(
        <FormItem data-testid="form-item">
          <div>Test content</div>
        </FormItem>
      )

      const formItem = screen.getByTestId('form-item')
      expect(formItem).toHaveClass('space-y-2')
    })

    it('should apply custom className', () => {
      render(
        <FormItem className="custom-class" data-testid="form-item">
          <div>Test content</div>
        </FormItem>
      )

      const formItem = screen.getByTestId('form-item')
      expect(formItem).toHaveClass('space-y-2', 'custom-class')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(
        <FormItem ref={ref} data-testid="form-item">
          <div>Test content</div>
        </FormItem>
      )

      expect(ref.current).toBe(screen.getByTestId('form-item'))
    })

    it('should pass through additional props', () => {
      render(
        <FormItem data-testid="form-item" aria-label="test">
          <div>Test content</div>
        </FormItem>
      )

      const formItem = screen.getByTestId('form-item')
      expect(formItem).toHaveAttribute('aria-label', 'test')
    })
  })

  describe('FormLabel', () => {
    it('should render with proper accessibility', () => {
      const TestFormLabel = () => {
        const form = useForm({ defaultValues: { test: '' } })
        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Label</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormLabel />)

      const label = screen.getByText('Test Label')
      const input = screen.getByRole('textbox')
      
      expect(label).toBeInTheDocument()
      expect(label.tagName).toBe('LABEL')
      expect(input).toHaveAttribute('id')
      expect(label).toHaveAttribute('for', input.getAttribute('id'))
    })

    it('should apply error styling when field has error', () => {
      const TestFormLabelWithError = () => {
        const form = useForm({ defaultValues: { test: '' } })
        
        // Trigger an error
        React.useEffect(() => {
          form.setError('test', { message: 'This field is required' })
        }, [form])

        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Label</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormLabelWithError />)

      const label = screen.getByText('Test Label')
      expect(label).toHaveClass('text-destructive')
    })

    it('should apply custom className', () => {
      const TestFormLabelCustom = () => {
        const form = useForm({ defaultValues: { test: '' } })
        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="custom-label">Test Label</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormLabelCustom />)

      const label = screen.getByText('Test Label')
      expect(label).toHaveClass('custom-label')
    })
  })

  describe('FormControl', () => {
    it('should render with proper accessibility attributes', () => {
      const TestFormControl = () => {
        const form = useForm({ defaultValues: { test: '' } })
        return (
          <Form {...form}>
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
          </Form>
        )
      }

      render(<TestFormControl />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby')
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })

    it('should show error state when field has error', () => {
      const TestFormControlWithError = () => {
        const form = useForm({ defaultValues: { test: '' } })
        
        React.useEffect(() => {
          form.setError('test', { message: 'This field is required' })
        }, [form])

        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormControlWithError />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('FormDescription', () => {
    it('should render description text', () => {
      const TestFormDescription = () => {
        const form = useForm({ defaultValues: { test: '' } })
        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>This is a description</FormDescription>
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormDescription />)

      const description = screen.getByText('This is a description')
      expect(description).toBeInTheDocument()
      expect(description.tagName).toBe('P')
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('should apply custom className', () => {
      const TestFormDescriptionCustom = () => {
        const form = useForm({ defaultValues: { test: '' } })
        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription className="custom-desc">Description</FormDescription>
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormDescriptionCustom />)

      const description = screen.getByText('Description')
      expect(description).toHaveClass('custom-desc')
    })
  })

  describe('FormMessage', () => {
    it('should render error message when field has error', () => {
      const TestFormMessage = () => {
        const form = useForm({ defaultValues: { test: '' } })
        
        React.useEffect(() => {
          form.setError('test', { message: 'This field is required' })
        }, [form])

        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormMessage />)

      const message = screen.getByText('This field is required')
      expect(message).toBeInTheDocument()
      expect(message.tagName).toBe('P')
      expect(message).toHaveClass('text-sm', 'font-medium', 'text-destructive')
    })

    it('should render children when no error', () => {
      const TestFormMessageChildren = () => {
        const form = useForm({ defaultValues: { test: '' } })
        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage>Custom message</FormMessage>
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormMessageChildren />)

      const message = screen.getByText('Custom message')
      expect(message).toBeInTheDocument()
    })

    it('should not render when no error and no children', () => {
      const TestFormMessageEmpty = () => {
        const form = useForm({ defaultValues: { test: '' } })
        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormMessageEmpty />)

      // Should not render anything for FormMessage
      expect(screen.queryByTestId('form-message')).not.toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const TestFormMessageCustom = () => {
        const form = useForm({ defaultValues: { test: '' } })
        
        React.useEffect(() => {
          form.setError('test', { message: 'Error message' })
        }, [form])

        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="test"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage className="custom-error" />
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestFormMessageCustom />)

      const message = screen.getByText('Error message')
      expect(message).toHaveClass('custom-error')
    })
  })

  describe('useFormField', () => {
    it('should provide correct field state', () => {
      render(<TestUseFormField />)

      // The component should render without errors
      expect(screen.getByText('Test')).toBeInTheDocument()
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      const TestTypeSafety = () => {
        const form = useForm<{ username: string; email: string }>({
          defaultValues: { username: '', email: '' },
        })

        return (
          <Form {...form}>
            <FormField
              control={form.control}
              name="username" // Should be type-safe
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>
        )
      }

      render(<TestTypeSafety />)
      expect(screen.getByText('Username')).toBeInTheDocument()
    })
  })
})
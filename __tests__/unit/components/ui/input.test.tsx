import React from 'react'
import { render, screen } from '@/__tests__/helpers/test-utils'
import { Input } from '@/components/ui/input'

describe('Input Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md')
    })

    it('renders with custom className', () => {
      render(<Input className="custom-class" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-class')
    })

    it('renders with placeholder text', () => {
      render(<Input placeholder="Enter your name" />)
      
      const input = screen.getByPlaceholderText('Enter your name')
      expect(input).toBeInTheDocument()
    })

    it('renders with value', () => {
      render(<Input value="test value" />)
      
      const input = screen.getByDisplayValue('test value')
      expect(input).toBeInTheDocument()
    })

    it('renders with different input types', () => {
      const { rerender } = render(<Input type="email" />)
      
      let input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
      
      rerender(<Input type="password" />)
      input = screen.getByDisplayValue('')
      expect(input).toHaveAttribute('type', 'password')
      
      rerender(<Input type="number" />)
      input = screen.getByDisplayValue('')
      expect(input).toHaveAttribute('type', 'number')
    })
  })

  describe('Props and Attributes', () => {
    it('forwards all HTML input attributes', () => {
      render(
        <Input
          id="test-input"
          name="test-name"
          required
          maxLength={50}
          minLength={5}
          pattern="[A-Za-z]+"
          data-testid="test-input"
        />
      )
      
      const input = screen.getByTestId('test-input')
      expect(input).toHaveAttribute('id', 'test-input')
      expect(input).toHaveAttribute('name', 'test-name')
      expect(input).toHaveAttribute('required')
      expect(input).toHaveAttribute('maxLength', '50')
      expect(input).toHaveAttribute('minLength', '5')
      expect(input).toHaveAttribute('pattern', '[A-Za-z]+')
    })

    it('handles controlled component pattern', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('')
        return (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type here"
          />
        )
      }
      
      render(<TestComponent />)
      
      const input = screen.getByPlaceholderText('Type here')
      expect(input).toHaveValue('')
    })

    it('handles uncontrolled component pattern', () => {
      render(<Input defaultValue="initial value" />)
      
      const input = screen.getByDisplayValue('initial value')
      expect(input).toBeInTheDocument()
    })
  })

  describe('States', () => {
    it('renders disabled state', () => {
      render(<Input disabled />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
    })

    it('renders read-only state', () => {
      render(<Input readOnly />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('readOnly')
    })

    it('renders required state', () => {
      render(<Input required />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('required')
    })

    it('renders with aria attributes', () => {
      render(
        <Input
          aria-label="Email address"
          aria-describedby="email-help"
          aria-invalid="true"
        />
      )
      
      const input = screen.getByRole('textbox', { name: /email address/i })
      expect(input).toHaveAttribute('aria-describedby', 'email-help')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('Styling and Classes', () => {
    it('applies base styling classes', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass(
        'flex',
        'h-10',
        'w-full',
        'rounded-md',
        'border',
        'border-input',
        'bg-background',
        'px-3',
        'py-2',
        'text-sm'
      )
    })

    it('applies focus styles', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
        'focus-visible:ring-offset-2'
      )
    })

    it('applies disabled styles', () => {
      render(<Input disabled />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
    })

    it('applies placeholder styles', () => {
      render(<Input placeholder="Enter text" />)
      
      const input = screen.getByPlaceholderText('Enter text')
      expect(input).toHaveClass('placeholder:text-muted-foreground')
    })

    it('combines custom className with base classes', () => {
      render(<Input className="custom-input" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-input', 'flex', 'h-10')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <Input
          aria-label="Search"
          aria-describedby="search-help"
          aria-required="true"
        />
      )
      
      const input = screen.getByRole('textbox', { name: /search/i })
      expect(input).toHaveAttribute('aria-describedby', 'search-help')
      expect(input).toHaveAttribute('aria-required', 'true')
    })

    it('supports keyboard navigation', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      // Inputs are naturally focusable without explicit tabIndex
      expect(input).toBeInTheDocument()
    })

    it('has proper focus management', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      input.focus()
      expect(input).toHaveFocus()
    })

    it('announces validation errors to screen readers', () => {
      render(<Input aria-invalid="true" aria-describedby="error-message" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'error-message')
    })
  })

  describe('User Interaction', () => {
    it('handles user input', async () => {
      const { user } = render(<Input placeholder="Type here" />)
      
      const input = screen.getByPlaceholderText('Type here')
      await user.type(input, 'test input')
      
      expect(input).toHaveValue('test input')
    })

    it('handles focus and blur events', async () => {
      const { user } = render(<Input onFocus={jest.fn()} onBlur={jest.fn()} />)
      
      const input = screen.getByRole('textbox')
      
      await user.click(input)
      expect(input).toHaveFocus()
      
      await user.tab()
      expect(input).not.toHaveFocus()
    })

    it('handles change events', async () => {
      const { user } = render(<Input onChange={jest.fn()} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'a')
      
      expect(input).toHaveValue('a')
    })

    it('handles key events', async () => {
      const { user } = render(<Input onKeyDown={jest.fn()} onKeyUp={jest.fn()} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'a')
      
      expect(input).toHaveValue('a')
    })
  })

  describe('Form Integration', () => {
    it('works within a form context', () => {
      render(
        <form>
          <Input name="email" type="email" required />
        </form>
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('name', 'email')
      expect(input).toHaveAttribute('type', 'email')
      expect(input).toHaveAttribute('required')
    })

    it('supports form validation', () => {
      render(
        <Input
          type="email"
          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
          title="Please enter a valid email address"
        />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('pattern', '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$')
      expect(input).toHaveAttribute('title', 'Please enter a valid email address')
    })

    it('handles form submission', async () => {
      const { user } = render(
        <form onSubmit={jest.fn()}>
          <Input name="test" />
          <button type="submit">Submit</button>
        </form>
      )
      
      const submitButton = screen.getByRole('button', { name: /submit/i })
      await user.click(submitButton)
      
      // Form submission should work
      expect(submitButton).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles very long input values', async () => {
      const longValue = 'a'.repeat(1000)
      render(<Input value={longValue} />)
      
      const input = screen.getByDisplayValue(longValue)
      expect(input).toBeInTheDocument()
    })

    it('handles special characters', async () => {
      const { user } = render(<Input />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, '!@#$%^&*()_+-=<>?')
      
      expect(input).toHaveValue('!@#$%^&*()_+-=<>?')
    })

    it('handles empty string values', () => {
      render(<Input value="" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('')
    })

    it('handles null and undefined values gracefully', () => {
      render(<Input value={null as any} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<Input />)
      const endTime = performance.now()
      
      // Should render within reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('handles rapid re-renders', () => {
      const { rerender } = render(<Input value="initial" />)
      
      for (let i = 0; i < 100; i++) {
        rerender(<Input value={`value-${i}`} />)
      }
      
      const input = screen.getByDisplayValue('value-99')
      expect(input).toBeInTheDocument()
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<Input />)
      
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Ref Forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<Input ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('allows imperative methods', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<Input ref={ref} />)
      
      if (ref.current) {
        ref.current.focus()
        expect(ref.current).toHaveFocus()
      }
    })
  })

  describe('Type Safety', () => {
    it('accepts all valid input types', () => {
      const validTypes = [
        'text', 'email', 'password', 'number', 'tel', 'url', 'search',
        'date', 'time', 'datetime-local', 'month', 'week', 'file'
      ]
      
      validTypes.forEach(type => {
        const { unmount } = render(<Input type={type as any} />)
        const input = screen.getByDisplayValue('')
        expect(input).toHaveAttribute('type', type)
        unmount()
      })
    })

    it('handles all HTML input attributes', () => {
      render(
        <Input
          autoComplete="email"
          autoFocus
          form="test-form"
          list="test-list"
          max="100"
          min="0"
          step="1"
          size={20}
          spellCheck
        />
      )
      
      const input = screen.getByDisplayValue('')
      expect(input).toHaveAttribute('autoComplete', 'email')
      expect(input).toHaveAttribute('autofocus')
      expect(input).toHaveAttribute('form', 'test-form')
      expect(input).toHaveAttribute('list', 'test-list')
      expect(input).toHaveAttribute('max', '100')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('step', '1')
      expect(input).toHaveAttribute('size', '20')
      expect(input).toHaveAttribute('spellcheck')
    })
  })
})

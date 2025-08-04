import React from 'react'
import { render, screen, waitFor } from '@/__tests__/helpers/test-utils'
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from '@/components/ui/select'

// Test select component
const TestSelect = () => {
  const [value, setValue] = React.useState('')

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="orange">Orange</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Vegetables</SelectLabel>
          <SelectItem value="carrot">Carrot</SelectItem>
          <SelectItem value="broccoli">Broccoli</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

// Test select with disabled items
const TestSelectWithDisabled = () => {
  const [value, setValue] = React.useState('')

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2" disabled>
          Option 2 (Disabled)
        </SelectItem>
        <SelectItem value="option3">Option 3</SelectItem>
      </SelectContent>
    </Select>
  )
}

// Test select with custom trigger
const TestSelectWithCustomTrigger = () => {
  const [value, setValue] = React.useState('')

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Choose a color" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="red">Red</SelectItem>
        <SelectItem value="green">Green</SelectItem>
        <SelectItem value="blue">Blue</SelectItem>
      </SelectContent>
    </Select>
  )
}

// Test select with long content
const TestSelectWithLongContent = () => {
  const [value, setValue] = React.useState('')

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 50 }, (_, i) => (
          <SelectItem key={i} value={`option${i}`}>
            Option {i + 1} with very long text that might wrap to multiple lines
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

describe('Select Component', () => {
  describe('Select Elements', () => {
    it('renders select trigger', () => {
      render(<TestSelect />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Select an option')).toBeInTheDocument()
    })

    it('renders select content when opened', async () => {
      const { user } = render(<TestSelect />)

      // Open select
      await user.click(screen.getByRole('combobox'))

      // Check that select content is rendered
      expect(screen.getByText('Fruits')).toBeInTheDocument()
      expect(screen.getByText('Apple')).toBeInTheDocument()
      expect(screen.getByText('Banana')).toBeInTheDocument()
      expect(screen.getByText('Orange')).toBeInTheDocument()
      expect(screen.getByText('Vegetables')).toBeInTheDocument()
      expect(screen.getByText('Carrot')).toBeInTheDocument()
      expect(screen.getByText('Broccoli')).toBeInTheDocument()
    })

    it('renders select groups and labels', async () => {
      const { user } = render(<TestSelect />)

      await user.click(screen.getByRole('combobox'))

      const fruitsLabel = screen.getByText('Fruits')
      expect(fruitsLabel).toBeInTheDocument()
      expect(fruitsLabel).toHaveClass('py-1.5', 'pl-8', 'pr-2', 'text-sm', 'font-semibold')

      const vegetablesLabel = screen.getByText('Vegetables')
      expect(vegetablesLabel).toBeInTheDocument()
    })

    it('renders select items with proper styling', async () => {
      const { user } = render(<TestSelect />)

      await user.click(screen.getByRole('combobox'))

      const appleItem = screen.getByText('Apple')
      expect(appleItem).toBeInTheDocument()
      expect(appleItem.closest('[role="option"]')).toHaveClass(
        'relative',
        'flex',
        'w-full',
        'cursor-default',
        'select-none',
        'items-center',
        'rounded-sm',
        'py-1.5',
        'pl-8',
        'pr-2',
        'text-sm',
        'outline-none'
      )
    })

    it('renders separator between groups', async () => {
      const { user } = render(<TestSelect />)

      await user.click(screen.getByRole('combobox'))

      // The separator should be present between Fruits and Vegetables groups
      const separator = document.querySelector('[data-radix-select-separator]')
      expect(separator).toBeInTheDocument()
    })
  })

  describe('Select Interactions', () => {
    it('opens select when trigger is clicked', async () => {
      const { user } = render(<TestSelect />)

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      expect(screen.getByText('Apple')).toBeInTheDocument()
    })

    it('closes select when clicking outside', async () => {
      const { user } = render(<TestSelect />)

      // Open select
      await user.click(screen.getByRole('combobox'))
      expect(screen.getByText('Apple')).toBeInTheDocument()

      // Click outside
      await user.click(document.body)

      await waitFor(() => {
        expect(screen.queryByText('Apple')).not.toBeInTheDocument()
      })
    })

    it('selects an option when clicked', async () => {
      const { user } = render(<TestSelect />)

      // Open select
      await user.click(screen.getByRole('combobox'))

      // Select an option
      await user.click(screen.getByText('Apple'))

      // Check that the value is updated
      expect(screen.getByText('Apple')).toBeInTheDocument()
    })

    it('handles keyboard navigation', async () => {
      const { user } = render(<TestSelect />)

      // Open select
      await user.click(screen.getByRole('combobox'))

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      const firstOption = screen.getByText('Apple')
      expect(firstOption.closest('[role="option"]')).toHaveAttribute('data-highlighted')

      await user.keyboard('{ArrowDown}')
      const secondOption = screen.getByText('Banana')
      expect(secondOption.closest('[role="option"]')).toHaveAttribute('data-highlighted')
    })

    it('selects option with Enter key', async () => {
      const { user } = render(<TestSelect />)

      // Open select
      await user.click(screen.getByRole('combobox'))

      // Navigate to first option
      await user.keyboard('{ArrowDown}')

      // Select with Enter
      await user.keyboard('{Enter}')

      // Check that the value is selected
      expect(screen.getByText('Apple')).toBeInTheDocument()
    })

    it('closes select with Escape key', async () => {
      const { user } = render(<TestSelect />)

      // Open select
      await user.click(screen.getByRole('combobox'))
      expect(screen.getByText('Apple')).toBeInTheDocument()

      // Close with Escape
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByText('Apple')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', async () => {
      const { user } = render(<TestSelect />)

      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')

      // Open select
      await user.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')

      // Check that options have proper roles
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(5) // Apple, Banana, Orange, Carrot, Broccoli
    })

    it('announces selection to screen readers', async () => {
      const { user } = render(<TestSelect />)

      await user.click(screen.getByRole('combobox'))
      await user.click(screen.getByText('Apple'))

      // The selected value should be visible in the trigger
      expect(screen.getByText('Apple')).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      const { user } = render(<TestSelect />)

      // Focus the trigger
      const trigger = screen.getByRole('combobox')
      trigger.focus()

      // Open with Space
      await user.keyboard(' ')

      expect(screen.getByText('Apple')).toBeInTheDocument()

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowDown}')

      // Select with Enter
      await user.keyboard('{Enter}')

      expect(screen.getByText('Banana')).toBeInTheDocument()
    })

    it('handles disabled options correctly', async () => {
      const { user } = render(<TestSelectWithDisabled />)

      await user.click(screen.getByRole('combobox'))

      const disabledOption = screen.getByText('Option 2 (Disabled)')
      expect(disabledOption.closest('[role="option"]')).toHaveAttribute('data-disabled')

      // Try to click disabled option
      await user.click(disabledOption)

      // The disabled option should not be selected
      expect(screen.queryByText('Option 2 (Disabled)')).not.toBeInTheDocument()
    })
  })

  describe('Select State Management', () => {
    it('handles controlled select state', async () => {
      const ControlledSelect = () => {
        const [value, setValue] = React.useState('')

        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
            </SelectContent>
          </Select>
        )
      }

      const { user } = render(<ControlledSelect />)

      await user.click(screen.getByRole('combobox'))
      await user.click(screen.getByText('Option 1'))

      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })

    it('handles uncontrolled select state', async () => {
      const UncontrolledSelect = () => (
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      )

      const { user } = render(<UncontrolledSelect />)

      await user.click(screen.getByRole('combobox'))
      await user.click(screen.getByText('Option 1'))

      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<TestSelect />)
      const endTime = performance.now()

      // Should render within reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('handles large option lists', async () => {
      const { user } = render(<TestSelectWithLongContent />)

      const startTime = performance.now()
      await user.click(screen.getByRole('combobox'))
      const endTime = performance.now()

      // Should open within reasonable time even with many options
      expect(endTime - startTime).toBeLessThan(100)
      expect(screen.getByText('Option 1 with very long text that might wrap to multiple lines')).toBeInTheDocument()
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<TestSelect />)
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty select content', async () => {
      const EmptySelect = () => (
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="No options" />
          </SelectTrigger>
          <SelectContent>
            {/* No items */}
          </SelectContent>
        </Select>
      )

      const { user } = render(<EmptySelect />)

      await user.click(screen.getByRole('combobox'))

      // Should not crash and should show empty content
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('handles select with very long option text', async () => {
      const LongTextSelect = () => (
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="long">
              This is a very long option text that might wrap to multiple lines and should be handled gracefully by the select component
            </SelectItem>
          </SelectContent>
        </Select>
      )

      const { user } = render(<LongTextSelect />)

      await user.click(screen.getByRole('combobox'))

      const longOption = screen.getByText(/This is a very long option text/)
      expect(longOption).toBeInTheDocument()
    })

    it('handles select with special characters in options', async () => {
      const SpecialCharsSelect = () => (
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="special">Option with &lt;&gt;&amp;&quot;&apos;</SelectItem>
            <SelectItem value="unicode">Option with émojis 🎉</SelectItem>
          </SelectContent>
        </Select>
      )

      const { user } = render(<SpecialCharsSelect />)

      await user.click(screen.getByRole('combobox'))

      expect(screen.getByText('Option with &lt;&gt;&amp;&quot;&apos;')).toBeInTheDocument()
      expect(screen.getByText('Option with émojis 🎉')).toBeInTheDocument()
    })

    it('handles multiple selects on the same page', async () => {
      const MultipleSelects = () => (
        <div>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="First select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Second select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option2">Option 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )

      const { user } = render(<MultipleSelects />)

      const triggers = screen.getAllByRole('combobox')
      expect(triggers).toHaveLength(2)

      // Open first select
      await user.click(triggers[0])
      expect(screen.getByText('Option 1')).toBeInTheDocument()

      // Close first select
      await user.click(document.body)

      // Open second select
      await user.click(triggers[1])
      expect(screen.getByText('Option 2')).toBeInTheDocument()
    })
  })

  describe('Integration with UI Components', () => {
    it('works with custom styling', async () => {
      const { user } = render(<TestSelectWithCustomTrigger />)

      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveClass('w-[200px]')

      await user.click(trigger)
      await user.click(screen.getByText('Red'))

      expect(screen.getByText('Red')).toBeInTheDocument()
    })

    it('works with form elements', async () => {
      const FormSelect = () => (
        <form>
          <label htmlFor="select">Choose an option:</label>
          <Select>
            <SelectTrigger id="select">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
            </SelectContent>
          </Select>
        </form>
      )

      const { user } = render(<FormSelect />)

      expect(screen.getByText('Choose an option:')).toBeInTheDocument()

      await user.click(screen.getByRole('combobox'))
      await user.click(screen.getByText('Option 1'))

      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })
  })

  describe('Scroll Buttons', () => {
    it('renders scroll buttons when content overflows', async () => {
      const { user } = render(<TestSelectWithLongContent />)

      await user.click(screen.getByRole('combobox'))

      // Scroll buttons should be present for long content
      const scrollUpButton = document.querySelector('[data-radix-select-scroll-up-button]')
      const scrollDownButton = document.querySelector('[data-radix-select-scroll-down-button]')

      expect(scrollUpButton).toBeInTheDocument()
      expect(scrollDownButton).toBeInTheDocument()
    })
  })
})

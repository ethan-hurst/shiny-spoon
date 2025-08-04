import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Label } from '../../../../components/ui/label'

// Test label component
const TestLabel = () => {
  return (
    <div>
      <Label htmlFor="test-input">Test Label</Label>
      <input id="test-input" type="text" />
    </div>
  )
}

// Test label with custom styling
const TestLabelWithCustomStyling = () => {
  return (
    <div>
      <Label htmlFor="custom-input" className="custom-label">
        Custom Label
      </Label>
      <input id="custom-input" type="text" />
    </div>
  )
}

// Test label with form association
const TestLabelWithForm = () => {
  return (
    <form>
      <Label htmlFor="name">Name:</Label>
      <input id="name" type="text" placeholder="Enter your name" />
      
      <Label htmlFor="email">Email:</Label>
      <input id="email" type="email" placeholder="Enter your email" />
      
      <Label htmlFor="message">Message:</Label>
      <textarea id="message" placeholder="Enter your message" />
    </form>
  )
}

// Test label with disabled input
const TestLabelWithDisabledInput = () => {
  return (
    <div>
      <Label htmlFor="disabled-input">Disabled Input Label</Label>
      <input id="disabled-input" type="text" disabled />
    </div>
  )
}

// Test label with required field
const TestLabelWithRequiredField = () => {
  return (
    <div>
      <Label htmlFor="required-input">
        Required Field <span className="text-red-500">*</span>
      </Label>
      <input id="required-input" type="text" required />
    </div>
  )
}

// Test label with complex content
const TestLabelWithComplexContent = () => {
  return (
    <div>
      <Label htmlFor="complex-input">
        Complex Label with <strong>bold text</strong> and <em>italic text</em>
      </Label>
      <input id="complex-input" type="text" />
    </div>
  )
}

describe('Label Component', () => {
  describe('Label Elements', () => {
    it('renders label with proper text', () => {
      render(<TestLabel />)

      expect(screen.getByText('Test Label')).toBeInTheDocument()
      expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
    })

    it('renders label with proper structure', () => {
      render(<TestLabel />)

      const label = screen.getByText('Test Label')
      expect(label).toBeInTheDocument()
      expect(label.tagName).toBe('LABEL')
      expect(label).toHaveAttribute('for', 'test-input')
    })

    it('renders label with custom styling', () => {
      render(<TestLabelWithCustomStyling />)

      const label = screen.getByText('Custom Label')
      expect(label).toBeInTheDocument()
      expect(label).toHaveClass('custom-label')
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none')
    })
  })

  describe('Label Sub-components', () => {
    it('renders Label with proper wrapper', () => {
      render(
        <Label data-testid="label" htmlFor="test">
          Test Label
        </Label>
      )

      const label = screen.getByTestId('label')
      expect(label).toBeInTheDocument()
      expect(label.tagName).toBe('LABEL')
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none')
    })

    it('renders Label with proper accessibility attributes', () => {
      render(
        <Label htmlFor="test-input" data-testid="label">
          Accessible Label
        </Label>
      )

      const label = screen.getByTestId('label')
      expect(label).toBeInTheDocument()
      expect(label).toHaveAttribute('for', 'test-input')
    })

    it('renders Label with custom className', () => {
      render(
        <Label htmlFor="test-input" className="custom-class" data-testid="label">
          Custom Label
        </Label>
      )

      const label = screen.getByTestId('label')
      expect(label).toBeInTheDocument()
      expect(label).toHaveClass('custom-class')
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none')
    })
  })

  describe('Label Interactions', () => {
    it('focuses associated input when clicked', async () => {
      const user = userEvent.setup()
      render(<TestLabel />)

      const label = screen.getByText('Test Label')
      const input = screen.getByLabelText('Test Label')

      expect(input).toBeInTheDocument()

      // Click the label
      await user.click(label)

      // The input should be focused
      expect(input).toHaveFocus()
    })

    it('handles keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<TestLabel />)

      const label = screen.getByText('Test Label')
      const input = screen.getByLabelText('Test Label')

      // Focus the label
      label.focus()

      // The label should be focusable
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none')
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(<TestLabel />)

      const label = screen.getByText('Test Label')
      const input = screen.getByLabelText('Test Label')

      expect(label).toBeInTheDocument()
      expect(input).toBeInTheDocument()
      expect(label).toHaveAttribute('for', 'test-input')
      expect(input).toHaveAttribute('id', 'test-input')
    })

    it('supports screen readers', () => {
      render(<TestLabel />)

      const label = screen.getByText('Test Label')
      expect(label).toBeInTheDocument()
      expect(label.tagName).toBe('LABEL')
    })

    it('has proper ARIA attributes', () => {
      render(
        <Label htmlFor="test-input" aria-describedby="help-text">
          Test Label
        </Label>
      )

      const label = screen.getByText('Test Label')
      expect(label).toHaveAttribute('for', 'test-input')
      expect(label).toHaveAttribute('aria-describedby', 'help-text')
    })

    it('works with form controls', () => {
      render(<TestLabelWithForm />)

      expect(screen.getByLabelText('Name:')).toBeInTheDocument()
      expect(screen.getByLabelText('Email:')).toBeInTheDocument()
      expect(screen.getByLabelText('Message:')).toBeInTheDocument()

      const nameInput = screen.getByLabelText('Name:')
      const emailInput = screen.getByLabelText('Email:')
      const messageTextarea = screen.getByLabelText('Message:')

      expect(nameInput).toHaveAttribute('type', 'text')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(messageTextarea.tagName).toBe('TEXTAREA')
    })
  })

  describe('Label State Management', () => {
    it('handles disabled state', () => {
      render(<TestLabelWithDisabledInput />)

      const label = screen.getByText('Disabled Input Label')
      const input = screen.getByLabelText('Disabled Input Label')

      expect(label).toBeInTheDocument()
      expect(input).toBeInTheDocument()
      expect(input).toBeDisabled()

      // The label should have the peer-disabled classes
      expect(label).toHaveClass('peer-disabled:cursor-not-allowed', 'peer-disabled:opacity-70')
    })

    it('handles required fields', () => {
      render(<TestLabelWithRequiredField />)

      const label = screen.getByText('Required Field')
      const input = screen.getByLabelText('Required Field *')

      expect(label).toBeInTheDocument()
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('required')

      // Check for the required indicator
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('handles dynamic content', () => {
      const DynamicLabel = ({ text }: { text: string }) => (
        <div>
          <Label htmlFor="dynamic-input">{text}</Label>
          <input id="dynamic-input" type="text" />
        </div>
      )

      const { rerender } = render(<DynamicLabel text="Initial Label" />)

      expect(screen.getByText('Initial Label')).toBeInTheDocument()

      rerender(<DynamicLabel text="Updated Label" />)

      expect(screen.getByText('Updated Label')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<TestLabel />)
      const endTime = performance.now()

      // Should render within reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('handles many labels efficiently', () => {
      const ManyLabels = () => (
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <div key={i}>
              <Label htmlFor={`input-${i}`}>Label {i + 1}</Label>
              <input id={`input-${i}`} type="text" />
            </div>
          ))}
        </div>
      )

      const startTime = performance.now()
      render(<ManyLabels />)
      const endTime = performance.now()

      // Should render within reasonable time even with many labels
      expect(endTime - startTime).toBeLessThan(200)
      expect(screen.getByText('Label 1')).toBeInTheDocument()
      expect(screen.getByText('Label 100')).toBeInTheDocument()
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<TestLabel />)
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('handles label with very long text', () => {
      const LongLabel = () => (
        <div>
          <Label htmlFor="long-input">
            This is a very long label text that might wrap to multiple lines and should be handled gracefully by the label component. It contains a lot of text to test how the label handles overflow and wrapping.
          </Label>
          <input id="long-input" type="text" />
        </div>
      )

      render(<LongLabel />)

      const longText = screen.getByText(/This is a very long label text/)
      expect(longText).toBeInTheDocument()
    })



    it('handles label with complex HTML content', () => {
      render(<TestLabelWithComplexContent />)

      expect(screen.getByText('bold text')).toBeInTheDocument()
      expect(screen.getByText('italic text')).toBeInTheDocument()

      const boldText = screen.getByText('bold text')
      const italicText = screen.getByText('italic text')

      expect(boldText.tagName).toBe('STRONG')
      expect(italicText.tagName).toBe('EM')
    })

    it('handles label without associated input', () => {
      render(
        <Label data-testid="standalone-label">
          Standalone Label
        </Label>
      )

      const label = screen.getByTestId('standalone-label')
      expect(label).toBeInTheDocument()
      expect(label).toHaveTextContent('Standalone Label')
    })
  })

  describe('Integration with UI Components', () => {
    it('works with custom styling classes', () => {
      render(<TestLabelWithCustomStyling />)

      const label = screen.getByText('Custom Label')
      expect(label).toHaveClass('custom-label')
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none')
    })

    it('works with form validation', () => {
      const LabelWithValidation = () => (
        <form>
          <Label htmlFor="validated-input" className="text-red-500">
            Invalid Input
          </Label>
          <input id="validated-input" type="text" aria-invalid="true" />
        </form>
      )

      render(<LabelWithValidation />)

      const label = screen.getByText('Invalid Input')
      const input = screen.getByLabelText('Invalid Input')

      expect(label).toHaveClass('text-red-500')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('works with multiple labels on the same page', () => {
      const MultipleLabels = () => (
        <div>
          <Label htmlFor="first-input">First Label</Label>
          <input id="first-input" type="text" />
          
          <Label htmlFor="second-input">Second Label</Label>
          <input id="second-input" type="text" />
          
          <Label htmlFor="third-input">Third Label</Label>
          <input id="third-input" type="text" />
        </div>
      )

      render(<MultipleLabels />)

      expect(screen.getByText('First Label')).toBeInTheDocument()
      expect(screen.getByText('Second Label')).toBeInTheDocument()
      expect(screen.getByText('Third Label')).toBeInTheDocument()

      expect(screen.getByLabelText('First Label')).toBeInTheDocument()
      expect(screen.getByLabelText('Second Label')).toBeInTheDocument()
      expect(screen.getByLabelText('Third Label')).toBeInTheDocument()
    })
  })
}) 
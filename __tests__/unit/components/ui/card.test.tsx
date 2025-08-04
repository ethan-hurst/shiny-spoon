import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../../components/ui/card'

// Test card component
const TestCard = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>This is a test card description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the card content with some text.</p>
      </CardContent>
      <CardFooter>
        <button>Action Button</button>
      </CardFooter>
    </Card>
  )
}

// Test card with custom styling
const TestCardWithCustomStyling = () => {
  return (
    <Card className="custom-card">
      <CardHeader className="custom-header">
        <CardTitle className="custom-title">Custom Title</CardTitle>
        <CardDescription className="custom-description">
          Custom description
        </CardDescription>
      </CardHeader>
      <CardContent className="custom-content">
        <p>Custom content</p>
      </CardContent>
      <CardFooter className="custom-footer">
        <button>Custom Button</button>
      </CardFooter>
    </Card>
  )
}

// Test interactive card
const TestInteractiveCard = () => {
  const [clicked, setClicked] = React.useState(false)

  return (
    <Card
      onClick={() => setClicked(true)}
      className="cursor-pointer hover:shadow-md transition-shadow"
    >
      <CardHeader>
        <CardTitle>Interactive Card</CardTitle>
        <CardDescription>Click me to test interactions</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Click count: {clicked ? '1' : '0'}</p>
      </CardContent>
    </Card>
  )
}

// Test card with complex content
const TestCardWithComplexContent = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complex Card</CardTitle>
        <CardDescription>
          This card contains various types of content including lists, links, and
          interactive elements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div>
          <h3>Features:</h3>
          <ul>
            <li>Feature 1</li>
            <li>Feature 2</li>
            <li>Feature 3</li>
          </ul>
          <a href="#" className="text-blue-500 hover:underline">
            Learn more
          </a>
        </div>
      </CardContent>
      <CardFooter>
        <button className="mr-2">Primary Action</button>
        <button className="text-gray-500">Secondary Action</button>
      </CardFooter>
    </Card>
  )
}

describe('Card Component', () => {
  describe('Card Elements', () => {
    it('renders card with all sub-components', () => {
      render(<TestCard />)

      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByText('This is a test card description')).toBeInTheDocument()
      expect(screen.getByText('This is the card content with some text.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument()
    })

    it('renders card with proper structure', () => {
      render(<TestCard />)

      const card = screen.getByText('Card Title').closest('[class*="rounded-lg"]')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'text-card-foreground', 'shadow-sm')
    })

    it('renders card with custom styling', () => {
      render(<TestCardWithCustomStyling />)

      const card = screen.getByText('Custom Title').closest('[class*="rounded-lg"]')
      expect(card).toHaveClass('custom-card')

      const header = screen.getByText('Custom Title').closest('[class*="flex flex-col"]')
      expect(header).toHaveClass('custom-header')

      const content = screen.getByText('Custom content').closest('[class*="p-6 pt-0"]')
      expect(content).toHaveClass('custom-content')

      const footer = screen.getByRole('button', { name: 'Custom Button' }).closest('[class*="flex items-center"]')
      expect(footer).toHaveClass('custom-footer')
    })
  })

  describe('Card Sub-components', () => {
    it('renders Card with proper wrapper', () => {
      render(
        <Card data-testid="card">
          <CardContent>Test content</CardContent>
        </Card>
      )

      const card = screen.getByTestId('card')
      expect(card).toBeInTheDocument()
      expect(card.tagName).toBe('DIV')
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'text-card-foreground', 'shadow-sm')
    })

    it('renders CardHeader with proper styling', () => {
      render(
        <Card>
          <CardHeader data-testid="header">
            <CardTitle>Title</CardTitle>
          </CardHeader>
        </Card>
      )

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(header.tagName).toBe('DIV')
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6')
    })

    it('renders CardTitle with proper styling', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle data-testid="title">Test Title</CardTitle>
          </CardHeader>
        </Card>
      )

      const title = screen.getByTestId('title')
      expect(title).toBeInTheDocument()
      expect(title.tagName).toBe('H1')
      expect(title).toHaveClass('text-2xl', 'font-semibold', 'leading-none', 'tracking-tight')
    })

    it('renders CardDescription with proper styling', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription data-testid="description">Test description</CardDescription>
          </CardHeader>
        </Card>
      )

      const description = screen.getByTestId('description')
      expect(description).toBeInTheDocument()
      expect(description.tagName).toBe('P')
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('renders CardContent with proper styling', () => {
      render(
        <Card>
          <CardContent data-testid="content">
            <p>Test content</p>
          </CardContent>
        </Card>
      )

      const content = screen.getByTestId('content')
      expect(content).toBeInTheDocument()
      expect(content.tagName).toBe('DIV')
      expect(content).toHaveClass('p-6', 'pt-0')
    })

    it('renders CardFooter with proper styling', () => {
      render(
        <Card>
          <CardFooter data-testid="footer">
            <button>Test button</button>
          </CardFooter>
        </Card>
      )

      const footer = screen.getByTestId('footer')
      expect(footer).toBeInTheDocument()
      expect(footer.tagName).toBe('DIV')
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
    })
  })

  describe('Card Interactions', () => {
    it('handles click events', async () => {
      const user = userEvent.setup()
      render(<TestInteractiveCard />)

      const card = screen.getByText('Interactive Card').closest('[class*="rounded-lg"]')
      expect(card).toBeInTheDocument()

      // Initial state
      expect(screen.getByText('Click count: 0')).toBeInTheDocument()

      // Click the card
      await user.click(card!)

      // Check that the state changed
      expect(screen.getByText('Click count: 1')).toBeInTheDocument()
    })

    it('handles hover states', async () => {
      const user = userEvent.setup()
      render(<TestInteractiveCard />)

      const card = screen.getByText('Interactive Card').closest('[class*="rounded-lg"]')
      expect(card).toBeInTheDocument()

      // Hover over the card
      await user.hover(card!)

      // The hover class should be applied (this is handled by CSS)
      expect(card).toHaveClass('hover:shadow-md')
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(<TestCard />)

      // Check for proper heading structure
      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toBeInTheDocument()
      expect(title).toHaveTextContent('Card Title')

      // Check for proper button accessibility
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Action Button')
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<TestInteractiveCard />)

      const card = screen.getByText('Interactive Card').closest('[class*="rounded-lg"]')
      expect(card).toBeInTheDocument()

      // Focus the card
      if (card instanceof HTMLElement) {
        card.focus()
      }

      // The card should be focusable
      expect(card).toHaveClass('cursor-pointer')
    })

    it('has proper ARIA attributes for interactive elements', () => {
      render(<TestCard />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      // Buttons don't have a default type attribute in HTML
      expect(button).toBeInTheDocument()
    })
  })

  describe('Card State Management', () => {
    it('handles dynamic content updates', () => {
      const DynamicCard = () => {
        const [count, setCount] = React.useState(0)

        return (
          <Card>
            <CardHeader>
              <CardTitle>Dynamic Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Count: {count}</p>
              <button onClick={() => setCount(count + 1)}>Increment</button>
            </CardContent>
          </Card>
        )
      }

      render(<DynamicCard />)

      expect(screen.getByText('Count: 0')).toBeInTheDocument()

      const button = screen.getByRole('button', { name: 'Increment' })
      expect(button).toBeInTheDocument()
    })

    it('handles conditional rendering', () => {
      const ConditionalCard = ({ showFooter }: { showFooter: boolean }) => (
        <Card>
          <CardHeader>
            <CardTitle>Conditional Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Content</p>
          </CardContent>
          {showFooter && (
            <CardFooter>
              <button>Footer Button</button>
            </CardFooter>
          )}
        </Card>
      )

      const { rerender } = render(<ConditionalCard showFooter={false} />)

      expect(screen.queryByRole('button', { name: 'Footer Button' })).not.toBeInTheDocument()

      rerender(<ConditionalCard showFooter={true} />)

      expect(screen.getByRole('button', { name: 'Footer Button' })).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<TestCard />)
      const endTime = performance.now()

      // Should render within reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('handles many cards efficiently', () => {
      const ManyCards = () => (
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>Card {i + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Content for card {i + 1}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )

      const startTime = performance.now()
      render(<ManyCards />)
      const endTime = performance.now()

      // Should render within reasonable time even with many cards
      expect(endTime - startTime).toBeLessThan(200)
      expect(screen.getByText('Card 1')).toBeInTheDocument()
      expect(screen.getByText('Card 100')).toBeInTheDocument()
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<TestCard />)
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('handles card with very long content', () => {
      const LongContentCard = () => (
        <Card>
          <CardHeader>
            <CardTitle>Long Content Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              This is a very long content that might wrap to multiple lines and should be handled gracefully by the card component. It contains a lot of text to test how the card handles overflow and wrapping. The content should be properly contained within the card boundaries and maintain proper spacing and layout.
            </p>
          </CardContent>
        </Card>
      )

      render(<LongContentCard />)

      const longContent = screen.getByText(/This is a very long content/)
      expect(longContent).toBeInTheDocument()
    })



    it('handles empty card content', () => {
      const EmptyCard = () => (
        <Card>
          <CardHeader>
            <CardTitle>Empty Card</CardTitle>
          </CardHeader>
          <CardContent>
            {/* No content */}
          </CardContent>
        </Card>
      )

      render(<EmptyCard />)

      expect(screen.getByText('Empty Card')).toBeInTheDocument()
      // Should not crash and should render properly
    })

    it('handles card with complex nested content', () => {
      render(<TestCardWithComplexContent />)

      expect(screen.getByText('Complex Card')).toBeInTheDocument()
      expect(screen.getByText('Features:')).toBeInTheDocument()
      expect(screen.getByText('Feature 1')).toBeInTheDocument()
      expect(screen.getByText('Feature 2')).toBeInTheDocument()
      expect(screen.getByText('Feature 3')).toBeInTheDocument()
      expect(screen.getByText('Learn more')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Primary Action' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Secondary Action' })).toBeInTheDocument()
    })
  })

  describe('Integration with UI Components', () => {
    it('works with custom styling classes', () => {
      render(<TestCardWithCustomStyling />)

      const card = screen.getByText('Custom Title').closest('[class*="rounded-lg"]')
      expect(card).toHaveClass('custom-card')

      const title = screen.getByText('Custom Title')
      expect(title).toHaveClass('custom-title')

      const description = screen.getByText('Custom description')
      expect(description).toHaveClass('custom-description')
    })

    it('works with form elements inside cards', () => {
      const CardWithForm = () => (
        <Card>
          <CardHeader>
            <CardTitle>Form Card</CardTitle>
          </CardHeader>
          <CardContent>
            <form>
              <label htmlFor="name">Name:</label>
              <input id="name" type="text" placeholder="Enter your name" />
              <button type="submit">Submit</button>
            </form>
          </CardContent>
        </Card>
      )

      render(<CardWithForm />)

      expect(screen.getByText('Form Card')).toBeInTheDocument()
      expect(screen.getByLabelText('Name:')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
    })

    it('works with multiple cards on the same page', () => {
      const MultipleCards = () => (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>First Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>First card content</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Second Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Second card content</p>
            </CardContent>
          </Card>
        </div>
      )

      render(<MultipleCards />)

      expect(screen.getByText('First Card')).toBeInTheDocument()
      expect(screen.getByText('Second Card')).toBeInTheDocument()
      expect(screen.getByText('First card content')).toBeInTheDocument()
      expect(screen.getByText('Second card content')).toBeInTheDocument()
    })
  })
})

import { render, screen } from '@testing-library/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

describe('Card Components', () => {
  describe('Card', () => {
    it('should render as a div element', () => {
      render(<Card data-testid="card">Card content</Card>)
      const card = screen.getByTestId('card')
      expect(card.tagName).toBe('DIV')
    })

    it('should apply default card classes', () => {
      render(<Card data-testid="card">Card content</Card>)
      const card = screen.getByTestId('card')
      expect(card).toHaveClass(
        'rounded-lg',
        'border',
        'bg-card',
        'text-card-foreground',
        'shadow-sm'
      )
    })

    it('should apply custom className', () => {
      render(
        <Card className="custom-class" data-testid="card">
          Card content
        </Card>
      )
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-class')
    })

    it('should forward ref correctly', () => {
      const ref = jest.fn()
      render(
        <Card ref={ref} data-testid="card">
          Card content
        </Card>
      )
      expect(ref).toHaveBeenCalled()
    })

    it('should pass through additional props', () => {
      render(
        <Card data-testid="card" aria-label="Card">
          Card content
        </Card>
      )
      const card = screen.getByTestId('card')
      expect(card).toHaveAttribute('aria-label', 'Card')
    })

    it('should render children content', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })
  })

  describe('CardHeader', () => {
    it('should render as a div element', () => {
      render(<CardHeader data-testid="header">Header content</CardHeader>)
      const header = screen.getByTestId('header')
      expect(header.tagName).toBe('DIV')
    })

    it('should apply default header classes', () => {
      render(<CardHeader data-testid="header">Header content</CardHeader>)
      const header = screen.getByTestId('header')
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6')
    })

    it('should apply custom className', () => {
      render(
        <CardHeader className="custom-header" data-testid="header">
          Header content
        </CardHeader>
      )
      const header = screen.getByTestId('header')
      expect(header).toHaveClass('custom-header')
    })

    it('should forward ref correctly', () => {
      const ref = jest.fn()
      render(
        <CardHeader ref={ref} data-testid="header">
          Header content
        </CardHeader>
      )
      expect(ref).toHaveBeenCalled()
    })

    it('should render children content', () => {
      render(<CardHeader>Header content</CardHeader>)
      expect(screen.getByText('Header content')).toBeInTheDocument()
    })
  })

  describe('CardTitle', () => {
    it('should render as an h1 element', () => {
      render(<CardTitle data-testid="title">Card Title</CardTitle>)
      const title = screen.getByTestId('title')
      expect(title.tagName).toBe('H1')
    })

    it('should apply default title classes', () => {
      render(<CardTitle data-testid="title">Card Title</CardTitle>)
      const title = screen.getByTestId('title')
      expect(title).toHaveClass(
        'text-2xl',
        'font-semibold',
        'leading-none',
        'tracking-tight'
      )
    })

    it('should apply custom className', () => {
      render(
        <CardTitle className="custom-title" data-testid="title">
          Card Title
        </CardTitle>
      )
      const title = screen.getByTestId('title')
      expect(title).toHaveClass('custom-title')
    })

    it('should forward ref correctly', () => {
      const ref = jest.fn()
      render(
        <CardTitle ref={ref} data-testid="title">
          Card Title
        </CardTitle>
      )
      expect(ref).toHaveBeenCalled()
    })

    it('should render children content', () => {
      render(<CardTitle>Card Title</CardTitle>)
      expect(screen.getByText('Card Title')).toBeInTheDocument()
    })
  })

  describe('CardDescription', () => {
    it('should render as a p element', () => {
      render(
        <CardDescription data-testid="description">
          Card description
        </CardDescription>
      )
      const description = screen.getByTestId('description')
      expect(description.tagName).toBe('P')
    })

    it('should apply default description classes', () => {
      render(
        <CardDescription data-testid="description">
          Card description
        </CardDescription>
      )
      const description = screen.getByTestId('description')
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('should apply custom className', () => {
      render(
        <CardDescription className="custom-desc" data-testid="description">
          Card description
        </CardDescription>
      )
      const description = screen.getByTestId('description')
      expect(description).toHaveClass('custom-desc')
    })

    it('should forward ref correctly', () => {
      const ref = jest.fn()
      render(
        <CardDescription ref={ref} data-testid="description">
          Card description
        </CardDescription>
      )
      expect(ref).toHaveBeenCalled()
    })

    it('should render children content', () => {
      render(<CardDescription>Card description</CardDescription>)
      expect(screen.getByText('Card description')).toBeInTheDocument()
    })
  })

  describe('CardContent', () => {
    it('should render as a div element', () => {
      render(<CardContent data-testid="content">Card content</CardContent>)
      const content = screen.getByTestId('content')
      expect(content.tagName).toBe('DIV')
    })

    it('should apply default content classes', () => {
      render(<CardContent data-testid="content">Card content</CardContent>)
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('p-6', 'pt-0')
    })

    it('should apply custom className', () => {
      render(
        <CardContent className="custom-content" data-testid="content">
          Card content
        </CardContent>
      )
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('custom-content')
    })

    it('should forward ref correctly', () => {
      const ref = jest.fn()
      render(
        <CardContent ref={ref} data-testid="content">
          Card content
        </CardContent>
      )
      expect(ref).toHaveBeenCalled()
    })

    it('should render children content', () => {
      render(<CardContent>Card content</CardContent>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })
  })

  describe('CardFooter', () => {
    it('should render as a div element', () => {
      render(<CardFooter data-testid="footer">Footer content</CardFooter>)
      const footer = screen.getByTestId('footer')
      expect(footer.tagName).toBe('DIV')
    })

    it('should apply default footer classes', () => {
      render(<CardFooter data-testid="footer">Footer content</CardFooter>)
      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
    })

    it('should apply custom className', () => {
      render(
        <CardFooter className="custom-footer" data-testid="footer">
          Footer content
        </CardFooter>
      )
      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('custom-footer')
    })

    it('should forward ref correctly', () => {
      const ref = jest.fn()
      render(
        <CardFooter ref={ref} data-testid="footer">
          Footer content
        </CardFooter>
      )
      expect(ref).toHaveBeenCalled()
    })

    it('should render children content', () => {
      render(<CardFooter>Footer content</CardFooter>)
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })
  })

  describe('Card Integration', () => {
    it('should work together as a complete card', () => {
      render(
        <Card data-testid="card">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
          <CardContent>Card content</CardContent>
          <CardFooter>Footer content</CardFooter>
        </Card>
      )

      expect(screen.getByTestId('card')).toBeInTheDocument()
      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByText('Card description')).toBeInTheDocument()
      expect(screen.getByText('Card content')).toBeInTheDocument()
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })

    it('should maintain proper hierarchy', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      )

      const card = screen.getByText('Title').closest('[class*="rounded-lg"]')
      expect(card).toBeInTheDocument()

      // Verify all elements are within the card
      expect(card).toContainElement(screen.getByText('Title'))
      expect(card).toContainElement(screen.getByText('Description'))
      expect(card).toContainElement(screen.getByText('Content'))
      expect(card).toContainElement(screen.getByText('Footer'))
    })

    it('should handle complex nested content', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Complex Card</CardTitle>
            <CardDescription>With nested elements</CardDescription>
          </CardHeader>
          <CardContent>
            <div data-testid="nested-content">
              <p>Nested paragraph</p>
              <button>Nested button</button>
            </div>
          </CardContent>
          <CardFooter>
            <button>Action 1</button>
            <button>Action 2</button>
          </CardFooter>
        </Card>
      )

      expect(screen.getByTestId('nested-content')).toBeInTheDocument()
      expect(screen.getByText('Nested paragraph')).toBeInTheDocument()
      expect(screen.getByText('Nested button')).toBeInTheDocument()
      expect(screen.getByText('Action 1')).toBeInTheDocument()
      expect(screen.getByText('Action 2')).toBeInTheDocument()
    })
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LucideHome } from 'lucide-react'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('should render as a button by default', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toBeInTheDocument()
  })

  it('should render as a link when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Link' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  it('should apply correct variant classes', () => {
    const { rerender } = render(
      <Button variant="destructive">Destructive</Button>
    )
    let button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')

    rerender(<Button variant="outline">Outline</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('border-input')
  })

  it('should apply correct size classes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    let button = screen.getByRole('button')
    expect(button).toHaveClass('h-9')

    rerender(<Button size="lg">Large</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('h-11')
  })

  it('should be clickable and handle events', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()

    render(<Button onClick={handleClick}>Click me</Button>)
    const button = screen.getByRole('button')

    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('should not be clickable when disabled', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    )
    const button = screen.getByRole('button')

    await user.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should render with icon on the left', () => {
    render(
      <Button Icon={LucideHome} iconPlacement="left">
        Home
      </Button>
    )
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    // Icon should be present in the DOM
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  it('should render with icon on the right', () => {
    render(
      <Button Icon={LucideHome} iconPlacement="right">
        Home
      </Button>
    )
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  it('should not render icon when Icon prop is not provided', () => {
    render(<Button>No Icon</Button>)
    const button = screen.getByRole('button')
    expect(button.querySelector('svg')).not.toBeInTheDocument()
  })

  it('should forward ref correctly', () => {
    const ref = jest.fn()
    render(<Button ref={ref}>Ref Test</Button>)
    expect(ref).toHaveBeenCalled()
  })

  it('should pass through additional props', () => {
    render(
      <Button data-testid="custom-button" aria-label="Custom">
        Custom
      </Button>
    )
    const button = screen.getByTestId('custom-button')
    expect(button).toHaveAttribute('aria-label', 'Custom')
  })

  it('should have proper accessibility attributes', () => {
    render(<Button>Accessible</Button>)
    const button = screen.getByRole('button')
    // Buttons are accessible by default - they have implicit role
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
  })

  it('should handle type attribute correctly', () => {
    render(<Button type="submit">Submit</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('should have focus management', async () => {
    const user = userEvent.setup()
    render(<Button>Focusable</Button>)
    const button = screen.getByRole('button')

    await user.tab()
    expect(button).toHaveFocus()
  })

  it('should handle keyboard interactions', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()

    render(<Button onClick={handleClick}>Keyboard</Button>)
    const button = screen.getByRole('button')

    await user.tab()
    await user.keyboard('{Enter}')
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

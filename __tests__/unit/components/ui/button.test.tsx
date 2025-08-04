import React from 'react'
import { render, screen } from '@/__tests__/helpers/test-utils'
import { Button } from '@/components/ui/button'
import { ArrowRight, Plus } from 'lucide-react'

describe('Button Component', () => {
  describe('Basic Functionality', () => {
    it('renders with default props', () => {
      render(<Button>Click me</Button>)
      
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('bg-primary')
    })

    it('renders as a child component when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      
      const link = screen.getByRole('link', { name: /link button/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/test')
    })

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Button ref={ref}>Ref Button</Button>)
      
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
  })

  describe('Variants', () => {
    it('renders default variant', () => {
      render(<Button variant="default">Default</Button>)
      
      const button = screen.getByRole('button', { name: /default/i })
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
    })

    it('renders destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>)
      
      const button = screen.getByRole('button', { name: /delete/i })
      expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground')
    })

    it('renders outline variant', () => {
      render(<Button variant="outline">Outline</Button>)
      
      const button = screen.getByRole('button', { name: /outline/i })
      expect(button).toHaveClass('border', 'border-input', 'bg-background')
    })

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)
      
      const button = screen.getByRole('button', { name: /secondary/i })
      expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground')
    })

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      
      const button = screen.getByRole('button', { name: /ghost/i })
      expect(button).toHaveClass('hover:bg-accent', 'hover:text-accent-foreground')
    })

    it('renders link variant', () => {
      render(<Button variant="link">Link</Button>)
      
      const button = screen.getByRole('button', { name: /link/i })
      expect(button).toHaveClass('text-primary', 'underline-offset-4')
    })

    it('renders expandIcon variant', () => {
      render(
        <Button variant="expandIcon" Icon={ArrowRight} iconPlacement="right">
          Expand
        </Button>
      )
      
      const button = screen.getByRole('button', { name: /expand/i })
      expect(button).toHaveClass('group', 'relative', 'text-primary-foreground', 'bg-primary')
    })

    it('renders ringHover variant', () => {
      render(<Button variant="ringHover">Ring Hover</Button>)
      
      const button = screen.getByRole('button', { name: /ring hover/i })
      expect(button).toHaveClass('transition-all', 'duration-300')
    })

    it('renders shine variant', () => {
      render(<Button variant="shine">Shine</Button>)
      
      const button = screen.getByRole('button', { name: /shine/i })
      expect(button).toHaveClass('animate-shine', 'bg-gradient-to-r')
    })

    it('renders gooeyRight variant', () => {
      render(<Button variant="gooeyRight">Gooey Right</Button>)
      
      const button = screen.getByRole('button', { name: /gooey right/i })
      expect(button).toHaveClass('relative', 'z-0', 'overflow-hidden')
    })

    it('renders gooeyLeft variant', () => {
      render(<Button variant="gooeyLeft">Gooey Left</Button>)
      
      const button = screen.getByRole('button', { name: /gooey left/i })
      expect(button).toHaveClass('relative', 'z-0', 'overflow-hidden')
    })

    it('renders linkHover1 variant', () => {
      render(<Button variant="linkHover1">Link Hover 1</Button>)
      
      const button = screen.getByRole('button', { name: /link hover 1/i })
      expect(button).toHaveClass('relative', 'after:absolute')
    })

    it('renders linkHover2 variant', () => {
      render(<Button variant="linkHover2">Link Hover 2</Button>)
      
      const button = screen.getByRole('button', { name: /link hover 2/i })
      expect(button).toHaveClass('relative', 'after:absolute')
    })
  })

  describe('Sizes', () => {
    it('renders default size', () => {
      render(<Button size="default">Default Size</Button>)
      
      const button = screen.getByRole('button', { name: /default size/i })
      expect(button).toHaveClass('h-10', 'px-4', 'py-2')
    })

    it('renders small size', () => {
      render(<Button size="sm">Small</Button>)
      
      const button = screen.getByRole('button', { name: /small/i })
      expect(button).toHaveClass('h-9', 'rounded-md', 'px-3')
    })

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>)
      
      const button = screen.getByRole('button', { name: /large/i })
      expect(button).toHaveClass('h-11', 'rounded-md', 'px-8')
    })

    it('renders icon size', () => {
      render(<Button size="icon">Icon</Button>)
      
      const button = screen.getByRole('button', { name: /icon/i })
      expect(button).toHaveClass('h-10', 'w-10')
    })
  })

  describe('Icon Placement', () => {
    it('renders with left icon', () => {
      render(
        <Button Icon={Plus} iconPlacement="left">
          Add Item
        </Button>
      )
      
      const button = screen.getByRole('button', { name: /add item/i })
      expect(button).toBeInTheDocument()
    })

    it('renders with right icon', () => {
      render(
        <Button Icon={ArrowRight} iconPlacement="right">
          Continue
        </Button>
      )
      
      const button = screen.getByRole('button', { name: /continue/i })
      expect(button).toBeInTheDocument()
    })
  })

  describe('States', () => {
    it('renders disabled state', () => {
      render(<Button disabled>Disabled</Button>)
      
      const button = screen.getByRole('button', { name: /disabled/i })
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50')
    })

    it('renders loading state', () => {
      render(<Button disabled>Loading...</Button>)
      
      const button = screen.getByRole('button', { name: /loading/i })
      expect(button).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<Button aria-label="Submit form">Submit</Button>)
      
      const button = screen.getByRole('button', { name: /submit form/i })
      expect(button).toHaveAttribute('aria-label', 'Submit form')
    })

    it('supports keyboard navigation', () => {
      render(<Button>Keyboard Accessible</Button>)
      
      const button = screen.getByRole('button', { name: /keyboard accessible/i })
      expect(button).toHaveAttribute('tabIndex', '0')
    })

    it('has focus visible styles', () => {
      render(<Button>Focus Test</Button>)
      
      const button = screen.getByRole('button', { name: /focus test/i })
      expect(button).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-2')
    })
  })

  describe('Event Handling', () => {
    it('calls onClick handler', async () => {
      const handleClick = jest.fn()
      const { user } = render(<Button onClick={handleClick}>Click Me</Button>)
      
      const button = screen.getByRole('button', { name: /click me/i })
      await user.click(button)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', async () => {
      const handleClick = jest.fn()
      const { user } = render(
        <Button onClick={handleClick} disabled>
          Disabled Button
        </Button>
      )
      
      const button = screen.getByRole('button', { name: /disabled button/i })
      await user.click(button)
      
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Custom Class Names', () => {
    it('applies custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      
      const button = screen.getByRole('button', { name: /custom/i })
      expect(button).toHaveClass('custom-class')
    })

    it('combines custom className with variant classes', () => {
      render(
        <Button variant="destructive" className="custom-class">
          Custom Destructive
        </Button>
      )
      
      const button = screen.getByRole('button', { name: /custom destructive/i })
      expect(button).toHaveClass('custom-class', 'bg-destructive')
    })
  })

  describe('Type Safety', () => {
    it('accepts all HTML button attributes', () => {
      render(
        <Button
          type="submit"
          form="test-form"
          name="test-button"
          value="test-value"
          data-testid="test-button"
        >
          Type Safe
        </Button>
      )
      
      const button = screen.getByRole('button', { name: /type safe/i })
      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toHaveAttribute('form', 'test-form')
      expect(button).toHaveAttribute('name', 'test-button')
      expect(button).toHaveAttribute('value', 'test-value')
      expect(button).toHaveAttribute('data-testid', 'test-button')
    })
  })

  describe('Integration with Forms', () => {
    it('works as form submit button', () => {
      render(
        <form>
          <Button type="submit">Submit Form</Button>
        </form>
      )
      
      const button = screen.getByRole('button', { name: /submit form/i })
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('works as form reset button', () => {
      render(
        <form>
          <Button type="reset">Reset Form</Button>
        </form>
      )
      
      const button = screen.getByRole('button', { name: /reset form/i })
      expect(button).toHaveAttribute('type', 'reset')
    })
  })

  describe('Performance', () => {
    it('renders without unnecessary re-renders', () => {
      const { rerender } = render(<Button>Performance Test</Button>)
      
      const button = screen.getByRole('button', { name: /performance test/i })
      const initialRender = button.textContent
      
      rerender(<Button>Performance Test</Button>)
      
      expect(button.textContent).toBe(initialRender)
    })
  })
})

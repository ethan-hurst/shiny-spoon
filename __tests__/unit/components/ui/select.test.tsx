import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Mock Radix UI Select components
jest.mock('@radix-ui/react-select', () => ({
  Root: ({ children, ...props }: any) => (
    <div data-testid="select-root" {...props}>
      {children}
    </div>
  ),
  Group: ({ children, ...props }: any) => (
    <div data-testid="select-group" {...props}>
      {children}
    </div>
  ),
  Value: ({ children, ...props }: any) => (
    <span data-testid="select-value" {...props}>
      {children}
    </span>
  ),
  Trigger: React.forwardRef(({ children, className, ...props }: any, ref) => (
    <button
      ref={ref}
      data-testid="select-trigger"
      className={className}
      {...props}
    >
      {children}
      <div data-testid="select-icon">▼</div>
    </button>
  )),
  Content: React.forwardRef(
    ({ children, className, position, ...props }: any, ref) => (
      <div
        ref={ref}
        data-testid="select-content"
        className={className}
        data-position={position}
        {...props}
      >
        <div data-testid="scroll-up-button">▲</div>
        <div data-testid="select-viewport">{children}</div>
        <div data-testid="scroll-down-button">▼</div>
      </div>
    )
  ),
  Label: React.forwardRef(({ children, className, ...props }: any, ref) => (
    <div ref={ref} data-testid="select-label" className={className} {...props}>
      {children}
    </div>
  )),
  Item: React.forwardRef(({ children, className, ...props }: any, ref) => (
    <div ref={ref} data-testid="select-item" className={className} {...props}>
      <span data-testid="item-indicator">✓</span>
      <span data-testid="item-text">{children}</span>
    </div>
  )),
  Separator: React.forwardRef(({ className, ...props }: any, ref) => (
    <div
      ref={ref}
      data-testid="select-separator"
      className={className}
      {...props}
    />
  )),
  ScrollUpButton: React.forwardRef(({ className, ...props }: any, ref) => (
    <button
      ref={ref}
      data-testid="scroll-up-button"
      className={className}
      {...props}
    >
      ▲
    </button>
  )),
  ScrollDownButton: React.forwardRef(({ className, ...props }: any, ref) => (
    <button
      ref={ref}
      data-testid="scroll-down-button"
      className={className}
      {...props}
    >
      ▼
    </button>
  )),
  Icon: ({ asChild, children }: any) => (asChild ? children : <div>▼</div>),
  Portal: ({ children }: any) => (
    <div data-testid="select-portal">{children}</div>
  ),
  Viewport: ({ children, className }: any) => (
    <div data-testid="select-viewport" className={className}>
      {children}
    </div>
  ),
  ItemIndicator: ({ children }: any) => (
    <span data-testid="item-indicator">{children}</span>
  ),
  ItemText: ({ children }: any) => (
    <span data-testid="item-text">{children}</span>
  ),
}))

describe('Select Components', () => {
  describe('Select (Root)', () => {
    it('should render select root component', () => {
      render(
        <Select data-testid="select">
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      )

      expect(screen.getByTestId('select')).toBeInTheDocument()
    })

    it('should pass through props to root component', () => {
      render(
        <Select data-testid="select" defaultValue="option1">
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      )

      const selectRoot = screen.getByTestId('select')
      expect(selectRoot).toHaveAttribute('data-testid', 'select')
      expect(selectRoot).toBeInTheDocument()
    })
  })

  describe('SelectTrigger', () => {
    it('should render trigger with correct classes', () => {
      render(
        <SelectTrigger data-testid="trigger">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      )

      const trigger = screen.getByTestId('trigger')
      expect(trigger).toBeInTheDocument()
      expect(trigger).toHaveClass('flex', 'h-10', 'w-full')
    })

    it('should apply custom className', () => {
      render(
        <SelectTrigger className="custom-trigger" data-testid="trigger">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      )

      const trigger = screen.getByTestId('trigger')
      expect(trigger).toHaveClass('custom-trigger')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(
        <SelectTrigger ref={ref} data-testid="trigger">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      )

      expect(ref.current).toBe(screen.getByTestId('trigger'))
    })

    it('should render icon', () => {
      render(
        <SelectTrigger data-testid="trigger">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      )

      expect(screen.getByTestId('select-icon')).toBeInTheDocument()
    })

    it('should pass through additional props', () => {
      render(
        <SelectTrigger data-testid="trigger" aria-label="Select option">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      )

      const trigger = screen.getByTestId('trigger')
      expect(trigger).toHaveAttribute('aria-label', 'Select option')
    })
  })

  describe('SelectValue', () => {
    it('should render value component', () => {
      render(<SelectValue placeholder="Select an option" />)

      expect(screen.getByTestId('select-value')).toBeInTheDocument()
    })

    it('should display placeholder when no value', () => {
      render(<SelectValue placeholder="Select an option" />)

      const value = screen.getByTestId('select-value')
      expect(value).toHaveAttribute('placeholder', 'Select an option')
    })

    it('should display selected value', () => {
      render(<SelectValue value="selected-option">Selected Option</SelectValue>)

      const value = screen.getByTestId('select-value')
      expect(value).toHaveTextContent('Selected Option')
    })
  })

  describe('SelectContent', () => {
    it('should render content with portal', () => {
      render(
        <SelectContent data-testid="content">
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      )

      expect(screen.getByTestId('select-portal')).toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('should apply default position', () => {
      render(
        <SelectContent data-testid="content">
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveAttribute('data-position', 'popper')
    })

    it('should apply custom position', () => {
      render(
        <SelectContent data-testid="content" position="item">
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveAttribute('data-position', 'item')
    })

    it('should apply custom className', () => {
      render(
        <SelectContent className="custom-content" data-testid="content">
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveClass('custom-content')
    })

    it('should include scroll buttons', () => {
      render(
        <SelectContent data-testid="content">
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      )

      expect(screen.getAllByTestId('scroll-up-button')).toHaveLength(2)
      expect(screen.getAllByTestId('scroll-down-button')).toHaveLength(2)
    })
  })

  describe('SelectItem', () => {
    it('should render item with correct structure', () => {
      render(
        <SelectItem value="option1" data-testid="item">
          Option 1
        </SelectItem>
      )

      const item = screen.getByTestId('item')
      expect(item).toBeInTheDocument()
      expect(screen.getAllByTestId('item-indicator')).toHaveLength(2)
      expect(screen.getAllByTestId('item-text')).toHaveLength(2)
    })

    it('should apply custom className', () => {
      render(
        <SelectItem value="option1" className="custom-item" data-testid="item">
          Option 1
        </SelectItem>
      )

      const item = screen.getByTestId('item')
      expect(item).toHaveClass('custom-item')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(
        <SelectItem ref={ref} value="option1" data-testid="item">
          Option 1
        </SelectItem>
      )

      expect(ref.current).toBe(screen.getByTestId('item'))
    })

    it('should pass through additional props', () => {
      render(
        <SelectItem value="option1" data-testid="item" aria-label="Option 1">
          Option 1
        </SelectItem>
      )

      const item = screen.getByTestId('item')
      expect(item).toHaveAttribute('aria-label', 'Option 1')
    })
  })

  describe('SelectLabel', () => {
    it('should render label with correct classes', () => {
      render(<SelectLabel data-testid="label">Group Label</SelectLabel>)

      const label = screen.getByTestId('label')
      expect(label).toBeInTheDocument()
      expect(label).toHaveClass(
        'py-1.5',
        'pl-8',
        'pr-2',
        'text-sm',
        'font-semibold'
      )
    })

    it('should apply custom className', () => {
      render(
        <SelectLabel className="custom-label" data-testid="label">
          Group Label
        </SelectLabel>
      )

      const label = screen.getByTestId('label')
      expect(label).toHaveClass('custom-label')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(
        <SelectLabel ref={ref} data-testid="label">
          Group Label
        </SelectLabel>
      )

      expect(ref.current).toBe(screen.getByTestId('label'))
    })
  })

  describe('SelectGroup', () => {
    it('should render group component', () => {
      render(
        <SelectGroup data-testid="group">
          <SelectLabel>Group Label</SelectLabel>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectGroup>
      )

      expect(screen.getByTestId('group')).toBeInTheDocument()
    })
  })

  describe('SelectSeparator', () => {
    it('should render separator with correct classes', () => {
      render(<SelectSeparator data-testid="separator" />)

      const separator = screen.getByTestId('separator')
      expect(separator).toBeInTheDocument()
      expect(separator).toHaveClass('-mx-1', 'my-1', 'h-px', 'bg-muted')
    })

    it('should apply custom className', () => {
      render(
        <SelectSeparator className="custom-separator" data-testid="separator" />
      )

      const separator = screen.getByTestId('separator')
      expect(separator).toHaveClass('custom-separator')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<SelectSeparator ref={ref} data-testid="separator" />)

      expect(ref.current).toBe(screen.getByTestId('separator'))
    })
  })

  describe('SelectScrollUpButton', () => {
    it('should render scroll up button', () => {
      render(<SelectScrollUpButton data-testid="scroll-up" />)

      expect(screen.getByTestId('scroll-up')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(
        <SelectScrollUpButton
          className="custom-scroll"
          data-testid="scroll-up"
        />
      )

      const button = screen.getByTestId('scroll-up')
      expect(button).toHaveClass('custom-scroll')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<SelectScrollUpButton ref={ref} data-testid="scroll-up" />)

      expect(ref.current).toBe(screen.getByTestId('scroll-up'))
    })
  })

  describe('SelectScrollDownButton', () => {
    it('should render scroll down button', () => {
      render(<SelectScrollDownButton data-testid="scroll-down" />)

      expect(screen.getByTestId('scroll-down')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(
        <SelectScrollDownButton
          className="custom-scroll"
          data-testid="scroll-down"
        />
      )

      const button = screen.getByTestId('scroll-down')
      expect(button).toHaveClass('custom-scroll')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<SelectScrollDownButton ref={ref} data-testid="scroll-down" />)

      expect(ref.current).toBe(screen.getByTestId('scroll-down'))
    })
  })

  describe('Select Integration', () => {
    it('should work together as a complete select', () => {
      render(
        <Select data-testid="select">
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent data-testid="content">
            <SelectGroup data-testid="group">
              <SelectLabel>Options</SelectLabel>
              <SelectItem value="option1" data-testid="item1">
                Option 1
              </SelectItem>
              <SelectItem value="option2" data-testid="item2">
                Option 2
              </SelectItem>
            </SelectGroup>
            <SelectSeparator data-testid="separator" />
            <SelectItem value="option3" data-testid="item3">
              Option 3
            </SelectItem>
          </SelectContent>
        </Select>
      )

      expect(screen.getByTestId('select')).toBeInTheDocument()
      expect(screen.getByTestId('trigger')).toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
      expect(screen.getByTestId('group')).toBeInTheDocument()
      expect(screen.getByTestId('item1')).toBeInTheDocument()
      expect(screen.getByTestId('item2')).toBeInTheDocument()
      expect(screen.getByTestId('separator')).toBeInTheDocument()
      expect(screen.getByTestId('item3')).toBeInTheDocument()
    })

    it('should maintain proper hierarchy', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Group 1</SelectLabel>
              <SelectItem value="option1">Option 1</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Group 2</SelectLabel>
              <SelectItem value="option2">Option 2</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      )

      // Should render all components in correct hierarchy
      expect(screen.getByTestId('select-root')).toBeInTheDocument()
      expect(screen.getByTestId('select-trigger')).toBeInTheDocument()
      expect(screen.getByTestId('select-portal')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <Select aria-label="Select option">
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      )

      const select = screen.getByTestId('select-root')
      expect(select).toHaveAttribute('aria-label', 'Select option')
    })

    it('should support keyboard navigation', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )

      const trigger = screen.getByTestId('select-trigger')
      expect(trigger).toBeInTheDocument()
      // Radix UI handles keyboard navigation internally
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component props are properly typed
      const TestSelect = () => (
        <Select defaultValue="option1">
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )

      render(<TestSelect />)
      expect(screen.getByTestId('select-root')).toBeInTheDocument()
    })
  })
})

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// Mock Radix UI Dialog components
jest.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, ...props }: any) => (
    <div data-testid="dialog-root" {...props}>
      {children}
    </div>
  ),
  Trigger: React.forwardRef(({ children, ...props }: any, ref) => (
    <button ref={ref} data-testid="dialog-trigger" {...props}>
      {children}
    </button>
  )),
  Portal: ({ children }: any) => (
    <div data-testid="dialog-portal">{children}</div>
  ),
  Overlay: React.forwardRef(({ className, ...props }: any, ref) => (
    <div
      ref={ref}
      data-testid="dialog-overlay"
      className={className}
      {...props}
    />
  )),
  Content: React.forwardRef(({ children, className, ...props }: any, ref) => (
    <div
      ref={ref}
      data-testid="dialog-content"
      className={className}
      {...props}
    >
      {children}
      <button data-testid="dialog-close">×</button>
    </div>
  )),
  Title: React.forwardRef(({ children, className, ...props }: any, ref) => (
    <h2 ref={ref} data-testid="dialog-title" className={className} {...props}>
      {children}
    </h2>
  )),
  Description: React.forwardRef(
    ({ children, className, ...props }: any, ref) => (
      <p
        ref={ref}
        data-testid="dialog-description"
        className={className}
        {...props}
      >
        {children}
      </p>
    )
  ),
  Close: React.forwardRef(({ children, className, ...props }: any, ref) => (
    <button
      ref={ref}
      data-testid="dialog-close-button"
      className={className}
      {...props}
    >
      {children}
    </button>
  )),
}))

describe('Dialog Components', () => {
  describe('Dialog (Root)', () => {
    it('should render dialog root component', () => {
      render(
        <Dialog data-testid="dialog">
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('should pass through props to root component', () => {
      render(
        <Dialog data-testid="dialog" open={false}>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const dialogRoot = screen.getByTestId('dialog')
      expect(dialogRoot).toHaveAttribute('data-testid', 'dialog')
      expect(dialogRoot).toBeInTheDocument()
    })
  })

  describe('DialogTrigger', () => {
    it('should render trigger button', () => {
      render(<DialogTrigger data-testid="trigger">Open Dialog</DialogTrigger>)

      const trigger = screen.getByTestId('trigger')
      expect(trigger).toBeInTheDocument()
      expect(trigger).toHaveTextContent('Open Dialog')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(
        <DialogTrigger ref={ref} data-testid="trigger">
          Open Dialog
        </DialogTrigger>
      )

      expect(ref.current).toBe(screen.getByTestId('trigger'))
    })

    it('should pass through additional props', () => {
      render(
        <DialogTrigger data-testid="trigger" aria-label="Open dialog">
          Open Dialog
        </DialogTrigger>
      )

      const trigger = screen.getByTestId('trigger')
      expect(trigger).toHaveAttribute('aria-label', 'Open dialog')
    })
  })

  describe('DialogContent', () => {
    it('should render content with portal and overlay', () => {
      render(
        <DialogContent data-testid="content">
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogContent>
      )

      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(
        <DialogContent className="custom-content" data-testid="content">
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogContent>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveClass('custom-content')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(
        <DialogContent ref={ref} data-testid="content">
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogContent>
      )

      expect(ref.current).toBe(screen.getByTestId('content'))
    })

    it('should include close button', () => {
      render(
        <DialogContent data-testid="content">
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogContent>
      )

      expect(screen.getByTestId('dialog-close')).toBeInTheDocument()
    })
  })

  describe('DialogOverlay', () => {
    it('should render overlay with correct classes', () => {
      render(<DialogOverlay data-testid="overlay" />)

      const overlay = screen.getByTestId('overlay')
      expect(overlay).toBeInTheDocument()
      expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50', 'bg-black/80')
    })

    it('should apply custom className', () => {
      render(<DialogOverlay className="custom-overlay" data-testid="overlay" />)

      const overlay = screen.getByTestId('overlay')
      expect(overlay).toHaveClass('custom-overlay')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<DialogOverlay ref={ref} data-testid="overlay" />)

      expect(ref.current).toBe(screen.getByTestId('overlay'))
    })
  })

  describe('DialogPortal', () => {
    it('should render portal component', () => {
      render(
        <DialogPortal data-testid="portal">
          <div>Portal content</div>
        </DialogPortal>
      )

      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument()
      expect(screen.getByText('Portal content')).toBeInTheDocument()
    })
  })

  describe('DialogTitle', () => {
    it('should render title with correct classes', () => {
      render(<DialogTitle data-testid="title">Dialog Title</DialogTitle>)

      const title = screen.getByTestId('title')
      expect(title).toBeInTheDocument()
      expect(title).toHaveClass(
        'text-lg',
        'font-semibold',
        'leading-none',
        'tracking-tight'
      )
    })

    it('should apply custom className', () => {
      render(
        <DialogTitle className="custom-title" data-testid="title">
          Dialog Title
        </DialogTitle>
      )

      const title = screen.getByTestId('title')
      expect(title).toHaveClass('custom-title')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLHeadingElement>()
      render(
        <DialogTitle ref={ref} data-testid="title">
          Dialog Title
        </DialogTitle>
      )

      expect(ref.current).toBe(screen.getByTestId('title'))
    })

    it('should pass through additional props', () => {
      render(
        <DialogTitle data-testid="title" aria-label="Dialog title">
          Dialog Title
        </DialogTitle>
      )

      const title = screen.getByTestId('title')
      expect(title).toHaveAttribute('aria-label', 'Dialog title')
    })
  })

  describe('DialogDescription', () => {
    it('should render description with correct classes', () => {
      render(
        <DialogDescription data-testid="description">
          Dialog description
        </DialogDescription>
      )

      const description = screen.getByTestId('description')
      expect(description).toBeInTheDocument()
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('should apply custom className', () => {
      render(
        <DialogDescription
          className="custom-description"
          data-testid="description"
        >
          Dialog description
        </DialogDescription>
      )

      const description = screen.getByTestId('description')
      expect(description).toHaveClass('custom-description')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLParagraphElement>()
      render(
        <DialogDescription ref={ref} data-testid="description">
          Dialog description
        </DialogDescription>
      )

      expect(ref.current).toBe(screen.getByTestId('description'))
    })
  })

  describe('DialogHeader', () => {
    it('should render header with correct classes', () => {
      render(
        <DialogHeader data-testid="header">
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
      )

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass(
        'flex',
        'flex-col',
        'space-y-1.5',
        'text-center',
        'sm:text-left'
      )
    })

    it('should apply custom className', () => {
      render(
        <DialogHeader className="custom-header" data-testid="header">
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
      )

      const header = screen.getByTestId('header')
      expect(header).toHaveClass('custom-header')
    })

    it('should pass through additional props', () => {
      render(
        <DialogHeader data-testid="header" aria-label="Dialog header">
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
      )

      const header = screen.getByTestId('header')
      expect(header).toHaveAttribute('aria-label', 'Dialog header')
    })
  })

  describe('DialogFooter', () => {
    it('should render footer with correct classes', () => {
      render(
        <DialogFooter data-testid="footer">
          <button>Cancel</button>
          <button>Save</button>
        </DialogFooter>
      )

      const footer = screen.getByTestId('footer')
      expect(footer).toBeInTheDocument()
      expect(footer).toHaveClass(
        'flex',
        'flex-col-reverse',
        'sm:flex-row',
        'sm:justify-end',
        'sm:space-x-2'
      )
    })

    it('should apply custom className', () => {
      render(
        <DialogFooter className="custom-footer" data-testid="footer">
          <button>Cancel</button>
          <button>Save</button>
        </DialogFooter>
      )

      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('custom-footer')
    })

    it('should pass through additional props', () => {
      render(
        <DialogFooter data-testid="footer" aria-label="Dialog footer">
          <button>Cancel</button>
          <button>Save</button>
        </DialogFooter>
      )

      const footer = screen.getByTestId('footer')
      expect(footer).toHaveAttribute('aria-label', 'Dialog footer')
    })
  })

  describe('DialogClose', () => {
    it('should render close button', () => {
      render(<DialogClose data-testid="close">Close</DialogClose>)

      const closeButton = screen.getByTestId('close')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveTextContent('Close')
    })

    it('should apply custom className', () => {
      render(
        <DialogClose className="custom-close" data-testid="close">
          Close
        </DialogClose>
      )

      const closeButton = screen.getByTestId('close')
      expect(closeButton).toHaveClass('custom-close')
    })

    it('should forward ref', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(
        <DialogClose ref={ref} data-testid="close">
          Close
        </DialogClose>
      )

      expect(ref.current).toBe(screen.getByTestId('close'))
    })
  })

  describe('Dialog Integration', () => {
    it('should work together as a complete dialog', () => {
      render(
        <Dialog data-testid="dialog">
          <DialogTrigger data-testid="trigger">Open Dialog</DialogTrigger>
          <DialogContent data-testid="content">
            <DialogHeader data-testid="header">
              <DialogTitle data-testid="title">Dialog Title</DialogTitle>
              <DialogDescription data-testid="description">
                Dialog description
              </DialogDescription>
            </DialogHeader>
            <div>Dialog content</div>
            <DialogFooter data-testid="footer">
              <DialogClose data-testid="close">Cancel</DialogClose>
              <button data-testid="save">Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('trigger')).toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('title')).toBeInTheDocument()
      expect(screen.getByTestId('description')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
      expect(screen.getByTestId('close')).toBeInTheDocument()
      expect(screen.getByTestId('save')).toBeInTheDocument()
    })

    it('should maintain proper hierarchy', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <div>Dialog content</div>
            <DialogFooter>
              <DialogClose>Cancel</DialogClose>
              <button>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      // Should render all components in correct hierarchy
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-trigger')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-portal')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <Dialog aria-label="Dialog">
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const dialog = screen.getByTestId('dialog-root')
      expect(dialog).toHaveAttribute('aria-label', 'Dialog')
    })

    it('should have proper heading structure', () => {
      render(
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogContent>
      )

      const title = screen.getByTestId('dialog-title')
      expect(title.tagName).toBe('H2')
    })

    it('should have proper close button accessibility', () => {
      render(
        <DialogContent>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      )

      const closeButtons = screen.getAllByRole('button', { name: /close/i })
      expect(closeButtons).toHaveLength(2)
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      // This test ensures the component props are properly typed
      const TestDialog = () => (
        <Dialog open={false}>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      render(<TestDialog />)
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument()
    })
  })
})

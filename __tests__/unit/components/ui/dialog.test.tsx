import React from 'react'
import { render, screen, waitFor } from '@/__tests__/helpers/test-utils'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Test dialog component
const TestDialog = () => {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Dialog</DialogTitle>
          <DialogDescription>
            This is a test dialog for testing purposes.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>This is the dialog content.</p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog Component', () => {
  describe('Dialog Elements', () => {
    it('renders dialog trigger', () => {
      render(<TestDialog />)

      expect(screen.getByRole('button', { name: /open dialog/i })).toBeInTheDocument()
    })

    it('renders dialog content when opened', async () => {
      const { user } = render(<TestDialog />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      // Check that dialog content is rendered
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Test Dialog')).toBeInTheDocument()
      expect(screen.getByText('This is a test dialog for testing purposes.')).toBeInTheDocument()
      expect(screen.getByText('This is the dialog content.')).toBeInTheDocument()
    })

    it('renders dialog header with title and description', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()

      const title = screen.getByText('Test Dialog')
      expect(title).toBeInTheDocument()
      expect(title).toHaveClass('text-lg', 'font-semibold')

      const description = screen.getByText('This is a test dialog for testing purposes.')
      expect(description).toBeInTheDocument()
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('renders dialog footer with buttons', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    it('renders close button', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('Dialog Interactions', () => {
    it('opens dialog when trigger is clicked', async () => {
      const { user } = render(<TestDialog />)

      const trigger = screen.getByRole('button', { name: /open dialog/i })
      await user.click(trigger)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('closes dialog when close button is clicked', async () => {
      const { user } = render(<TestDialog />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /open dialog/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Close dialog
      await user.click(screen.getByRole('button', { name: /close/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('closes dialog when escape key is pressed', async () => {
      const { user } = render(<TestDialog />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /open dialog/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Press escape key
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('closes dialog when clicking outside', async () => {
      const { user } = render(<TestDialog />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /open dialog/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Click outside (on the overlay) - find by class since it's a div
      const overlay = document.querySelector('.fixed.inset-0.z-50.bg-black\\/80')
      if (overlay) {
        await user.click(overlay)
      }

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('maintains focus within dialog when opened', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      // Focus should be on a focusable element within the dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toHaveFocus()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()

      const title = screen.getByText('Test Dialog')
      expect(title).toHaveAttribute('id')
      expect(dialog).toHaveAttribute('aria-labelledby', title.id)

      const description = screen.getByText('This is a test dialog for testing purposes.')
      expect(description).toHaveAttribute('id')
      expect(dialog).toHaveAttribute('aria-describedby', description.id)
    })

    it('announces dialog to screen readers', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()

      // Check that the dialog has proper role and attributes
      expect(dialog).toHaveAttribute('role', 'dialog')
    })

    it('provides proper focus management', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      // Focus should be on the dialog
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveFocus()

      // Tab through dialog elements
      await user.tab()
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /confirm/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: /close/i })).toHaveFocus()
    })

    it('supports keyboard navigation', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      // Navigate with arrow keys
      await user.keyboard('{Tab}')
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus()

      await user.keyboard('{ArrowRight}')
      expect(screen.getByRole('button', { name: /confirm/i })).toHaveFocus()
    })
  })

  describe('Dialog State Management', () => {
    it('handles controlled dialog state', async () => {
      const ControlledDialog = () => {
        const [open, setOpen] = React.useState(false)

        return (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}>Open</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Controlled Dialog</DialogTitle>
              </DialogHeader>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogContent>
          </Dialog>
        )
      }

      const { user } = render(<ControlledDialog />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /open/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Close dialog
      await user.click(screen.getByRole('button', { name: /close/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('handles uncontrolled dialog state', async () => {
      const UncontrolledDialog = () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Uncontrolled Dialog</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const { user } = render(<UncontrolledDialog />)

      await user.click(screen.getByRole('button', { name: /open/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('renders efficiently', () => {
      const startTime = performance.now()
      render(<TestDialog />)
      const endTime = performance.now()

      // Should render within reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('handles rapid open/close cycles', async () => {
      const { user } = render(<TestDialog />)

      const trigger = screen.getByRole('button', { name: /open dialog/i })

      // Rapid open/close cycles
      for (let i = 0; i < 5; i++) {
        await user.click(trigger)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        
        await user.click(screen.getByRole('button', { name: /close/i }))
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
      }
    })

    it('does not cause memory leaks', () => {
      const { unmount } = render(<TestDialog />)
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('handles dialog with no content', async () => {
      const EmptyDialog = () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Empty</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Empty Dialog</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const { user } = render(<EmptyDialog />)

      await user.click(screen.getByRole('button', { name: /open empty/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('handles dialog with very long content', async () => {
      const LongContentDialog = () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Long</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Long Content Dialog</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {Array.from({ length: 100 }, (_, i) => (
                <p key={i}>This is line {i + 1} of very long content.</p>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )

      const { user } = render(<LongContentDialog />)

      await user.click(screen.getByRole('button', { name: /open long/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('This is line 1 of very long content.')).toBeInTheDocument()
    })

    it('handles dialog with special characters in content', async () => {
      const SpecialCharsDialog = () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Special</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Special Characters: !@#$%^&*()</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>Content with special chars: &lt;&gt;&amp;&quot;&apos;</p>
            </div>
          </DialogContent>
        </Dialog>
      )

      const { user } = render(<SpecialCharsDialog />)

      await user.click(screen.getByRole('button', { name: /open special/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Special Characters: !@#$%^&*()')).toBeInTheDocument()
    })

    it('handles multiple dialogs', async () => {
      const MultipleDialogs = () => (
        <div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Dialog 1</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>First Dialog</DialogTitle>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Dialog 2</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Second Dialog</DialogTitle>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      )

      const { user } = render(<MultipleDialogs />)

      // Open first dialog
      await user.click(screen.getByRole('button', { name: /dialog 1/i }))
      expect(screen.getByText('First Dialog')).toBeInTheDocument()

      // Close first dialog
      await user.click(screen.getByRole('button', { name: /close/i }))
      await waitFor(() => {
        expect(screen.queryByText('First Dialog')).not.toBeInTheDocument()
      })

      // Open second dialog
      await user.click(screen.getByRole('button', { name: /dialog 2/i }))
      expect(screen.getByText('Second Dialog')).toBeInTheDocument()
    })
  })

  describe('Integration with UI Components', () => {
    it('works with Button component', async () => {
      const { user } = render(<TestDialog />)

      await user.click(screen.getByRole('button', { name: /open dialog/i }))

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    it('works with form elements inside dialog', async () => {
      const FormDialog = () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Form</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Form Dialog</DialogTitle>
            </DialogHeader>
            <form>
              <input type="text" placeholder="Enter text" />
              <button type="submit">Submit</button>
            </form>
          </DialogContent>
        </Dialog>
      )

      const { user } = render(<FormDialog />)

      await user.click(screen.getByRole('button', { name: /open form/i }))

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    })
  })
})

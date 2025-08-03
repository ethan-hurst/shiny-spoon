import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'

describe('Input Component', () => {
  it('should render as an input element', () => {
    render(<Input placeholder="Enter text" />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('should apply custom className', () => {
    render(<Input className="custom-class" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-class')
  })

  it('should handle different input types', () => {
    const { rerender } = render(<Input type="email" placeholder="Email" />)
    let input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'email')

    rerender(<Input type="password" placeholder="Password" />)
    input = screen.getByDisplayValue('')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('should handle user input', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Enter text" />)
    const input = screen.getByRole('textbox')

    await user.type(input, 'Hello World')
    expect(input).toHaveValue('Hello World')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled" />)
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('should not accept input when disabled', async () => {
    const user = userEvent.setup()
    render(<Input disabled placeholder="Disabled" />)
    const input = screen.getByRole('textbox')

    await user.type(input, 'test')
    expect(input).toHaveValue('')
  })

  it('should forward ref correctly', () => {
    const ref = jest.fn()
    render(<Input ref={ref} placeholder="Test" />)
    expect(ref).toHaveBeenCalled()
  })

  it('should pass through additional props', () => {
    render(
      <Input
        data-testid="custom-input"
        aria-label="Custom input"
        placeholder="Test"
      />
    )
    const input = screen.getByTestId('custom-input')
    expect(input).toHaveAttribute('aria-label', 'Custom input')
  })

  it('should have proper accessibility attributes', () => {
    render(<Input placeholder="Accessible input" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', 'Accessible input')
  })

  it('should handle focus management', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Focusable" />)
    const input = screen.getByRole('textbox')

    await user.tab()
    expect(input).toHaveFocus()
  })

  it('should handle keyboard interactions', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Keyboard test" />)
    const input = screen.getByRole('textbox')

    await user.tab()
    await user.keyboard('Hello')
    expect(input).toHaveValue('Hello')
  })

  it('should handle controlled input', () => {
    const handleChange = jest.fn()
    render(<Input value="controlled" onChange={handleChange} />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('controlled')
  })

  it('should handle placeholder text', () => {
    render(<Input placeholder="Enter your name" />)
    const input = screen.getByPlaceholderText('Enter your name')
    expect(input).toBeInTheDocument()
  })

  it('should handle required attribute', () => {
    render(<Input required placeholder="Required field" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('required')
  })

  it('should handle min and max attributes', () => {
    render(<Input type="number" min="0" max="100" placeholder="Number" />)
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('max', '100')
  })

  it('should handle pattern attribute', () => {
    render(<Input pattern="[A-Za-z]{3}" placeholder="Pattern test" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('pattern', '[A-Za-z]{3}')
  })

  it('should handle autocomplete attribute', () => {
    render(<Input autoComplete="email" placeholder="Email" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'email')
  })

  it('should handle form integration', () => {
    render(
      <form>
        <Input name="username" placeholder="Username" />
      </form>
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('name', 'username')
  })
})

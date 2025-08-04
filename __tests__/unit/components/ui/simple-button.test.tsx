import React from 'react'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Simple Button Test', () => {
  it('renders a basic button', () => {
    render(<Button>Click me</Button>)
    
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it('renders with default styling', () => {
    render(<Button>Default Button</Button>)
    
    const button = screen.getByRole('button', { name: /default button/i })
    expect(button).toHaveClass('bg-primary')
  })
}) 
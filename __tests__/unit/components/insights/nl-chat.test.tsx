import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NaturalLanguageChat } from '@/components/features/insights/nl-chat'
import { useChat } from 'ai/react'

// Mock the useChat hook
jest.mock('ai/react', () => ({
  useChat: jest.fn()
}))

describe('NaturalLanguageChat', () => {
  const mockHandleSubmit = jest.fn()
  const mockHandleInputChange = jest.fn()
  
  const defaultMockChat = {
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I'm your AI assistant. I can help you understand your inventory data, identify trends, and make recommendations. What would you like to know?"
      }
    ],
    input: '',
    handleInputChange: mockHandleInputChange,
    handleSubmit: mockHandleSubmit,
    isLoading: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useChat as jest.Mock).mockReturnValue(defaultMockChat)
  })

  it('should render the chat interface with welcome message', () => {
    render(<NaturalLanguageChat organizationId="org123" />)
    
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    expect(screen.getByText(/Hello! I'm your AI assistant/)).toBeInTheDocument()
  })

  it('should show suggested questions when only welcome message exists', () => {
    render(<NaturalLanguageChat organizationId="org123" />)
    
    expect(screen.getByText('Suggested questions:')).toBeInTheDocument()
    expect(screen.getByText('What products should I reorder soon?')).toBeInTheDocument()
    expect(screen.getByText('Are there any pricing opportunities?')).toBeInTheDocument()
  })

  it('should handle user input', async () => {
    const user = userEvent.setup()
    
    render(<NaturalLanguageChat organizationId="org123" />)
    
    const input = screen.getByPlaceholderText('Ask me anything about your business...')
    await user.type(input, 'What is my inventory status?')
    
    expect(mockHandleInputChange).toHaveBeenCalled()
  })

  it('should handle form submission', async () => {
    const user = userEvent.setup()
    mockHandleSubmit.mockImplementation((e) => e.preventDefault())
    
    render(<NaturalLanguageChat organizationId="org123" />)
    
    const input = screen.getByPlaceholderText('Ask me anything about your business...')
    const submitButton = screen.getByRole('button', { name: /send/i })
    
    await user.type(input, 'Test question')
    await user.click(submitButton)
    
    expect(mockHandleSubmit).toHaveBeenCalled()
  })

  it('should handle suggested question click', async () => {
    const user = userEvent.setup()
    mockHandleSubmit.mockImplementation((e) => e.preventDefault())
    
    render(<NaturalLanguageChat organizationId="org123" />)
    
    const suggestedButton = screen.getByText('What products should I reorder soon?')
    await user.click(suggestedButton)
    
    expect(mockHandleInputChange).toHaveBeenCalled()
    expect(mockHandleSubmit).toHaveBeenCalled()
  })

  it('should show loading state', () => {
    ;(useChat as jest.Mock).mockReturnValue({
      ...defaultMockChat,
      isLoading: true
    })
    
    render(<NaturalLanguageChat organizationId="org123" />)
    
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    expect(screen.getByPlaceholderText('Ask me anything about your business...')).toBeDisabled()
    
    // Should show loading indicator in chat
    const loadingIndicator = screen.getByTestId('loading-indicator')
    expect(loadingIndicator).toBeInTheDocument()
  })

  it('should render conversation with multiple messages', () => {
    ;(useChat as jest.Mock).mockReturnValue({
      ...defaultMockChat,
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello!'
        },
        {
          id: 'user1',
          role: 'user',
          content: 'What is my inventory status?'
        },
        {
          id: 'assistant1',
          role: 'assistant',
          content: 'Your current inventory shows 5 products are low on stock.'
        }
      ]
    })
    
    render(<NaturalLanguageChat organizationId="org123" />)
    
    expect(screen.getByText('Hello!')).toBeInTheDocument()
    expect(screen.getByText('What is my inventory status?')).toBeInTheDocument()
    expect(screen.getByText('Your current inventory shows 5 products are low on stock.')).toBeInTheDocument()
  })

  it('should hide suggested questions when conversation has started', () => {
    ;(useChat as jest.Mock).mockReturnValue({
      ...defaultMockChat,
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello!'
        },
        {
          id: 'user1',
          role: 'user',
          content: 'Test message'
        }
      ]
    })
    
    render(<NaturalLanguageChat organizationId="org123" />)
    
    expect(screen.queryByText('Suggested questions:')).not.toBeInTheDocument()
  })

  it('should apply correct styling to user and assistant messages', () => {
    ;(useChat as jest.Mock).mockReturnValue({
      ...defaultMockChat,
      messages: [
        {
          id: 'user1',
          role: 'user',
          content: 'User message'
        },
        {
          id: 'assistant1',
          role: 'assistant',
          content: 'Assistant message'
        }
      ]
    })
    
    render(<NaturalLanguageChat organizationId="org123" />)
    
    const userMessage = screen.getByText('User message').closest('div')
    const assistantMessage = screen.getByText('Assistant message').closest('div')
    
    expect(userMessage).toHaveClass('bg-primary')
    expect(assistantMessage).toHaveClass('bg-muted')
  })

  it('should pass organizationId to chat API', () => {
    render(<NaturalLanguageChat organizationId="org123" />)
    
    expect(useChat).toHaveBeenCalledWith({
      api: '/api/ai/chat',
      body: {
        organizationId: 'org123'
      },
      initialMessages: expect.any(Array)
    })
  })
})
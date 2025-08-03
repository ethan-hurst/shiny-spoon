import React, { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations)

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add any additional options here
}

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <div data-testid="test-provider">{children}</div>
    </QueryClientProvider>
  )
}

const customRender = (ui: ReactElement, options?: CustomRenderOptions) => {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Accessibility testing helper
export const testAccessibility = async (component: ReactElement) => {
  const { container } = customRender(component)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
  return results
}

// User interaction helper with proper setup
export const createUser = () => userEvent.setup()

// Common test patterns
export const testComponentRenders = (
  component: ReactElement,
  expectedText?: string
) => {
  it('should render without crashing', () => {
    customRender(component)
    if (expectedText) {
      expect(screen.getByText(expectedText)).toBeInTheDocument()
    }
  })
}

export const testComponentAccessibility = (component: ReactElement) => {
  it('should meet accessibility standards', async () => {
    await testAccessibility(component)
  })
}

export const testComponentInteractions = (
  component: ReactElement,
  interactions: Array<{
    action: () => Promise<void>
    assertion: () => void
    description: string
  }>
) => {
  it('should handle user interactions correctly', async () => {
    customRender(component)

    for (const { action, assertion, description } of interactions) {
      await action()
      assertion()
    }
  })
}

// Form testing helpers
export const testFormSubmission = async (
  formComponent: ReactElement,
  submitData: Record<string, any>,
  expectedBehavior: () => void
) => {
  const user = createUser()
  customRender(formComponent)

  // Fill form fields
  for (const [fieldName, value] of Object.entries(submitData)) {
    const field = screen.getByLabelText(new RegExp(fieldName, 'i'))
    await user.type(field, value.toString())
  }

  // Submit form
  const submitButton = screen.getByRole('button', {
    name: /submit|save|create/i,
  })
  await user.click(submitButton)

  // Verify expected behavior
  expectedBehavior()
}

// API testing helpers
export const mockApiResponse = (url: string, response: any) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response),
    })
  ) as jest.Mock
}

export const mockApiError = (url: string, error: any) => {
  global.fetch = jest.fn(() => Promise.reject(error)) as jest.Mock
}

// Error boundary testing
export const testErrorBoundary = (
  component: ReactElement,
  errorTrigger: () => void,
  expectedFallback?: string
) => {
  it('should handle errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    customRender(component)

    // Trigger error
    errorTrigger()

    if (expectedFallback) {
      expect(screen.getByText(expectedFallback)).toBeInTheDocument()
    }

    consoleSpy.mockRestore()
  })
}

// Performance testing helpers
export const testComponentPerformance = (
  component: ReactElement,
  maxRenderTime = 100
) => {
  it('should render within performance budget', () => {
    const startTime = performance.now()
    customRender(component)
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(maxRenderTime)
  })
}

// Snapshot testing with better error messages
export const testComponentSnapshot = (
  component: ReactElement,
  description = 'should match snapshot'
) => {
  it(description, () => {
    const { container } = customRender(component)
    expect(container).toMatchSnapshot()
  })
}

// Custom matchers for common assertions
export const expectElementToBeVisible = (element: HTMLElement) => {
  expect(element).toBeVisible()
  expect(element).not.toHaveAttribute('aria-hidden', 'true')
}

export const expectElementToBeHidden = (element: HTMLElement) => {
  expect(element).not.toBeVisible()
  expect(element).toHaveAttribute('aria-hidden', 'true')
}

export const expectElementToBeFocusable = (element: HTMLElement) => {
  expect(element).toHaveAttribute('tabindex', expect.any(String))
  expect(element).not.toHaveAttribute('tabindex', '-1')
}

export const expectElementToBeDisabled = (element: HTMLElement) => {
  expect(element).toBeDisabled()
  expect(element).toHaveAttribute('aria-disabled', 'true')
}

// Async testing helpers
export const waitForElementToBeRemoved = async (element: HTMLElement) => {
  await new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.contains(element)) {
        observer.disconnect()
        resolve(undefined)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

// Mock cleanup helper
export const cleanupMocks = () => {
  jest.clearAllMocks()
  jest.resetAllMocks()
}

// Test data factories
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
})

export const createTestProduct = (overrides = {}) => ({
  id: 'test-product-id',
  name: 'Test Product',
  price: 99.99,
  ...overrides,
})

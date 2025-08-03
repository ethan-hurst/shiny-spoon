import { NextApiRequest, NextApiResponse } from 'next'

export type ApiMiddleware = (
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void | Promise<void>
) => void | Promise<void>

/**
 * Compose multiple middleware functions into a single middleware
 */
export function compose(...middlewares: ApiMiddleware[]): ApiMiddleware {
  return async (req: NextApiRequest, res: NextApiResponse, finalNext: () => void) => {
    let index = -1
    
    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error('next() called multiple times')
      }
      
      index = i
      
      if (i === middlewares.length) {
        return finalNext()
      }
      
      const middleware = middlewares[i]
      
      try {
        await middleware(req, res, () => dispatch(i + 1))
      } catch (error) {
        console.error('Middleware error:', error)
        throw error
      }
    }
    
    return dispatch(0)
  }
}

/**
 * Run middleware and handle errors
 */
export async function runMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  middleware: ApiMiddleware
): Promise<void> {
  return new Promise((resolve, reject) => {
    middleware(req, res, (result?: any) => {
      if (result instanceof Error) {
        return reject(result)
      }
      return resolve(result)
    })
  })
}

/**
 * Create an API handler with middleware
 */
export function withMiddleware(
  handler: (req: NextApiRequest, res: NextApiResponse) => void | Promise<void>,
  ...middlewares: ApiMiddleware[]
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Run all middleware
      await runMiddleware(req, res, compose(...middlewares))
      
      // If response was already sent by middleware, don't run handler
      if (res.writableEnded) {
        return
      }
      
      // Run the actual handler
      await handler(req, res)
    } catch (error) {
      console.error('API handler error:', error)
      
      // If response wasn't sent yet, send error response
      if (!res.writableEnded) {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred'
          }
        })
      }
    }
  }
}
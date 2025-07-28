/**
 * TestApi Authentication
 * Handles authentication for TestApi API
 */

import type { TestApiConfig } from '@/types/test-api.types'

export class TestApiAuth {
  private config: TestApiConfig
  private token: string | null = null
  private tokenExpiry: number = 0

  constructor(config: TestApiConfig) {
    this.config = config
  }

  /**
   * Authenticate with TestApi
   */
  async authenticate(): Promise<boolean> {
    try {
      // For API key authentication, test the key
      const response = await this.makeRequest('/ping', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`)
      }

      this.token = this.config.apiKey
      this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

      return true
    } catch (error) {
      console.error('TestApi authentication failed:', error)
      throw error
    }
  }

  /**
   * Get valid authentication token
   */
  async getValidToken(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      await this.authenticate()
    }

    if (!this.token) {
      throw new Error('Failed to obtain valid authentication token')
    }

    return this.token
  }


  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null && Date.now() < this.tokenExpiry
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.token) {
      throw new Error('Not authenticated. Call authenticate() first.')
    }

    return {
      'Authorization': `Bearer ${this.token}`,
    }
  }

  /**
   * Logout and clear tokens
   */
  logout(): void {
    this.token = null
    this.tokenExpiry = 0
  }

  /**
   * Make HTTP request to TestApi API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'TruthSource/1.0',
        ...options.headers
      }
    })

    return response
  }
}

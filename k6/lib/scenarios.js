import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, getAuthHeaders, tags, validateResponse } from '../config/base.js'

// Browse products with pagination
export function browseProducts(token) {
  const page = Math.floor(Math.random() * 10) + 1
  const limit = [10, 20, 50][Math.floor(Math.random() * 3)]
  
  const response = http.get(
    `${BASE_URL}/api/products?page=${page}&limit=${limit}`,
    {
      headers: getAuthHeaders(token),
      tags: tags.browse,
    }
  )
  
  check(response, validateResponse(response))
  
  if (response.status === 200) {
    const data = JSON.parse(response.body)
    check(data, {
      'has products': (d) => d.data && Array.isArray(d.data),
      'has pagination': (d) => d.pagination && d.pagination.total >= 0,
    })
  }
  
  return response
}

// Search products with various filters
export function searchProducts(token) {
  const searchQueries = [
    { q: 'laptop', category: 'electronics' },
    { q: 'office', minPrice: 50, maxPrice: 500 },
    { q: 'wireless', inStock: true },
    { minPrice: 100, maxPrice: 1000, category: 'furniture' },
    { q: 'premium', sortBy: 'price_desc' },
  ]
  
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)]
  const params = new URLSearchParams(query)
  
  const response = http.get(
    `${BASE_URL}/api/products/search?${params}`,
    {
      headers: getAuthHeaders(token),
      tags: tags.search,
    }
  )
  
  check(response, validateResponse(response))
  
  return response
}

// Create an order with random products
export function createOrder(token) {
  // First, get some products
  const productsResponse = http.get(
    `${BASE_URL}/api/products?limit=20`,
    { headers: getAuthHeaders(token) }
  )
  
  if (productsResponse.status !== 200) {
    return productsResponse
  }
  
  const products = JSON.parse(productsResponse.body).data
  if (!products || products.length === 0) {
    return productsResponse
  }
  
  // Select random products for the order
  const itemCount = Math.floor(Math.random() * 3) + 1
  const orderItems = []
  
  for (let i = 0; i < itemCount; i++) {
    const product = products[Math.floor(Math.random() * products.length)]
    orderItems.push({
      product_id: product.id,
      quantity: Math.floor(Math.random() * 5) + 1,
      price: product.price,
    })
  }
  
  const orderData = {
    customer_id: `customer-${Math.floor(Math.random() * 1000)}`,
    items: orderItems,
    shipping_address: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'TC',
      postal_code: '12345',
      country: 'US',
    },
  }
  
  const response = http.post(
    `${BASE_URL}/api/orders`,
    JSON.stringify(orderData),
    {
      headers: getAuthHeaders(token),
      tags: tags.order,
    }
  )
  
  check(response, validateResponse(response, 201))
  
  return response
}

// Generate inventory report
export function generateReport(token) {
  const reportTypes = [
    'inventory-summary',
    'low-stock',
    'product-performance',
    'order-summary',
    'revenue-analysis',
  ]
  
  const reportType = reportTypes[Math.floor(Math.random() * reportTypes.length)]
  const params = {
    type: reportType,
    format: 'json',
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    dateTo: new Date().toISOString(),
  }
  
  const response = http.get(
    `${BASE_URL}/api/reports/generate?${new URLSearchParams(params)}`,
    {
      headers: getAuthHeaders(token),
      tags: tags.report,
      timeout: '30s', // Reports can take longer
    }
  )
  
  check(response, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'response time acceptable': (r) => r.timings.duration < 30000,
  })
  
  return response
}

// Perform bulk operations
export function performBulkOperation(token) {
  const operations = [
    // Bulk product update
    () => {
      const updates = []
      for (let i = 0; i < 50; i++) {
        updates.push({
          id: `product-${Math.floor(Math.random() * 1000)}`,
          price: Math.floor(Math.random() * 900) + 100,
        })
      }
      
      return http.patch(
        `${BASE_URL}/api/products/bulk`,
        JSON.stringify({ updates }),
        {
          headers: getAuthHeaders(token),
          tags: tags.bulk,
        }
      )
    },
    
    // Bulk inventory adjustment
    () => {
      const adjustments = []
      for (let i = 0; i < 100; i++) {
        adjustments.push({
          product_id: `product-${Math.floor(Math.random() * 1000)}`,
          warehouse_id: `warehouse-${Math.floor(Math.random() * 5)}`,
          adjustment: Math.floor(Math.random() * 200) - 100,
          reason: 'Load test adjustment',
        })
      }
      
      return http.post(
        `${BASE_URL}/api/inventory/bulk-adjust`,
        JSON.stringify({ adjustments }),
        {
          headers: getAuthHeaders(token),
          tags: tags.bulk,
          timeout: '60s',
        }
      )
    },
  ]
  
  const operation = operations[Math.floor(Math.random() * operations.length)]
  const response = operation()
  
  check(response, {
    'bulk operation successful': (r) => r.status === 200 || r.status === 202,
    'response time under 60s': (r) => r.timings.duration < 60000,
  })
  
  return response
}

// Login helper for different tiers
export function loginUser(email, password = 'password123') {
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  )
  
  if (response.status === 200) {
    const data = JSON.parse(response.body)
    return data.token || data.access_token
  }
  
  console.error(`Login failed for ${email}: ${response.status}`)
  return null
}
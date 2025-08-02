import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Counter, Trend } from 'k6/metrics'
import { BASE_URL, getAuthHeaders } from '../config/base.js'
import { loginUser } from '../lib/scenarios.js'

// Flash sale specific metrics
const orderSuccess = new Rate('flash_sale_order_success')
const stockOutRate = new Rate('stock_out_rate')
const ordersByProduct = new Counter('orders_by_product')
const checkoutTime = new Trend('checkout_time')
const inventoryErrors = new Counter('inventory_errors')

// Shared state for flash sale
const flashSaleProducts = [
  { id: 'flash-product-001', name: 'Limited Edition Laptop', stock: 100 },
  { id: 'flash-product-002', name: 'Exclusive Headphones', stock: 500 },
  { id: 'flash-product-003', name: 'Special Bundle Deal', stock: 50 },
]

export const options = {
  stages: [
    // Pre-sale browsing
    { duration: '30s', target: 100 },    
    
    // Flash sale starts - massive spike
    { duration: '5s', target: 2000 },    // Instant 20x spike
    { duration: '5m', target: 2000 },    // Sustained high load
    
    // Gradual decline as stock runs out
    { duration: '2m', target: 1000 },    
    { duration: '2m', target: 500 },     
    { duration: '1m', target: 100 },     
    
    { duration: '30s', target: 0 },      
  ],
  thresholds: {
    flash_sale_order_success: ['rate>0.7'],     // 70% should get orders
    stock_out_rate: ['rate<0.5'],               // Less than 50% stock-outs
    checkout_time: ['p(95)<3000'],              // 95% checkout under 3s
    http_req_duration: ['p(95)<2000'],          // General response time
  },
}

export function setup() {
  console.log('Setting up flash sale simulation...')
  console.log('Products on sale:', flashSaleProducts)
  
  // Create eager shoppers
  const tokens = []
  for (let i = 0; i < 50; i++) {
    const token = loginUser(`flash-shopper-${i}@example.com`)
    if (token) tokens.push(token)
  }
  
  return { 
    tokens,
    startTime: Date.now(),
    salesData: {
      attempts: 0,
      successful: 0,
      stockOuts: 0,
      errors: 0,
    }
  }
}

export default function(data) {
  const elapsed = (Date.now() - data.startTime) / 1000
  const isFlashSaleActive = elapsed > 30 && elapsed < 450 // 30s to 7.5m
  
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)]
  
  if (!isFlashSaleActive) {
    // Normal browsing before/after sale
    browseFlashSalePreview(token)
    sleep(Math.random() * 2 + 1)
    return
  }
  
  // Flash sale behavior - aggressive purchasing
  const behavior = Math.random()
  
  if (behavior < 0.7) {
    // 70% go straight for purchase
    attemptFlashPurchase(token, data)
  } else if (behavior < 0.9) {
    // 20% browse then purchase
    browseFlashSalePreview(token)
    sleep(0.5)
    attemptFlashPurchase(token, data)
  } else {
    // 10% just browse (window shoppers)
    browseFlashSalePreview(token)
  }
  
  // Minimal think time during flash sale
  sleep(Math.random() * 0.2)
}

function browseFlashSalePreview(token) {
  const response = http.get(
    `${BASE_URL}/api/products/flash-sale`,
    {
      headers: getAuthHeaders(token),
      tags: { name: 'browse-flash-sale' },
    }
  )
  
  check(response, {
    'flash sale page loads': (r) => r.status === 200,
  })
}

function attemptFlashPurchase(token, data) {
  // Select a product (weighted by popularity)
  const productWeights = [0.5, 0.3, 0.2] // First product most popular
  const random = Math.random()
  let selectedProduct
  let cumWeight = 0
  
  for (let i = 0; i < flashSaleProducts.length; i++) {
    cumWeight += productWeights[i]
    if (random <= cumWeight) {
      selectedProduct = flashSaleProducts[i]
      break
    }
  }
  
  const startTime = Date.now()
  
  // Add to cart
  const cartResponse = http.post(
    `${BASE_URL}/api/cart/add`,
    JSON.stringify({
      product_id: selectedProduct.id,
      quantity: Math.random() < 0.8 ? 1 : 2, // 80% buy 1, 20% try for 2
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'add-to-cart-flash' },
    }
  )
  
  if (cartResponse.status !== 200) {
    data.salesData.errors++
    return
  }
  
  // Immediate checkout (no browsing during flash sale)
  const checkoutResponse = http.post(
    `${BASE_URL}/api/orders/quick-checkout`,
    JSON.stringify({
      payment_method: 'saved_card',
      shipping_method: 'express',
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'flash-checkout' },
    }
  )
  
  const duration = Date.now() - startTime
  checkoutTime.add(duration)
  
  data.salesData.attempts++
  ordersByProduct.add(1, { product: selectedProduct.name })
  
  const isSuccess = check(checkoutResponse, {
    'order placed': (r) => r.status === 201,
    'out of stock': (r) => r.status === 409,
    'server error': (r) => r.status >= 500,
  })
  
  if (checkoutResponse.status === 201) {
    orderSuccess.add(1)
    data.salesData.successful++
  } else {
    orderSuccess.add(0)
    
    if (checkoutResponse.status === 409) {
      stockOutRate.add(1)
      data.salesData.stockOuts++
      
      // Try another product if out of stock
      if (Math.random() < 0.5) {
        const otherProducts = flashSaleProducts.filter(p => p.id !== selectedProduct.id)
        if (otherProducts.length > 0) {
          selectedProduct = otherProducts[Math.floor(Math.random() * otherProducts.length)]
          attemptFlashPurchase(token, data) // Recursive retry
        }
      }
    } else if (checkoutResponse.status >= 500) {
      inventoryErrors.add(1)
      data.salesData.errors++
    } else {
      stockOutRate.add(0)
    }
  }
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000
  const { salesData } = data
  
  console.log('\n=== Flash Sale Summary ===')
  console.log(`Sale duration: ${duration.toFixed(2)} seconds`)
  console.log(`Total purchase attempts: ${salesData.attempts}`)
  console.log(`Successful orders: ${salesData.successful} (${(salesData.successful / salesData.attempts * 100).toFixed(1)}%)`)
  console.log(`Stock-outs: ${salesData.stockOuts} (${(salesData.stockOuts / salesData.attempts * 100).toFixed(1)}%)`)
  console.log(`Errors: ${salesData.errors}`)
  console.log('\n========================')
}
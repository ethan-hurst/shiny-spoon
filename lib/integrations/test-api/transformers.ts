/**
 * TestApi Data Transformers
 * Transform data between TestApi and TruthSource formats
 */

import type { 
  TestApiProduct,
  TestApiCustomer,
  TestApiOrder 
} from '@/types/test-api.types'

// Transform product from TestApi to TruthSource format
export function transformProduct(externalProduct: TestApiProduct): any {
  return {
    external_id: externalProduct.id,
    name: externalProduct.name || externalProduct.title,
    description: externalProduct.description,
    sku: externalProduct.sku || externalProduct.itemId,
    price: parseFloat(externalProduct.price?.toString() || '0'),
    inventory_quantity: parseInt(externalProduct.stock?.toString() || '0'),
    status: externalProduct.active ? 'active' : 'inactive',
    external_data: externalProduct,
    last_synced_at: new Date().toISOString()
  }
}

// Transform customer from TestApi to TruthSource format
export function transformCustomer(externalCustomer: TestApiCustomer): any {
  return {
    external_id: externalCustomer.id,
    name: externalCustomer.name || externalCustomer.companyName,
    email: externalCustomer.email,
    phone: externalCustomer.phone,
    address: {
      line1: externalCustomer.address?.line1,
      line2: externalCustomer.address?.line2,
      city: externalCustomer.address?.city,
      state: externalCustomer.address?.state,
      postal_code: externalCustomer.address?.postalCode,
      country: externalCustomer.address?.country
    },
    external_data: externalCustomer,
    last_synced_at: new Date().toISOString()
  }
}

// Transform order from TestApi to TruthSource format
export function transformOrder(externalOrder: TestApiOrder): any {
  return {
    external_id: externalOrder.id,
    order_number: externalOrder.orderNumber || externalOrder.number,
    customer_external_id: externalOrder.customerId,
    status: externalOrder.status,
    total_amount: parseFloat(externalOrder.total?.toString() || '0'),
    currency: externalOrder.currency || 'USD',
    order_date: externalOrder.createdAt || externalOrder.orderDate,
    line_items: externalOrder.items?.map(item => ({
      product_external_id: item.productId,
      quantity: parseInt(item.quantity?.toString() || '0'),
      unit_price: parseFloat(item.price?.toString() || '0'),
      total_price: parseFloat(item.total?.toString() || '0')
    })) || [],
    external_data: externalOrder,
    last_synced_at: new Date().toISOString()
  }
}

// Transform TruthSource product to TestApi format (for updates)
export function transformProductToExternal(product: any): Partial<TestApiProduct> {
  return {
    id: product.external_id,
    name: product.name,
    description: product.description,
    sku: product.sku,
    price: product.price,
    stock: product.inventory_quantity,
    active: product.status === 'active'
  }
}

// Data validation helpers
export function validateProductData(data: any): boolean {
  return !!(data?.name && data?.sku)
}

export function validateCustomerData(data: any): boolean {
  return !!(data?.name && data?.email)
}

export function validateOrderData(data: any): boolean {
  return !!(data?.orderNumber && data?.customerId)
}

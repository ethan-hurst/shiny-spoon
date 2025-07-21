import type { InventoryImportRow, InventoryExportRow } from '@/types/inventory.types'

// CSV Templates for different use cases
export const CSV_TEMPLATES = {
  // Basic inventory update template
  inventoryUpdate: `SKU,Warehouse Code,Quantity,Reason,Notes
PROD-001,WH-MAIN,100,cycle_count,Monthly inventory count
PROD-002,WH-MAIN,50,cycle_count,Monthly inventory count
PROD-003,WH-EAST,200,cycle_count,Monthly inventory count
PROD-004,WH-WEST,75,damage,3 units damaged in shipping
PROD-005,WH-MAIN,0,theft,Reported theft incident`,

  // Bulk inventory adjustment template
  inventoryAdjustment: `SKU,Warehouse Code,Quantity,Reason,Notes
WIDGET-A,MAIN,500,found,Found additional stock in back storage
GADGET-B,EAST,250,transfer_in,Transferred from West warehouse
TOOL-C,WEST,150,transfer_out,Transferred to East warehouse
PART-D,MAIN,1000,other,Annual stock reconciliation
ITEM-E,EAST,0,damage,Water damage - total loss`,

  // Initial inventory setup template
  inventorySetup: `SKU,Warehouse Code,Quantity
PROD-001,WH-MAIN,1000
PROD-001,WH-EAST,500
PROD-001,WH-WEST,750
PROD-002,WH-MAIN,2000
PROD-002,WH-EAST,1500
PROD-003,WH-MAIN,500
PROD-004,WH-WEST,300`,

  // Multi-warehouse template
  multiWarehouse: `SKU,Warehouse Code,Quantity,Reason
SKU-123,WH-01,100,cycle_count
SKU-123,WH-02,150,cycle_count
SKU-123,WH-03,200,cycle_count
SKU-456,WH-01,50,cycle_count
SKU-456,WH-02,75,cycle_count
SKU-789,WH-01,300,cycle_count`,
}

// Column headers for exports
export const EXPORT_COLUMNS = {
  inventory: [
    { key: 'sku' as keyof InventoryExportRow, header: 'SKU' },
    { key: 'product_name' as keyof InventoryExportRow, header: 'Product Name' },
    { key: 'warehouse' as keyof InventoryExportRow, header: 'Warehouse' },
    { key: 'quantity' as keyof InventoryExportRow, header: 'Quantity' },
    { key: 'reserved_quantity' as keyof InventoryExportRow, header: 'Reserved' },
    { key: 'available_quantity' as keyof InventoryExportRow, header: 'Available' },
    { key: 'reorder_point' as keyof InventoryExportRow, header: 'Reorder Point' },
    { key: 'reorder_quantity' as keyof InventoryExportRow, header: 'Reorder Quantity' },
    { key: 'last_updated' as keyof InventoryExportRow, header: 'Last Updated' },
  ],
}

// Template descriptions for UI
export const TEMPLATE_DESCRIPTIONS = {
  inventoryUpdate: {
    name: 'Basic Inventory Update',
    description: 'Standard template for updating inventory quantities with reasons',
    useCase: 'Regular inventory counts and adjustments',
  },
  inventoryAdjustment: {
    name: 'Inventory Adjustments',
    description: 'Template for various types of inventory adjustments',
    useCase: 'Recording damages, transfers, and other adjustments',
  },
  inventorySetup: {
    name: 'Initial Setup',
    description: 'Simple template for initial inventory setup',
    useCase: 'Setting up inventory for the first time',
  },
  multiWarehouse: {
    name: 'Multi-Warehouse Update',
    description: 'Template for updating multiple warehouses',
    useCase: 'Updating the same products across different locations',
  },
}

// Helper function to download a template
export function downloadTemplate(templateKey: keyof typeof CSV_TEMPLATES, filename?: string) {
  const template = CSV_TEMPLATES[templateKey]
  const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename || `inventory_${templateKey}_template.csv`)
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up immediately to prevent memory leaks
  URL.revokeObjectURL(url)
}

// Generate custom template based on products and warehouses
export function generateCustomTemplate(
  products: { sku: string; name: string }[],
  warehouses: { code: string; name: string }[],
  includeAllCombinations: boolean = false
): string {
  const headers = ['SKU', 'Product Name', 'Warehouse Code', 'Warehouse Name', 'Quantity', 'Reason', 'Notes']
  const rows: string[][] = [headers]

  if (includeAllCombinations) {
    // Generate all product-warehouse combinations
    products.forEach(product => {
      warehouses.forEach(warehouse => {
        rows.push([
          product.sku,
          product.name,
          warehouse.code,
          warehouse.name,
          '0', // Default quantity
          'cycle_count',
          ''
        ])
      })
    })
  } else {
    // Just list products with first warehouse
    products.forEach(product => {
      const warehouse = warehouses[0] || { code: '', name: '' }
      rows.push([
        product.sku,
        product.name,
        warehouse.code,
        warehouse.name,
        '0',
        'cycle_count',
        ''
      ])
    })
  }

  // Convert to CSV format
  return rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma or quote
      const escaped = cell.replace(/"/g, '""')
      return cell.includes(',') || cell.includes('"') ? `"${escaped}"` : escaped
    }).join(',')
  ).join('\n')
}

// Validation rules for import
export const IMPORT_RULES = {
  maxRows: 10000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedReasons: [
    'sale',
    'return',
    'damage',
    'theft',
    'found',
    'transfer_in',
    'transfer_out',
    'cycle_count',
    'other'
  ] as const,
  requiredColumns: ['sku', 'warehouse_code', 'quantity'],
  optionalColumns: ['reason', 'notes'],
}

// Sample data generator for testing
export function generateSampleData(count: number): InventoryImportRow[] {
  const warehouses = ['WH-MAIN', 'WH-EAST', 'WH-WEST', 'WH-NORTH', 'WH-SOUTH']
  const reasons = IMPORT_RULES.allowedReasons
  const data: InventoryImportRow[] = []

  for (let i = 1; i <= count; i++) {
    data.push({
      sku: `PROD-${String(i).padStart(3, '0')}`,
      warehouse_code: warehouses[Math.floor(Math.random() * warehouses.length)],
      quantity: Math.floor(Math.random() * 1000),
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      notes: i % 5 === 0 ? `Sample note for item ${i}` : undefined,
    })
  }

  return data
}
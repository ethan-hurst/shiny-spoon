import { Job } from 'bullmq'
import { TenantJob } from '@/lib/queue/distributed-queue'
import { createServerClient } from '@/lib/supabase/server'
import { parse } from 'csv-parse'
import { Readable } from 'stream'

export async function processBulkImport(job: Job<TenantJob>) {
  const { tenantId, data } = job.data
  const { type, fileUrl, mappings } = data

  try {
    const supabase = createServerClient()
    let processed = 0
    let errors: any[] = []

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('imports')
      .download(fileUrl)

    if (downloadError || !fileData) {
      throw new Error('Failed to download import file')
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer())
    
    // Parse CSV
    const records: any[] = []
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    parser.on('readable', function() {
      let record
      while ((record = parser.read()) !== null) {
        records.push(record)
      }
    })

    parser.on('error', function(err) {
      console.error('CSV parse error:', err)
      errors.push({ row: processed, error: err.message })
    })

    // Parse the file
    await new Promise((resolve, reject) => {
      parser.on('end', resolve)
      parser.on('error', reject)
      Readable.from(buffer).pipe(parser)
    })

    const total = records.length
    await job.updateProgress(10)

    // Process records in batches
    const batchSize = 100
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      try {
        switch (type) {
          case 'products':
            await importProducts(supabase, tenantId, batch, mappings)
            break
          case 'inventory':
            await importInventory(supabase, tenantId, batch, mappings)
            break
          case 'customers':
            await importCustomers(supabase, tenantId, batch, mappings)
            break
          default:
            throw new Error(`Unknown import type: ${type}`)
        }
        
        processed += batch.length
      } catch (error: any) {
        errors.push({
          rows: `${i + 1}-${i + batch.length}`,
          error: error.message,
        })
      }

      // Update progress
      const progress = Math.round((processed / total) * 90) + 10
      await job.updateProgress(progress)
    }

    // Save import summary
    await supabase.from('import_jobs').insert({
      organization_id: tenantId,
      type,
      file_url: fileUrl,
      total_records: total,
      processed_records: processed,
      failed_records: errors.length,
      errors: errors.length > 0 ? errors : null,
      completed_at: new Date().toISOString(),
    })

    await job.updateProgress(100)

    return {
      success: true,
      total,
      processed,
      failed: errors.length,
      errors: errors.slice(0, 10), // Return first 10 errors
    }
  } catch (error) {
    console.error('Bulk import error:', error)
    throw error
  }
}

async function importProducts(
  supabase: any,
  tenantId: string,
  records: any[],
  mappings: Record<string, string>
) {
  const products = records.map(record => ({
    organization_id: tenantId,
    name: record[mappings.name || 'name'],
    sku: record[mappings.sku || 'sku'],
    description: record[mappings.description || 'description'],
    category_id: record[mappings.category_id || 'category_id'],
    price: parseFloat(record[mappings.price || 'price']) || 0,
    cost: parseFloat(record[mappings.cost || 'cost']) || 0,
    barcode: record[mappings.barcode || 'barcode'],
    weight: parseFloat(record[mappings.weight || 'weight']) || null,
    dimensions: record[mappings.dimensions || 'dimensions'] || null,
    is_active: record[mappings.is_active || 'is_active'] !== 'false',
  }))

  const { error } = await supabase
    .from('products')
    .upsert(products, { onConflict: 'organization_id,sku' })

  if (error) throw error
}

async function importInventory(
  supabase: any,
  tenantId: string,
  records: any[],
  mappings: Record<string, string>
) {
  // First, get product IDs by SKU
  const skus = records.map(r => r[mappings.sku || 'sku'])
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, sku')
    .eq('organization_id', tenantId)
    .in('sku', skus)

  if (productError) throw productError

  const skuToId = new Map(products.map((p: any) => [p.sku, p.id]))

  const inventory = records
    .filter(record => skuToId.has(record[mappings.sku || 'sku']))
    .map(record => ({
      organization_id: tenantId,
      product_id: skuToId.get(record[mappings.sku || 'sku']),
      warehouse_id: record[mappings.warehouse_id || 'warehouse_id'],
      quantity: parseInt(record[mappings.quantity || 'quantity']) || 0,
      reserved_quantity: parseInt(record[mappings.reserved_quantity || 'reserved_quantity']) || 0,
      reorder_point: parseInt(record[mappings.reorder_point || 'reorder_point']) || null,
      reorder_quantity: parseInt(record[mappings.reorder_quantity || 'reorder_quantity']) || null,
    }))

  const { error } = await supabase
    .from('inventory')
    .upsert(inventory, { onConflict: 'product_id,warehouse_id' })

  if (error) throw error
}

async function importCustomers(
  supabase: any,
  tenantId: string,
  records: any[],
  mappings: Record<string, string>
) {
  const customers = records.map(record => ({
    organization_id: tenantId,
    name: record[mappings.name || 'name'],
    email: record[mappings.email || 'email'],
    phone: record[mappings.phone || 'phone'],
    address: record[mappings.address || 'address'],
    city: record[mappings.city || 'city'],
    state: record[mappings.state || 'state'],
    postal_code: record[mappings.postal_code || 'postal_code'],
    country: record[mappings.country || 'country'],
    tax_id: record[mappings.tax_id || 'tax_id'],
    notes: record[mappings.notes || 'notes'],
  }))

  const { error } = await supabase
    .from('customers')
    .upsert(customers, { onConflict: 'organization_id,email' })

  if (error) throw error
}
'use server'

import { revalidatePath } from 'next/cache'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { validateCSVFile } from '@/lib/csv/parser'
import { createServerClient } from '@/lib/supabase/server'
import { isFile } from '@/lib/utils/file'

export async function startBulkOperation(formData: FormData) {
  const supabase = createServerClient()

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get form data with proper type checking
  const fileEntry = formData.get('file')
  const operationTypeEntry = formData.get('operationType')
  const entityTypeEntry = formData.get('entityType')
  const validateOnly = formData.get('validateOnly') === 'true'
  const rollbackOnError = formData.get('rollbackOnError') === 'true'
  
  // Safe parsing of numeric values
  const chunkSizeEntry = formData.get('chunkSize')
  const chunkSize = chunkSizeEntry ? parseInt(String(chunkSizeEntry)) : 500
  const maxConcurrentEntry = formData.get('maxConcurrent')
  const maxConcurrent = maxConcurrentEntry ? parseInt(String(maxConcurrentEntry)) : 3

  // Validate file is actually a File object
  if (!isFile(fileEntry)) {
    throw new Error('Invalid file input')
  }
  const file = fileEntry

  // Validate string entries
  const operationType = operationTypeEntry ? String(operationTypeEntry) : null
  const entityType = entityTypeEntry ? String(entityTypeEntry) : null

  // Validate inputs
  if (!operationType || !entityType) {
    throw new Error('Operation type and entity type are required')
  }

  // Define valid types
  const VALID_OPERATION_TYPES = ['import', 'export', 'update', 'delete'] as const
  const VALID_ENTITY_TYPES = ['products', 'inventory', 'pricing', 'customers'] as const
  
  type OperationType = typeof VALID_OPERATION_TYPES[number]
  type EntityType = typeof VALID_ENTITY_TYPES[number]

  if (!VALID_OPERATION_TYPES.includes(operationType as OperationType)) {
    throw new Error('Invalid operation type')
  }

  if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
    throw new Error('Invalid entity type')
  }

  // Validate file properties
  if (!file.name || file.size === 0) {
    throw new Error('File is empty or invalid')
  }

  // Check file MIME type and extension
  const validMimeTypes = ['text/csv', 'application/csv', 'text/plain']
  const fileExtension = file.name.toLowerCase().split('.').pop()
  
  if (fileExtension !== 'csv') {
    throw new Error('File must be a CSV file')
  }

  if (file.type && !validMimeTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload a CSV file')
  }

  // Validate CSV content
  const validation = validateCSVFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid CSV file')
  }

  // Create engine and start operation
  const engine = new BulkOperationsEngine()
  const operationId = await engine.startOperation(
    file,
    {
      operationType: operationType as OperationType,
      entityType: entityType as EntityType,
      validateOnly,
      rollbackOnError,
      chunkSize,
      maxConcurrent,
    },
    user.id
  )

  // Revalidate pages
  revalidatePath('/bulk-operations')

  return { operationId }
}

export async function cancelBulkOperation(operationId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const engine = new BulkOperationsEngine()
  await engine.cancelOperation(operationId, user.id)

  revalidatePath('/bulk-operations')
}

export async function rollbackBulkOperation(operationId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const engine = new BulkOperationsEngine()

  // Start rollback asynchronously - don't await to return immediately
  engine.rollbackOperation(operationId).catch((err) => {
    console.error(`Rollback operation ${operationId} failed:`, err)
  })

  revalidatePath('/bulk-operations')
  return { success: true }
}

export async function getBulkOperations() {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get user's organization_id
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (profileError) throw profileError
  if (!userProfile?.organization_id) {
    throw new Error('User does not belong to an organization')
  }

  const { data, error } = await supabase
    .from('bulk_operations')
    .select('*')
    .eq('organization_id', userProfile.organization_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data
}

export async function getBulkOperationProgress(operationId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase.rpc('get_bulk_operation_progress', {
    operation_uuid: operationId,
  })

  if (error) throw error
  return data
}

export async function getBulkOperationDetails(operationId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get operation details
  const { data: operation, error: operationError } = await supabase
    .from('bulk_operations')
    .select('*')
    .eq('id', operationId)
    .single()

  if (operationError) throw operationError

  // Get operation records for detailed breakdown
  const { data: records, error: recordsError } = await supabase
    .from('bulk_operation_records')
    .select('*')
    .eq('operation_id', operationId)
    .order('record_index')
    .limit(1000) // Limit for performance

  if (recordsError) throw recordsError

  return {
    operation,
    records,
  }
}

export async function getBulkOperationStats() {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get user's organization
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!userProfile?.organization_id) {
    throw new Error('User organization not found')
  }

  // Get stats for the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data, error } = await supabase
    .from('bulk_operations')
    .select('status, operation_type, entity_type, successful_records, failed_records, created_at')
    .eq('organization_id', userProfile.organization_id)
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (error) throw error

  // Calculate stats
  const stats = {
    totalOperations: data.length,
    completedOperations: data.filter(op => op.status === 'completed').length,
    failedOperations: data.filter(op => op.status === 'failed').length,
    totalRecordsProcessed: data.reduce((sum, op) => sum + (op.successful_records || 0), 0),
    totalRecordsFailed: data.reduce((sum, op) => sum + (op.failed_records || 0), 0),
    operationsByType: data.reduce((acc, op) => {
      const key = `${op.operation_type}_${op.entity_type}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    operationsByDay: data.reduce((acc, op) => {
      const day = new Date(op.created_at).toISOString().split('T')[0]
      acc[day] = (acc[day] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }

  return stats
}

export async function downloadBulkOperationReport(operationId: string) {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const details = await getBulkOperationDetails(operationId)
  
  // Generate CSV report
  const headers = ['Record Index', 'Action', 'Status', 'Error', 'Processed At']
  const rows = details.records.map(record => [
    record.record_index,
    record.action,
    record.status,
    record.error || '',
    record.processed_at || '',
  ])

  // Helper function to properly escape CSV values
  const escapeCSVValue = (value: string | number): string => {
    let strValue = String(value)
    
    // Protect against CSV formula injection
    // If the value starts with =, +, -, or @, prepend a single quote
    if (strValue.length > 0 && ['=', '+', '-', '@'].includes(strValue[0])) {
      strValue = "'" + strValue
    }
    
    // If the value contains quotes, newlines, or commas, it needs to be quoted
    if (strValue.includes('"') || strValue.includes('\n') || strValue.includes(',')) {
      // Escape double quotes by doubling them
      const escaped = strValue.replace(/"/g, '""')
      return `"${escaped}"`
    }
    // Otherwise, quote it for consistency
    return `"${strValue}"`
  }

  const csvContent = [
    headers.map(h => escapeCSVValue(h)).join(','),
    ...rows.map(row => row.map(cell => escapeCSVValue(cell)).join(','))
  ].join('\n')

  return {
    content: csvContent,
    filename: `bulk-operation-${operationId}-report.csv`,
    mimeType: 'text/csv'
  }
}
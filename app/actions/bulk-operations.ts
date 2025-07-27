'use server'

import { revalidatePath } from 'next/cache'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { validateCSVFile } from '@/lib/csv/parser'
import { createServerClient } from '@/lib/supabase/server'

export async function startBulkOperation(formData: FormData) {
  const supabase = createServerClient()

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get form data
  const file = formData.get('file') as File
  const operationType = formData.get('operationType') as string
  const entityType = formData.get('entityType') as string
  const validateOnly = formData.get('validateOnly') === 'true'
  const rollbackOnError = formData.get('rollbackOnError') === 'true'
  const chunkSize = parseInt(formData.get('chunkSize') as string) || 500
  const maxConcurrent = parseInt(formData.get('maxConcurrent') as string) || 3

  // Validate inputs
  if (!file) {
    throw new Error('File is required')
  }

  if (!operationType || !entityType) {
    throw new Error('Operation type and entity type are required')
  }

  if (!['import', 'export', 'update', 'delete'].includes(operationType)) {
    throw new Error('Invalid operation type')
  }

  if (!['products', 'inventory', 'pricing', 'customers'].includes(entityType)) {
    throw new Error('Invalid entity type')
  }

  // Validate file
  const validation = validateCSVFile(file)
  if (!validation.valid) {
    throw new Error(validation.error!)
  }

  // Create engine and start operation
  const engine = new BulkOperationsEngine()
  const operationId = await engine.startOperation(
    file,
    {
      operationType: operationType as any,
      entityType: entityType as any,
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

  const { data, error } = await supabase
    .from('bulk_operations')
    .select('*')
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

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return {
    content: csvContent,
    filename: `bulk-operation-${operationId}-report.csv`,
    mimeType: 'text/csv'
  }
}
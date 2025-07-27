'use server'

import { revalidatePath } from 'next/cache'
import { BulkOperationsEngine } from '@/lib/bulk/bulk-operations-engine'
import { validateCSVFile } from '@/lib/csv/parser'
import { createServerClient } from '@/lib/supabase/server'
import { isFile } from '@/lib/utils/file'
import { escapeCSVField } from '@/lib/utils/csv'
import { z } from 'zod'

// Define valid types
const VALID_OPERATION_TYPES = ['import', 'export', 'update', 'delete'] as const
const VALID_ENTITY_TYPES = ['products', 'inventory', 'pricing', 'customers'] as const

// Define the schema for bulk operation parameters
const bulkOperationSchema = z.object({
  operationType: z.enum(VALID_OPERATION_TYPES, {
    errorMap: () => ({ message: 'Invalid operation type' }),
  }),
  entityType: z.enum(VALID_ENTITY_TYPES, {
    errorMap: () => ({ message: 'Invalid entity type' }),
  }),
  validateOnly: z.boolean().default(false),
  rollbackOnError: z.boolean().default(false),
  chunkSize: z.number().int().min(1).max(1000).default(500),
  maxConcurrent: z.number().int().min(1).max(10).default(3),
})

// File validation schema
const fileSchema = z.custom<File>(
  (val) => val instanceof File,
  { message: 'Invalid file input' }
).refine(
  (file) => file.size > 0 && file.name.length > 0,
  { message: 'File is empty or invalid' }
).refine(
  (file) => file.name.toLowerCase().endsWith('.csv'),
  { message: 'File must be a CSV file' }
).refine(
  (file) => !file.type || ['text/csv', 'application/csv', 'text/plain'].includes(file.type),
  { message: 'Invalid file type. Please upload a CSV file' }
)

/**
 * Initiates a new bulk operation for the authenticated user using the provided CSV file and operation parameters.
 *
 * Validates the user's authentication, form data, file type, and CSV content before starting the operation. Supports options for validation-only mode, rollback on error, chunk size, and concurrency. Returns the unique ID of the created bulk operation.
 *
 * @param formData - Form data containing the CSV file and operation parameters
 * @returns An object containing the operation ID of the newly started bulk operation
 * @throws If the user is unauthorized, required fields are missing, or file validation fails
 */
export async function startBulkOperation(formData: FormData) {
  const supabase = createServerClient()

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Parse and validate form data
  try {
    // Validate file
    const fileEntry = formData.get('file')
    const file = fileSchema.parse(fileEntry)

    // Parse and validate operation parameters
    const rawParams = {
      operationType: formData.get('operationType') ? String(formData.get('operationType')) : undefined,
      entityType: formData.get('entityType') ? String(formData.get('entityType')) : undefined,
      validateOnly: formData.get('validateOnly') === 'true',
      rollbackOnError: formData.get('rollbackOnError') === 'true',
      chunkSize: formData.get('chunkSize') ? parseInt(String(formData.get('chunkSize'))) : undefined,
      maxConcurrent: formData.get('maxConcurrent') ? parseInt(String(formData.get('maxConcurrent'))) : undefined,
    }

    const validatedParams = bulkOperationSchema.parse(rawParams)

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
        operationType: validatedParams.operationType,
        entityType: validatedParams.entityType,
        validateOnly: validatedParams.validateOnly,
        rollbackOnError: validatedParams.rollbackOnError,
        chunkSize: validatedParams.chunkSize,
        maxConcurrent: validatedParams.maxConcurrent,
      },
      user.id
    )

    // Revalidate pages
    revalidatePath('/bulk-operations')

    return { operationId }
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into a readable message
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new Error(`Validation error: ${errorMessages}`)
    }
    throw error
  }
}

/**
 * Cancels an ongoing bulk operation for the authenticated user.
 *
 * Throws an error if the user is not authenticated.
 */
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

/**
 * Initiates an asynchronous rollback of a bulk operation for the authenticated user.
 *
 * Returns immediately with a success status; rollback errors are logged but do not affect the response.
 *
 * @param operationId - The ID of the bulk operation to roll back
 * @returns An object indicating the rollback request was initiated
 */
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

/**
 * Retrieves the latest 50 bulk operations for the authenticated user's organization.
 *
 * @returns An array of bulk operation records ordered by creation date, most recent first.
 * @throws If the user is unauthorized or does not belong to an organization.
 */
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

/**
 * Retrieves the progress details of a specific bulk operation for the authenticated user.
 *
 * @param operationId - The unique identifier of the bulk operation
 * @returns The progress data for the specified bulk operation
 */
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

/**
 * Retrieves detailed information about a specific bulk operation and up to 1000 of its associated records.
 *
 * @param operationId - The unique identifier of the bulk operation to retrieve
 * @returns An object containing the bulk operation details and an array of its records
 */
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

/**
 * Retrieves aggregated statistics for bulk operations performed by the authenticated user's organization over the past 30 days.
 *
 * @returns An object containing totals and breakdowns of operations, including counts of completed and failed operations, records processed and failed, operations grouped by type and entity, and operations grouped by day.
 */
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

/**
 * Generates and returns a CSV report for a specified bulk operation.
 *
 * The report includes details for each record in the operation, with proper escaping to prevent CSV injection and formatting issues.
 *
 * @param operationId - The ID of the bulk operation to generate the report for
 * @returns An object containing the CSV content as a string, the filename, and the MIME type
 */
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
    headers.map(h => escapeCSVField(h)).join(','),
    ...rows.map(row => row.map(cell => escapeCSVField(cell)).join(','))
  ].join('\n')

  return {
    content: csvContent,
    filename: `bulk-operation-${operationId}-report.csv`,
    mimeType: 'text/csv'
  }
}
import { createTenantWorker, queues } from '@/lib/queue/distributed-queue'
import { processReportExport } from './jobs/report-export'
import { processBulkImport } from './jobs/bulk-import'
import { processSyncJob } from './jobs/sync-job'
import { processAIAnalysis } from './jobs/ai-analysis'
import { processEmailNotification } from './jobs/email-notification'

/**
 * Main worker process
 * Handles background jobs with tenant isolation
 */
async function startWorkers() {
  console.log('🚀 Starting worker processes...')

  if (!queues) {
    console.error('❌ Queue system not configured. Please set up Redis.')
    process.exit(1)
  }

  // Create workers for each queue priority
  const workers = [
    // Critical queue - sync operations
    createTenantWorker('critical', async (job) => {
      console.log(`Processing critical job ${job.id} for tenant ${job.data.tenantId}`)
      
      switch (job.data.type) {
        case 'sync':
          return processSyncJob(job)
        default:
          throw new Error(`Unknown critical job type: ${job.data.type}`)
      }
    }),

    // High priority queue - reports and exports
    createTenantWorker('high', async (job) => {
      console.log(`Processing high priority job ${job.id} for tenant ${job.data.tenantId}`)
      
      switch (job.data.type) {
        case 'report':
        case 'export':
          return processReportExport(job)
        default:
          throw new Error(`Unknown high priority job type: ${job.data.type}`)
      }
    }),

    // Normal queue - general processing
    createTenantWorker('normal', async (job) => {
      console.log(`Processing normal job ${job.id} for tenant ${job.data.tenantId}`)
      
      switch (job.data.type) {
        case 'email':
          return processEmailNotification(job)
        case 'ai-analysis':
          return processAIAnalysis(job)
        default:
          throw new Error(`Unknown normal job type: ${job.data.type}`)
      }
    }),

    // Bulk queue - large operations
    createTenantWorker('bulk', async (job) => {
      console.log(`Processing bulk job ${job.id} for tenant ${job.data.tenantId}`)
      
      switch (job.data.type) {
        case 'bulk-import':
          return processBulkImport(job)
        default:
          throw new Error(`Unknown bulk job type: ${job.data.type}`)
      }
    }),
  ]

  // Filter out null workers (in case Redis is not configured)
  const activeWorkers = workers.filter(w => w !== null)

  if (activeWorkers.length === 0) {
    console.error('❌ No workers could be started')
    process.exit(1)
  }

  console.log(`✅ Started ${activeWorkers.length} workers`)

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down workers...')
    
    // Close all workers
    await Promise.all(activeWorkers.map(worker => worker?.close()))
    
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Health check endpoint for worker
  if (process.env.WORKER_HEALTH_PORT) {
    const http = require('http')
    const port = parseInt(process.env.WORKER_HEALTH_PORT)
    
    http.createServer((req: any, res: any) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'ok',
          workers: activeWorkers.length,
          timestamp: new Date().toISOString(),
        }))
      } else {
        res.writeHead(404)
        res.end()
      }
    }).listen(port, () => {
      console.log(`Worker health check listening on port ${port}`)
    })
  }
}

// Start workers
startWorkers().catch(error => {
  console.error('Failed to start workers:', error)
  process.exit(1)
})
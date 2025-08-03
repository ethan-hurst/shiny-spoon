import { Queue, Worker, QueueScheduler, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { AsyncLocalStorage } from 'async_hooks'

// Redis configuration for cluster support
const redisConfig = {
  port: parseInt(process.env.REDIS_PORT || '6379'),
  host: process.env.REDIS_HOST || 'localhost',
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
}

// Create Redis connections
const createRedisConnection = () => {
  // Skip Redis if not configured
  if (!process.env.REDIS_HOST && !process.env.UPSTASH_REDIS_REST_URL) {
    return null
  }
  return new Redis(redisConfig)
}

// Job queues by priority and type
const redisConnection = createRedisConnection()
export const queues = redisConnection ? {
  critical: new Queue('critical', { connection: createRedisConnection()! }),
  high: new Queue('high', { connection: createRedisConnection()! }),
  normal: new Queue('normal', { connection: createRedisConnection()! }),
  low: new Queue('low', { connection: createRedisConnection()! }),
  bulk: new Queue('bulk', { connection: createRedisConnection()! }),
} : null

// Queue schedulers for delayed jobs
const schedulers = queues ? Object.entries(queues).map(([name, queue]) => 
  new QueueScheduler(name, { connection: createRedisConnection()! })
) : []

// Job types
export interface TenantJob {
  tenantId: string
  type: string
  data: any
  priority?: number
  delay?: number
  attempts?: number
}

/**
 * Add a job with tenant context
 */
export async function addTenantJob(job: TenantJob) {
  if (!queues) {
    console.warn('Queue system not available - Redis not configured')
    return null
  }

  const queueName = getQueueForJob(job)
  const queue = queues[queueName as keyof typeof queues]
  
  return queue.add(job.type, job, {
    priority: job.priority || 0,
    delay: job.delay || 0,
    attempts: job.attempts || 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 100,
    },
    removeOnFail: {
      age: 24 * 3600, // 24 hours
    },
  })
}

/**
 * Determine queue based on job type and priority
 */
function getQueueForJob(job: TenantJob): string {
  // Route jobs based on type and tenant tier
  if (job.type.includes('sync') || job.type.includes('critical')) {
    return 'critical'
  }
  if (job.type.includes('report') || job.type.includes('export')) {
    return 'high'
  }
  if (job.type.includes('bulk')) {
    return 'bulk'
  }
  if (job.priority && job.priority > 5) {
    return 'high'
  }
  if (job.priority && job.priority < 0) {
    return 'low'
  }
  return 'normal'
}

/**
 * Worker factory with tenant isolation
 */
export function createTenantWorker(
  queueName: keyof typeof queues,
  processor: (job: Job<TenantJob>) => Promise<any>
) {
  if (!queues) {
    console.warn('Cannot create worker - Redis not configured')
    return null
  }

  const worker = new Worker(
    queueName,
    async (job: Job<TenantJob>) => {
      // Set tenant context for the job
      const tenantId = job.data.tenantId
      
      try {
        // Add tenant context to async local storage
        return await runWithTenant(tenantId, () => processor(job))
      } catch (error) {
        console.error(`Job ${job.id} failed for tenant ${tenantId}:`, error)
        throw error
      }
    },
    {
      connection: createRedisConnection()!,
      concurrency: getConcurrencyForQueue(queueName),
      limiter: {
        max: 100,
        duration: 60000, // per minute
      },
    }
  )

  // Monitor worker health
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed for tenant ${job.data.tenantId}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err)
  })

  worker.on('error', (err) => {
    console.error('Worker error:', err)
  })

  return worker
}

/**
 * Get concurrency based on queue priority
 */
function getConcurrencyForQueue(queueName: string): number {
  const concurrencyMap = {
    critical: 10,
    high: 8,
    normal: 5,
    low: 3,
    bulk: 2,
  }
  return concurrencyMap[queueName as keyof typeof concurrencyMap] || 5
}

// Async local storage for tenant context
const tenantContext = new AsyncLocalStorage<{ tenantId: string }>()

/**
 * Run a function with tenant context
 */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantContext.run({ tenantId }, fn)
}

/**
 * Get current tenant from context
 */
export function getCurrentTenant(): string | undefined {
  return tenantContext.getStore()?.tenantId
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  if (!queues) {
    return null
  }

  const stats: Record<string, any> = {}
  
  for (const [name, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ])
    
    stats[name] = {
      waiting,
      active,
      completed,
      failed,
    }
  }
  
  return stats
}

/**
 * Clean up all queues and workers
 */
export async function cleanupQueues() {
  if (!queues) return

  // Close all queues
  await Promise.all(Object.values(queues).map(queue => queue.close()))
  
  // Close all schedulers
  await Promise.all(schedulers.map(scheduler => scheduler.close()))
}
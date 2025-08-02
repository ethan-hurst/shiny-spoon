import { Job } from 'bullmq'
import { TenantJob } from '@/lib/queue/distributed-queue'

export async function processEmailNotification(job: Job<TenantJob>) {
  const { tenantId, data } = job.data
  
  // TODO: Implement email notification processing
  console.log(`Processing email notification for tenant ${tenantId}`, data)
  
  return { success: true }
}
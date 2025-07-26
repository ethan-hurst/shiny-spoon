// Helper methods for ShopifyConnector to reduce class size

import type { SyncOptions } from '@/lib/integrations/base-connector'
import type { ShopifyApiClient } from './api-client'
import type { ShopifyTransformers } from './transformers'
import type { BaseLogger } from '@/lib/integrations/base-connector'

export interface IncrementalSyncHelperOptions {
  client: ShopifyApiClient
  transformers: ShopifyTransformers
  logger: BaseLogger
  getSyncState: (entityType: string) => Promise<any>
  saveProduct: (product: any) => Promise<void>
  saveProductMapping: (shopifyId: string, internalId: string) => Promise<void>
  saveSyncCursor: (entityType: string, cursor: string | null) => Promise<void>
  updateSyncState: (entityType: string, state: any) => Promise<void>
  emitProgress: (current: number, total: number) => void
  withRateLimit: <T>(fn: () => Promise<T>) => Promise<T>
}

export async function incrementalSyncProducts(
  helpers: IncrementalSyncHelperOptions,
  syncState: any,
  options?: SyncOptions
): Promise<{ processed: number; failed: number; errors: Error[] }> {
  helpers.logger.info('Starting incremental product sync')
  
  let cursor = syncState?.sync_cursor
  let hasNextPage = true
  let totalProcessed = 0
  let totalFailed = 0
  const errors: Error[] = []

  while (hasNextPage && (!options?.signal?.aborted)) {
    const query = `
      query GetProducts($cursor: String) {
        products(first: ${options?.limit || 50}, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              ${ShopifyApiClient.buildProductQuery()}
            }
          }
        }
      }
    `

    const result = await helpers.withRateLimit(
      () => helpers.client.query(query, { cursor })
    )

    const products = result.data?.products
    if (!products) break

    hasNextPage = products.pageInfo.hasNextPage
    cursor = products.pageInfo.endCursor

    // Process products
    for (const edge of products.edges) {
      try {
        if (options?.dryRun) {
          helpers.logger.info('Dry run: Would sync product', {
            id: edge.node.id,
            title: edge.node.title
          })
        } else {
          const transformed = helpers.transformers.transformProduct(edge.node)
          await helpers.saveProduct(transformed)
          await helpers.saveProductMapping(edge.node.id, transformed.id)
        }
        totalProcessed++

        // Emit progress
        if (totalProcessed % 10 === 0) {
          // Estimate total based on current progress and pagination
          const estimatedTotal = hasNextPage 
            ? totalProcessed + Math.max(products.edges.length, 50)
            : totalProcessed
          helpers.emitProgress(totalProcessed, estimatedTotal)
        }
      } catch (error) {
        totalFailed++
        errors.push(error as Error)
        helpers.logger.error('Failed to sync product', {
          productId: edge.node.id,
          error
        })
      }
    }

    // Save cursor for resume capability
    if (!options?.dryRun) {
      await helpers.saveSyncCursor('product', cursor)
    }

    // Check if we should stop
    if (options?.limit && totalProcessed >= options.limit) {
      break
    }
  }

  // Update sync state
  if (!options?.dryRun) {
    await helpers.updateSyncState('product', {
      last_sync_at: new Date(),
      total_synced: totalProcessed,
      total_failed: totalFailed,
      last_error: errors.length > 0 ? errors[0].message : null
    })
  }

  return {
    processed: totalProcessed,
    failed: totalFailed,
    errors
  }
}
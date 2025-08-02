import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import { withCache, cacheKey, CACHE_TTL, invalidateCache } from '@/lib/cache/redis-client'
import { z } from 'zod'

// Query schema
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(['name', 'sku', 'price', 'created_at']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser()
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate query params
    const { searchParams } = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(searchParams))

    // Generate cache key based on org and query
    const key = cacheKey(
      'PRODUCTS',
      user.organizationId,
      JSON.stringify(query)
    )

    // Fetch with cache
    const result = await withCache(
      key,
      async () => {
        const supabase = createServerClient()
        
        // Build query
        let dbQuery = supabase
          .from('products')
          .select('*, categories(*)', { count: 'exact' })
          .eq('organization_id', user.organizationId)
          .eq('is_archived', false)

        // Apply filters
        if (query.search) {
          dbQuery = dbQuery.or(
            `name.ilike.%${query.search}%,sku.ilike.%${query.search}%`
          )
        }

        if (query.category) {
          dbQuery = dbQuery.eq('category_id', query.category)
        }

        // Apply sorting
        dbQuery = dbQuery.order(query.sort, { ascending: query.order === 'asc' })

        // Apply pagination
        const start = (query.page - 1) * query.limit
        dbQuery = dbQuery.range(start, start + query.limit - 1)

        const { data, error, count } = await dbQuery

        if (error) throw error

        return {
          products: data || [],
          total: count || 0,
          page: query.page,
          limit: query.limit,
          pages: Math.ceil((count || 0) / query.limit),
        }
      },
      CACHE_TTL.MEDIUM // 5 minutes cache
    )

    // Set cache headers for CDN
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'max-age=300',
        'Surrogate-Key': `products-${user.organizationId}`,
      },
    })
  } catch (error) {
    console.error('[API] Products error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Create product (implementation details omitted)
    // ...

    // Invalidate related caches
    await invalidateCache(`${cacheKey('PRODUCTS', user.organizationId)}*`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Create product error:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
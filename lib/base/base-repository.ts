/**
 * BaseRepository - Foundation class for all repositories
 * Provides automatic organization isolation, soft deletes, and audit fields
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RepositoryOptions {
  tableName: string
  softDelete?: boolean
}

export interface BaseEntity {
  id: string
  organization_id?: string
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
  deleted_at?: string | null
  deleted_by?: string | null
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected tableName: string
  protected softDelete: boolean

  constructor(
    protected supabase: SupabaseClient<any>,
    options: RepositoryOptions
  ) {
    this.tableName = options.tableName
    this.softDelete = options.softDelete ?? true
  }

  /**
   * Base query that always includes organization filter
   * and excludes soft-deleted records
   * Subclasses should override this to provide proper typing
   */
  protected query(): any {
    const orgId = this.getOrganizationId()
    
    let query = this.supabase.from(this.tableName)
    
    // Always filter by organization
    if (orgId) {
      query = query.eq('organization_id', orgId)
    }
    
    // Filter out soft-deleted records by default
    if (this.softDelete) {
      query = query.is('deleted_at', null)
    }
    
    return query
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      throw this.handleError(error)
    }

    return data as T
  }

  /**
   * Find all records matching the given filters
   */
  async findAll(filters?: Partial<T>): Promise<T[]> {
    let query = this.query().select('*')

    // Apply additional filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value)
        }
      })
    }

    const { data, error } = await query

    if (error) throw this.handleError(error)
    return (data || []) as T[]
  }

  /**
   * Create a new record with automatic audit fields
   */
  async create(input: Omit<T, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>): Promise<T> {
    const enrichedData = {
      ...input,
      organization_id: this.getOrganizationId(),
      created_by: this.getCurrentUserId(),
      updated_by: this.getCurrentUserId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(enrichedData)
      .select()
      .single()

    if (error) throw this.handleError(error)
    return data as T
  }

  /**
   * Update an existing record with automatic audit fields
   */
  async update(id: string, input: Partial<Omit<T, 'id' | 'created_at' | 'created_by'>>): Promise<T> {
    const enrichedData = {
      ...input,
      updated_by: this.getCurrentUserId(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await this.query()
      .update(enrichedData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw this.handleError(error)
    return data as T
  }

  /**
   * Delete a record (soft delete by default)
   */
  async delete(id: string): Promise<void> {
    if (this.softDelete) {
      // Soft delete - just mark as deleted
      await this.update(id, {
        deleted_at: new Date().toISOString(),
        deleted_by: this.getCurrentUserId()
      } as any)
    } else {
      // Hard delete
      const { error } = await this.query()
        .delete()
        .eq('id', id)

      if (error) throw this.handleError(error)
    }
  }

  /**
   * Create multiple records in a batch
   */
  async createMany(inputs: Array<Omit<T, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>): Promise<T[]> {
    const enrichedData = inputs.map(input => ({
      ...input,
      organization_id: this.getOrganizationId(),
      created_by: this.getCurrentUserId(),
      updated_by: this.getCurrentUserId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(enrichedData)
      .select()

    if (error) throw this.handleError(error)
    return (data || []) as T[]
  }

  /**
   * Count records matching the given filters
   */
  async count(filters?: Partial<T>): Promise<number> {
    let query = this.query()

    // Apply additional filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value)
        }
      })
    }

    const { count, error } = await query
      .select('*', { count: 'exact', head: true })

    if (error) throw this.handleError(error)
    return count || 0
  }

  /**
   * Check if a record exists
   */
  async exists(id: string): Promise<boolean> {
    const { count } = await this.query()
      .select('id', { count: 'exact', head: true })
      .eq('id', id)

    return (count || 0) > 0
  }

  /**
   * Get organization ID from auth context
   * Must be implemented by concrete repositories
   */
  protected abstract getOrganizationId(): string | null

  /**
   * Get current user ID from auth context
   * Must be implemented by concrete repositories
   */
  protected abstract getCurrentUserId(): string | null

  /**
   * Handle database errors consistently
   * Can be overridden for custom error handling
   */
  protected handleError(error: any): Error {
    console.error(`Database error in ${this.tableName}:`, error)
    
    // Handle common Postgres error codes
    if (error.code === '23505') {
      return new Error(`Duplicate entry in ${this.tableName}`)
    }
    
    if (error.code === '23503') {
      return new Error(`Foreign key constraint violation in ${this.tableName}`)
    }
    
    if (error.code === '23502') {
      return new Error(`Missing required field in ${this.tableName}`)
    }
    
    // Default error
    return new Error(error.message || `Database error in ${this.tableName}`)
  }
}
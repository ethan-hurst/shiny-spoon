// Extended database types for integration framework
// This file extends the base database types with integration-related tables

import type { Database as BaseDatabase } from './database'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface ExtendedDatabase extends BaseDatabase {
  public: BaseDatabase['public'] & {
    Tables: BaseDatabase['public']['Tables'] & {
      integrations: {
        Row: {
          id: string
          organization_id: string
          name: string
          platform: 'netsuite' | 'shopify' | 'quickbooks' | 'sap' | 'dynamics365' | 'custom'
          description: string | null
          status: 'active' | 'inactive' | 'error' | 'configuring' | 'suspended'
          last_sync_at: string | null
          last_error_at: string | null
          error_count: number
          config: Json
          sync_settings: Json
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          platform: 'netsuite' | 'shopify' | 'quickbooks' | 'sap' | 'dynamics365' | 'custom'
          description?: string | null
          status?: 'active' | 'inactive' | 'error' | 'configuring' | 'suspended'
          last_sync_at?: string | null
          last_error_at?: string | null
          error_count?: number
          config?: Json
          sync_settings?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          platform?: 'netsuite' | 'shopify' | 'quickbooks' | 'sap' | 'dynamics365' | 'custom'
          description?: string | null
          status?: 'active' | 'inactive' | 'error' | 'configuring' | 'suspended'
          last_sync_at?: string | null
          last_error_at?: string | null
          error_count?: number
          config?: Json
          sync_settings?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      integration_credentials: {
        Row: {
          id: string
          integration_id: string
          credential_type: 'oauth2' | 'api_key' | 'basic_auth' | 'custom'
          encrypted_data: string
          access_token_expires_at: string | null
          refresh_token_expires_at: string | null
          created_at: string
          updated_at: string
          rotated_at: string | null
        }
        Insert: {
          id?: string
          integration_id: string
          credential_type: 'oauth2' | 'api_key' | 'basic_auth' | 'custom'
          encrypted_data: string
          access_token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          created_at?: string
          updated_at?: string
          rotated_at?: string | null
        }
        Update: {
          id?: string
          integration_id?: string
          credential_type?: 'oauth2' | 'api_key' | 'basic_auth' | 'custom'
          encrypted_data?: string
          access_token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          created_at?: string
          updated_at?: string
          rotated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          }
        ]
      }
      webhook_endpoints: {
        Row: {
          id: string
          integration_id: string
          url: string
          secret: string
          events: string[]
          is_active: boolean
          last_received_at: string | null
          failure_count: number
          created_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          url: string
          secret: string
          events: string[]
          is_active?: boolean
          last_received_at?: string | null
          failure_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          url?: string
          secret?: string
          events?: string[]
          is_active?: boolean
          last_received_at?: string | null
          failure_count?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          }
        ]
      }
      integration_logs: {
        Row: {
          id: string
          integration_id: string
          organization_id: string
          log_type: 'sync' | 'webhook' | 'error' | 'auth' | 'config'
          severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          message: string
          details: Json
          request_id: string | null
          request_data: Json | null
          response_data: Json | null
          response_status: number | null
          duration_ms: number | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          integration_id: string
          organization_id: string
          log_type: 'sync' | 'webhook' | 'error' | 'auth' | 'config'
          severity?: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          message: string
          details?: Json
          request_id?: string | null
          request_data?: Json | null
          response_data?: Json | null
          response_status?: number | null
          duration_ms?: number | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          integration_id?: string
          organization_id?: string
          log_type?: 'sync' | 'webhook' | 'error' | 'auth' | 'config'
          severity?: 'debug' | 'info' | 'warning' | 'error' | 'critical'
          message?: string
          details?: Json
          request_id?: string | null
          request_data?: Json | null
          response_data?: Json | null
          response_status?: number | null
          duration_ms?: number | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sync_jobs: {
        Row: {
          id: string
          integration_id: string
          organization_id: string
          job_type: 'full_sync' | 'incremental_sync' | 'webhook' | 'manual'
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          priority: number
          started_at: string | null
          completed_at: string | null
          retry_count: number
          max_retries: number
          next_retry_at: string | null
          payload: Json
          result: Json
          error: string | null
          total_items: number | null
          processed_items: number
          failed_items: number
          created_at: string
          scheduled_for: string
        }
        Insert: {
          id?: string
          integration_id: string
          organization_id: string
          job_type: 'full_sync' | 'incremental_sync' | 'webhook' | 'manual'
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          priority?: number
          started_at?: string | null
          completed_at?: string | null
          retry_count?: number
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          result?: Json
          error?: string | null
          total_items?: number | null
          processed_items?: number
          failed_items?: number
          created_at?: string
          scheduled_for?: string
        }
        Update: {
          id?: string
          integration_id?: string
          organization_id?: string
          job_type?: 'full_sync' | 'incremental_sync' | 'webhook' | 'manual'
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          priority?: number
          started_at?: string | null
          completed_at?: string | null
          retry_count?: number
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          result?: Json
          error?: string | null
          total_items?: number | null
          processed_items?: number
          failed_items?: number
          created_at?: string
          scheduled_for?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      rate_limit_buckets: {
        Row: {
          id: string
          integration_id: string
          bucket_key: string
          window_start: string
          window_duration_seconds: number
          request_count: number
          max_requests: number
        }
        Insert: {
          id?: string
          integration_id: string
          bucket_key: string
          window_start: string
          window_duration_seconds: number
          request_count?: number
          max_requests: number
        }
        Update: {
          id?: string
          integration_id?: string
          bucket_key?: string
          window_start?: string
          window_duration_seconds?: number
          request_count?: number
          max_requests?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_buckets_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
  }
}

export type Database = ExtendedDatabase
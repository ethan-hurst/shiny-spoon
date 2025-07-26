export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
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
          credential_type: 'oauth2' | 'api_key' | 'basic_auth' | 'custom' | null
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
          credential_type?: 'oauth2' | 'api_key' | 'basic_auth' | 'custom' | null
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
          credential_type?: 'oauth2' | 'api_key' | 'basic_auth' | 'custom' | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      netsuite_config: {
        Row: {
          id: string
          integration_id: string
          account_id: string
          datacenter_url: string
          subsidiary_id: string | null
          location_ids: string[] | null
          field_mappings: Json
          custom_record_types: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          account_id: string
          datacenter_url: string
          subsidiary_id?: string | null
          location_ids?: string[] | null
          field_mappings?: Json
          custom_record_types?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          account_id?: string
          datacenter_url?: string
          subsidiary_id?: string | null
          location_ids?: string[] | null
          field_mappings?: Json
          custom_record_types?: Json
          created_at?: string
          updated_at?: string
        }
      }
      netsuite_sync_state: {
        Row: {
          id: string
          integration_id: string
          entity_type: string
          last_sync_at: string | null
          last_successful_sync_at: string | null
          sync_cursor: string | null
          sync_status: string | null
          error_count: number
          last_error: string | null
          sync_progress: number | null
          total_records: number | null
          records_processed: number | null
          sync_duration: number | null
          next_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          entity_type: string
          last_sync_at?: string | null
          last_successful_sync_at?: string | null
          sync_cursor?: string | null
          sync_status?: string | null
          error_count?: number
          last_error?: string | null
          sync_progress?: number | null
          total_records?: number | null
          records_processed?: number | null
          sync_duration?: number | null
          next_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          entity_type?: string
          last_sync_at?: string | null
          last_successful_sync_at?: string | null
          sync_cursor?: string | null
          sync_status?: string | null
          error_count?: number
          last_error?: string | null
          sync_progress?: number | null
          total_records?: number | null
          records_processed?: number | null
          sync_duration?: number | null
          next_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          organization_id: string
          first_name: string | null
          last_name: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id: string
          first_name?: string | null
          last_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string
          first_name?: string | null
          last_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          organization_id: string
          sku: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          sku: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          sku?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          warehouse_id: string
          quantity: number
          reserved_quantity: number
          reorder_point: number | null
          reorder_quantity: number | null
          last_sync: string | null
          sync_status: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          warehouse_id: string
          quantity?: number
          reserved_quantity?: number
          reorder_point?: number | null
          reorder_quantity?: number | null
          last_sync?: string | null
          sync_status?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          product_id?: string
          warehouse_id?: string
          quantity?: number
          reserved_quantity?: number
          reorder_point?: number | null
          reorder_quantity?: number | null
          last_sync?: string | null
          sync_status?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
      }
      warehouses: {
        Row: {
          id: string
          organization_id: string
          code: string
          name: string
          address: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          code: string
          name: string
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          code?: string
          name?: string
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      integration_logs: {
        Row: {
          id: string
          integration_id: string
          organization_id: string
          log_type: string
          severity: string
          message: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          organization_id: string
          log_type: string
          severity: string
          message: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          organization_id?: string
          log_type?: string
          severity?: string
          message?: string
          details?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_integration_activity: {
        Args: {
          p_integration_id: string
          p_organization_id: string
          p_log_type: string
          p_severity: string
          p_message: string
          p_details?: Json
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
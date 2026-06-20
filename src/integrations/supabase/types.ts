export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          severity: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          severity?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          severity?: string
        }
        Relationships: []
      }
      blocked_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_active: boolean
          note: string | null
          package_id: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          note?: string | null
          package_id?: string | null
          scope: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          note?: string | null
          package_id?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_domains_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          expire_at: string | null
          full_name: string
          id: string
          ip_address: string | null
          mac_address: string | null
          notes: string | null
          package_id: string | null
          password: string
          phone: string | null
          service_type: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          expire_at?: string | null
          full_name: string
          id?: string
          ip_address?: string | null
          mac_address?: string | null
          notes?: string | null
          package_id?: string | null
          password: string
          phone?: string | null
          service_type?: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          address?: string | null
          created_at?: string
          expire_at?: string | null
          full_name?: string
          id?: string
          ip_address?: string | null
          mac_address?: string | null
          notes?: string | null
          package_id?: string | null
          password?: string
          phone?: string | null
          service_type?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          package_id: string | null
          paid_at: string | null
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          package_id?: string | null
          paid_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          package_id?: string | null
          paid_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price: number
          service_type: string
          speed_down_mbps: number
          speed_up_mbps: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          service_type?: string
          speed_down_mbps?: number
          speed_up_mbps?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          service_type?: string
          speed_down_mbps?: number
          speed_up_mbps?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      router_config: {
        Row: {
          cloud_hostname: string | null
          connection_mode: string
          created_at: string
          host: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          password: string
          port: number
          updated_at: string
          use_https: boolean
          username: string
        }
        Insert: {
          cloud_hostname?: string | null
          connection_mode?: string
          created_at?: string
          host: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          password: string
          port?: number
          updated_at?: string
          use_https?: boolean
          username: string
        }
        Update: {
          cloud_hostname?: string | null
          connection_mode?: string
          created_at?: string
          host?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          password?: string
          port?: number
          updated_at?: string
          use_https?: boolean
          username?: string
        }
        Relationships: []
      }
      traffic_usage: {
        Row: {
          created_at: string
          customer_id: string
          download_bytes: number
          id: string
          last_synced_at: string
          period_start: string
          updated_at: string
          upload_bytes: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          download_bytes?: number
          id?: string
          last_synced_at?: string
          period_start?: string
          updated_at?: string
          upload_bytes?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          download_bytes?: number
          id?: string
          last_synced_at?: string
          period_start?: string
          updated_at?: string
          upload_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "traffic_usage_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const

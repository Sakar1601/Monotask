export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_suggestions: {
        Row: {
          connection_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          status: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload: Json
          status?: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          call_count: number
          feature: string
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          call_count?: number
          feature: string
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          call_count?: number
          feature?: string
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string | null
          external_event_id: string | null
          id: string
          last_seen_at: string | null
          location: string | null
          meeting_url: string | null
          start_time: string
          sync_connection_id: string | null
          sync_error: string | null
          sync_provider: string | null
          synced_at: string | null
          tag_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          external_event_id?: string | null
          id?: string
          last_seen_at?: string | null
          location?: string | null
          meeting_url?: string | null
          start_time: string
          sync_connection_id?: string | null
          sync_error?: string | null
          sync_provider?: string | null
          synced_at?: string | null
          tag_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          external_event_id?: string | null
          id?: string
          last_seen_at?: string | null
          location?: string | null
          meeting_url?: string | null
          start_time?: string
          sync_connection_id?: string | null
          sync_error?: string | null
          sync_provider?: string | null
          synced_at?: string | null
          tag_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_google_connection_id_fkey"
            columns: ["sync_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_google_connection_id_fkey"
            columns: ["sync_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          current_value: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          target_date: string | null
          target_value: number
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          target_date?: string | null
          target_value: number
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          target_date?: string | null
          target_value?: number
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          created_at: string
          description: string | null
          frequency: string
          frequency_days: number[] | null
          id: string
          is_active: boolean | null
          name: string
          preferred_time: string | null
          tag_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          frequency: string
          frequency_days?: number[] | null
          id?: string
          is_active?: boolean | null
          name: string
          preferred_time?: string | null
          tag_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          frequency?: string
          frequency_days?: number[] | null
          id?: string
          is_active?: boolean | null
          name?: string
          preferred_time?: string | null
          tag_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          access_token: string
          account_email: string | null
          calendar_sync_enabled: boolean
          created_at: string
          expires_at: string
          id: string
          last_error: string | null
          last_scanned_at: string | null
          last_synced_at: string | null
          message_scan_enabled: boolean
          provider: string
          provider_metadata: Json | null
          refresh_token: string
          scope: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_email?: string | null
          calendar_sync_enabled?: boolean
          created_at?: string
          expires_at: string
          id?: string
          last_error?: string | null
          last_scanned_at?: string | null
          last_synced_at?: string | null
          message_scan_enabled?: boolean
          provider: string
          provider_metadata?: Json | null
          refresh_token: string
          scope?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_email?: string | null
          calendar_sync_enabled?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          last_scanned_at?: string | null
          last_synced_at?: string | null
          message_scan_enabled?: boolean
          provider?: string
          provider_metadata?: Json | null
          refresh_token?: string
          scope?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      logs: {
        Row: {
          created_at: string
          date: string
          habit_id: string | null
          id: string
          notes: string | null
          status: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          habit_id?: string | null
          id?: string
          notes?: string | null
          status: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          habit_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          connection_id: string | null
          created_at: string
          provider: string
          requesting_message_scan: boolean
          state: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          provider: string
          requesting_message_scan?: boolean
          state: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          provider?: string
          requesting_message_scan?: boolean
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections_view"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          settings: Json | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          settings?: Json | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      task_instances: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          instance_date: string
          status: string | null
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          instance_date: string
          status?: string | null
          task_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          instance_date?: string
          status?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          external_task_id: string | null
          id: string
          last_seen_at: string | null
          priority: string | null
          repeat_interval: number | null
          repeat_type: string | null
          status: string | null
          sync_connection_id: string | null
          sync_error: string | null
          sync_provider: string | null
          synced_at: string | null
          tag_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          external_task_id?: string | null
          id?: string
          last_seen_at?: string | null
          priority?: string | null
          repeat_interval?: number | null
          repeat_type?: string | null
          status?: string | null
          sync_connection_id?: string | null
          sync_error?: string | null
          sync_provider?: string | null
          synced_at?: string | null
          tag_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          external_task_id?: string | null
          id?: string
          last_seen_at?: string | null
          priority?: string | null
          repeat_interval?: number | null
          repeat_type?: string | null
          status?: string | null
          sync_connection_id?: string | null
          sync_error?: string | null
          sync_provider?: string | null
          synced_at?: string | null
          tag_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_google_connection_id_fkey"
            columns: ["sync_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_google_connection_id_fkey"
            columns: ["sync_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      integration_connections_view: {
        Row: {
          account_email: string | null
          calendar_sync_enabled: boolean | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          last_error: string | null
          last_scanned_at: string | null
          last_synced_at: string | null
          message_scan_enabled: boolean | null
          provider: string | null
          scope: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_email?: string | null
          calendar_sync_enabled?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          last_error?: string | null
          last_scanned_at?: string | null
          last_synced_at?: string | null
          message_scan_enabled?: boolean | null
          provider?: string | null
          scope?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_email?: string | null
          calendar_sync_enabled?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          last_error?: string | null
          last_scanned_at?: string | null
          last_synced_at?: string | null
          message_scan_enabled?: boolean | null
          provider?: string | null
          scope?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_and_increment_ai_usage: {
        Args: { p_daily_limit: number; p_feature: string; p_user_id?: string }
        Returns: boolean
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


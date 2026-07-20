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
      animation_rigs: {
        Row: {
          available_actions: string[]
          cloned_from_rig_id: string | null
          created_at: string
          id: string
          name: string
          rig_config: Json
          style: Database["public"]["Enums"]["rig_style"] | null
          version: number
          workspace_id: string | null
        }
        Insert: {
          available_actions: string[]
          cloned_from_rig_id?: string | null
          created_at?: string
          id?: string
          name: string
          rig_config: Json
          style?: Database["public"]["Enums"]["rig_style"] | null
          version?: number
          workspace_id?: string | null
        }
        Update: {
          available_actions?: string[]
          cloned_from_rig_id?: string | null
          created_at?: string
          id?: string
          name?: string
          rig_config?: Json
          style?: Database["public"]["Enums"]["rig_style"] | null
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animation_rigs_cloned_from_rig_id_fkey"
            columns: ["cloned_from_rig_id"]
            isOneToOne: false
            referencedRelation: "animation_rigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animation_rigs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_ledger_entries: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          job_step: Database["public"]["Enums"]["job_step"]
          project_id: string
          provider: string
          units_consumed: number | null
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          job_step: Database["public"]["Enums"]["job_step"]
          project_id: string
          provider: string
          units_consumed?: number | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          job_step?: Database["public"]["Enums"]["job_step"]
          project_id?: string
          provider?: string
          units_consumed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_ledger_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["job_event_type"]
          id: string
          job_id: string
          job_step: Database["public"]["Enums"]["job_step"]
          message: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["job_event_type"]
          id?: string
          job_id: string
          job_step: Database["public"]["Enums"]["job_step"]
          message?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["job_event_type"]
          id?: string
          job_id?: string
          job_step?: Database["public"]["Enums"]["job_step"]
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempt_count: number
          current_step: Database["public"]["Enums"]["job_step"]
          error_log: string | null
          id: string
          progress: number
          project_id: string
          state_payload: Json | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          current_step: Database["public"]["Enums"]["job_step"]
          error_log?: string | null
          id?: string
          progress?: number
          project_id: string
          state_payload?: Json | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          current_step?: Database["public"]["Enums"]["job_step"]
          error_log?: string | null
          id?: string
          progress?: number
          project_id?: string
          state_payload?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          channel_id: string | null
          cost_accumulated: number | null
          created_at: string
          duration_target_minutes: number | null
          id: string
          language: string | null
          status: Database["public"]["Enums"]["video_status"]
          style_preset_id: string | null
          title: string
          topic: string
          updated_at: string
          user_id: string
          video_style: Database["public"]["Enums"]["video_style"]
        }
        Insert: {
          channel_id?: string | null
          cost_accumulated?: number | null
          created_at?: string
          duration_target_minutes?: number | null
          id?: string
          language?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          style_preset_id?: string | null
          title: string
          topic: string
          updated_at?: string
          user_id: string
          video_style?: Database["public"]["Enums"]["video_style"]
        }
        Update: {
          channel_id?: string | null
          cost_accumulated?: number | null
          created_at?: string
          duration_target_minutes?: number | null
          id?: string
          language?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          style_preset_id?: string | null
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
          video_style?: Database["public"]["Enums"]["video_style"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_style_preset_id_fkey"
            columns: ["style_preset_id"]
            isOneToOne: false
            referencedRelation: "video_style_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_versions: {
        Row: {
          animation_action: string | null
          animation_rig_id: string | null
          background_broll_url: string | null
          broll_search_keywords: string | null
          camera_style: string | null
          created_at: string
          created_by: string | null
          emotional_tone: string | null
          id: string
          scene_id: string
          script_segment: string
          transition: string | null
          typography_template: string | null
          version_number: number
          visual_prompt: string | null
          visual_type: Database["public"]["Enums"]["scene_visual_type"]
        }
        Insert: {
          animation_action?: string | null
          animation_rig_id?: string | null
          background_broll_url?: string | null
          broll_search_keywords?: string | null
          camera_style?: string | null
          created_at?: string
          created_by?: string | null
          emotional_tone?: string | null
          id?: string
          scene_id: string
          script_segment: string
          transition?: string | null
          typography_template?: string | null
          version_number: number
          visual_prompt?: string | null
          visual_type: Database["public"]["Enums"]["scene_visual_type"]
        }
        Update: {
          animation_action?: string | null
          animation_rig_id?: string | null
          background_broll_url?: string | null
          broll_search_keywords?: string | null
          camera_style?: string | null
          created_at?: string
          created_by?: string | null
          emotional_tone?: string | null
          id?: string
          scene_id?: string
          script_segment?: string
          transition?: string | null
          typography_template?: string | null
          version_number?: number
          visual_prompt?: string | null
          visual_type?: Database["public"]["Enums"]["scene_visual_type"]
        }
        Relationships: [
          {
            foreignKeyName: "scene_versions_animation_rig_id_fkey"
            columns: ["animation_rig_id"]
            isOneToOne: false
            referencedRelation: "animation_rigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_versions_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          created_at: string
          current_version_id: string | null
          duration: number | null
          id: string
          preview_url: string | null
          project_id: string
          render_status: Database["public"]["Enums"]["video_status"]
          render_url: string | null
          sequence_number: number
          voiceover_url: string | null
          voiceover_word_timings: Json | null
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          duration?: number | null
          id?: string
          preview_url?: string | null
          project_id: string
          render_status?: Database["public"]["Enums"]["video_status"]
          render_url?: string | null
          sequence_number: number
          voiceover_url?: string | null
          voiceover_word_timings?: Json | null
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          duration?: number | null
          id?: string
          preview_url?: string | null
          project_id?: string
          render_status?: Database["public"]["Enums"]["video_status"]
          render_url?: string | null
          sequence_number?: number
          voiceover_url?: string | null
          voiceover_word_timings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "scene_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      video_style_presets: {
        Row: {
          allow_scene_override: boolean
          created_at: string
          default_camera_pacing: string | null
          default_rig_id: string | null
          default_transition: string | null
          id: string
          name: string
          style: Database["public"]["Enums"]["video_style"]
          visual_type_weights: Json
          workspace_id: string | null
        }
        Insert: {
          allow_scene_override?: boolean
          created_at?: string
          default_camera_pacing?: string | null
          default_rig_id?: string | null
          default_transition?: string | null
          id?: string
          name: string
          style: Database["public"]["Enums"]["video_style"]
          visual_type_weights: Json
          workspace_id?: string | null
        }
        Update: {
          allow_scene_override?: boolean
          created_at?: string
          default_camera_pacing?: string | null
          default_rig_id?: string | null
          default_transition?: string | null
          id?: string
          name?: string
          style?: Database["public"]["Enums"]["video_style"]
          visual_type_weights?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_style_presets_default_rig_id_fkey"
            columns: ["default_rig_id"]
            isOneToOne: false
            referencedRelation: "animation_rigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_style_presets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          monthly_cost_cap_usd: number | null
          name: string
          owner_id: string
          plan: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_cost_cap_usd?: number | null
          name: string
          owner_id: string
          plan?: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_cost_cap_usd?: number | null
          name?: string
          owner_id?: string
          plan?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_event_type: "started" | "finished" | "failed" | "retrying"
      job_step:
        | "research"
        | "outline"
        | "script_direction"
        | "brand_safety_check"
        | "voiceover"
        | "subtitle_extraction"
        | "scene_preview"
        | "scene_render"
        | "composition"
        | "rendering"
        | "thumbnail"
        | "metadata"
        | "cost_reconciliation"
        | "upload"
        | "notify"
      rig_style: "stickman" | "branded_character"
      scene_visual_type:
        | "character_animation"
        | "broll"
        | "ai_image"
        | "kinetic_typography"
        | "avatar"
      video_status:
        | "draft"
        | "queued"
        | "generating"
        | "awaiting_approval"
        | "rendered"
        | "failed"
        | "completed"
      video_style:
        | "stickman_animation"
        | "documentary"
        | "kinetic_typography"
        | "avatar_narration"
        | "mixed_custom"
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
    Enums: {
      job_event_type: ["started", "finished", "failed", "retrying"],
      job_step: [
        "research",
        "outline",
        "script_direction",
        "brand_safety_check",
        "voiceover",
        "subtitle_extraction",
        "scene_preview",
        "scene_render",
        "composition",
        "rendering",
        "thumbnail",
        "metadata",
        "cost_reconciliation",
        "upload",
        "notify",
      ],
      rig_style: ["stickman", "branded_character"],
      scene_visual_type: [
        "character_animation",
        "broll",
        "ai_image",
        "kinetic_typography",
        "avatar",
      ],
      video_status: [
        "draft",
        "queued",
        "generating",
        "awaiting_approval",
        "rendered",
        "failed",
        "completed",
      ],
      video_style: [
        "stickman_animation",
        "documentary",
        "kinetic_typography",
        "avatar_narration",
        "mixed_custom",
      ],
    },
  },
} as const


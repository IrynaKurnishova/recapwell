
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "action_items": {
                  Row: {
                    "created_at": string,"done": boolean,"due_date": string | null,"id": string,"org_id": string,"owner_name": string | null,"recap_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done"?: boolean,"due_date"?: string | null,"id"?: string,"org_id": string,"owner_name"?: string | null,"recap_id": string,"text": string
                  }
                  Update: {
                    "created_at"?: string,"done"?: boolean,"due_date"?: string | null,"id"?: string,"org_id"?: string,"owner_name"?: string | null,"recap_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "action_items_recap_id_org_id_fkey"
      columns: ["recap_id","org_id"]
isOneToOne: false
      referencedRelation: "recaps"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"meta": NonNullable<Json>,"org_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"meta"?: NonNullable<Json>,"org_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"meta"?: NonNullable<Json>,"org_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"org_id": string,"role": Database["public"]['Enums']["org_role"],"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"org_id": string,"role"?: Database["public"]['Enums']["org_role"],"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"org_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"org_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"role"?: Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "description": string,"key": string,"min_plan": Database["public"]['Enums']["plan_tier"],"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"key": string,"min_plan"?: Database["public"]['Enums']["plan_tier"],"name": string,"sort_order"?: number
                  }
                  Update: {
                    "description"?: string,"key"?: string,"min_plan"?: Database["public"]['Enums']["plan_tier"],"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"org_modules": {
                  Row: {
                    "enabled": boolean,"module_key": string,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"module_key": string,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "enabled"?: boolean,"module_key"?: string,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_modules_module_key_fkey"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "org_modules_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plan_limits": {
                  Row: {
                    "max_members": number,"monthly_recaps": number,"plan": Database["public"]['Enums']["plan_tier"]
                  }
                  ComputedFields: never
                  Insert: {
                    "max_members": number,"monthly_recaps": number,"plan": Database["public"]['Enums']["plan_tier"]
                  }
                  Update: {
                    "max_members"?: number,"monthly_recaps"?: number,"plan"?: Database["public"]['Enums']["plan_tier"]
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string,"full_name": string | null,"id": string,"is_super_admin": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email": string,"full_name"?: string | null,"id": string,"is_super_admin"?: boolean
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"is_super_admin"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"recaps": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"input_notes": string,"input_tokens": number | null,"model": string | null,"org_id": string,"output": Json | null,"output_tokens": number | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"input_notes": string,"input_tokens"?: number | null,"model"?: string | null,"org_id": string,"output"?: Json | null,"output_tokens"?: number | null,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"input_notes"?: string,"input_tokens"?: number | null,"model"?: string | null,"org_id"?: string,"output"?: Json | null,"output_tokens"?: number | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recaps_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "event_id": string,"processed_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"processed_at"?: string,"type": string
                  }
                  Update: {
                    "event_id"?: string,"processed_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"current_period_end": string | null,"org_id": string,"plan": Database["public"]['Enums']["plan_tier"],"status": Database["public"]['Enums']["subscription_status"],"stripe_customer_id": string | null,"stripe_price_id": string | null,"stripe_subscription_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean,"current_period_end"?: string | null,"org_id": string,"plan"?: Database["public"]['Enums']["plan_tier"],"status"?: Database["public"]['Enums']["subscription_status"],"stripe_customer_id"?: string | null,"stripe_price_id"?: string | null,"stripe_subscription_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"current_period_end"?: string | null,"org_id"?: string,"plan"?: Database["public"]['Enums']["plan_tier"],"status"?: Database["public"]['Enums']["subscription_status"],"stripe_customer_id"?: string | null,"stripe_price_id"?: string | null,"stripe_subscription_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_counters": {
                  Row: {
                    "org_id": string,"period_start": string,"recaps_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "org_id": string,"period_start": string,"recaps_count"?: number
                  }
                  Update: {
                    "org_id"?: string,"period_start"?: string,"recaps_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_counters_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"create_organization":
{ Args: { "p_name": string,"p_slug": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"id": string,
"name": string,
"slug": string
            }
                          SetofOptions: {
        from: "*"
        to: "organizations"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_invitation":
{ Args: { "p_token": string }; Returns: {
              "accepted": boolean,"email": string,"expired": boolean,"org_name": string,"org_slug": string,"role": Database["public"]['Enums']["org_role"]
            }[]
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"org_enabled_modules":
{ Args: { "p_org": string }; Returns: string[]
                           },
"release_recap":
{ Args: { "p_org": string,"p_period": string }; Returns: undefined
                           },
"remove_member":
{ Args: { "p_org": string,"p_user": string }; Returns: undefined
                           },
"reserve_recap":
{ Args: { "p_org": string }; Returns: string
                           },
"set_member_role":
{ Args: { "p_org": string,"p_role": Database["public"]['Enums']["org_role"],"p_user": string }; Returns: undefined
                           }
          }
          Enums: {
            "org_role": "owner"|"admin"|"member","plan_tier": "free"|"team","subscription_status": "active"|"trialing"|"past_due"|"canceled"|"incomplete"|"incomplete_expired"|"unpaid"|"paused"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "org_role": ["owner", "admin", "member"],"plan_tier": ["free", "team"],"subscription_status": ["active", "trialing", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"]
          }
        }
} as const

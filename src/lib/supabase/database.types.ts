export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "club_settings": {
                  Row: {
                    "club_name": string,"created_at": string,"id": boolean,"locale": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_name": string,"created_at"?: string,"id"?: boolean,"locale"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "club_name"?: string,"created_at"?: string,"id"?: boolean,"locale"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"documents": {
                  Row: {
                    "board_shared": boolean,"id": string,"object_path": string,"sponsor_id": string,"sponsor_shared": boolean,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_shared"?: boolean,"id"?: string,"object_path": string,"sponsor_id": string,"sponsor_shared"?: boolean,"title": string
                  }
                  Update: {
                    "board_shared"?: boolean,"id"?: string,"object_path"?: string,"sponsor_id"?: string,"sponsor_shared"?: boolean,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: false
      referencedRelation: "sponsors"
      referencedColumns: ["id"]
    }
                  ]
                },"sponsor_contacts": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"email": string | null,"id": string,"is_primary": boolean,"name": string,"phone": string | null,"position": string | null,"sponsor_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"is_primary"?: boolean,"name": string,"phone"?: string | null,"position"?: string | null,"sponsor_id": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"is_primary"?: boolean,"name"?: string,"phone"?: string | null,"position"?: string | null,"sponsor_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sponsor_contacts_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: false
      referencedRelation: "sponsors"
      referencedColumns: ["id"]
    }
                  ]
                },"sponsor_internal": {
                  Row: {
                    "email": string | null,"kvk": string | null,"notes": string | null,"owner_id": string | null,"phone": string | null,"postal_code": string | null,"sponsor_id": string,"status": string,"street": string | null,"updated_at": string,"vat_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "email"?: string | null,"kvk"?: string | null,"notes"?: string | null,"owner_id"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"sponsor_id": string,"status"?: string,"street"?: string | null,"updated_at"?: string,"vat_number"?: string | null
                  }
                  Update: {
                    "email"?: string | null,"kvk"?: string | null,"notes"?: string | null,"owner_id"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"sponsor_id"?: string,"status"?: string,"street"?: string | null,"updated_at"?: string,"vat_number"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sponsor_internal_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: true
      referencedRelation: "sponsors"
      referencedColumns: ["id"]
    }
                  ]
                },"sponsors": {
                  Row: {
                    "archived_at": string | null,"city": string | null,"created_at": string,"id": string,"name": string,"trading_name": string | null,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"name": string,"trading_name"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"trading_name"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [

                  ]
                },"user_profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "crm_owners":
{ Args: Record<PropertyKey, never>; Returns: {
              "label": string,"user_id": string
            }[]
                           },
"get_access_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"manage_sponsor_member":
{ Args: { "active": boolean,"company": string,"contact": string,"target": string }; Returns: undefined
                           },
"save_sponsor":
{ Args: { "details": Json,"target": string }; Returns: string
                           },
"save_sponsor_contact":
{ Args: { "company": string,"details": Json,"target": string }; Returns: string
                           },
"set_user_access":
{ Args: { "active": boolean,"company"?: string,"new_role": string,"target": string }; Returns: undefined
                           },
"sponsor_members":
{ Args: { "company": string }; Returns: {
              "is_active": boolean,"label": string,"user_id": string
            }[]
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
  "public": {
          Enums: {

          }
        }
} as const

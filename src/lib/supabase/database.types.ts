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
                },"contract_amendments": {
                  Row: {
                    "changes": NonNullable<Json>,"contract_id": string,"created_at": string,"created_by": string | null,"effective_on": string,"id": string,"reason": string,"sequence_number": number,"sponsor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changes"?: NonNullable<Json>,"contract_id": string,"created_at"?: string,"created_by"?: string | null,"effective_on": string,"id"?: string,"reason": string,"sequence_number": number,"sponsor_id": string
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"effective_on"?: string,"id"?: string,"reason"?: string,"sequence_number"?: number,"sponsor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_amendments_contract_id_sponsor_id_fkey"
      columns: ["contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contract_totals"
      referencedColumns: ["contract_id","sponsor_id"]
    },{
      foreignKeyName: "contract_amendments_contract_id_sponsor_id_fkey"
      columns: ["contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","sponsor_id"]
    }
                  ]
                },"contract_documents": {
                  Row: {
                    "contract_id": string,"created_at": string,"document_id": string,"document_role": string,"sponsor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_id": string,"created_at"?: string,"document_id": string,"document_role"?: string,"sponsor_id": string
                  }
                  Update: {
                    "contract_id"?: string,"created_at"?: string,"document_id"?: string,"document_role"?: string,"sponsor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_documents_contract_id_sponsor_id_fkey"
      columns: ["contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contract_totals"
      referencedColumns: ["contract_id","sponsor_id"]
    },{
      foreignKeyName: "contract_documents_contract_id_sponsor_id_fkey"
      columns: ["contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","sponsor_id"]
    },{
      foreignKeyName: "contract_documents_document_id_sponsor_id_fkey"
      columns: ["document_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","sponsor_id"]
    }
                  ]
                },"contract_lines": {
                  Row: {
                    "amendment_id": string | null,"contract_id": string,"created_at": string,"currency": string,"description": string | null,"id": string,"line_total": number | null,"package_version_id": string | null,"position": number,"quantity": number,"sponsor_id": string,"title": string,"unit_price": number,"vat_rate": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amendment_id"?: string | null,"contract_id": string,"created_at"?: string,"currency"?: string,"description"?: string | null,"id"?: string,"line_total"?: never,"package_version_id"?: string | null,"position"?: number,"quantity": number,"sponsor_id": string,"title": string,"unit_price": number,"vat_rate"?: number | null
                  }
                  Update: {
                    "amendment_id"?: string | null,"contract_id"?: string,"created_at"?: string,"currency"?: string,"description"?: string | null,"id"?: string,"line_total"?: never,"package_version_id"?: string | null,"position"?: number,"quantity"?: number,"sponsor_id"?: string,"title"?: string,"unit_price"?: number,"vat_rate"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_lines_amendment_id_contract_id_fkey"
      columns: ["amendment_id","contract_id"]
isOneToOne: false
      referencedRelation: "contract_amendments"
      referencedColumns: ["id","contract_id"]
    },{
      foreignKeyName: "contract_lines_contract_id_sponsor_id_fkey"
      columns: ["contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contract_totals"
      referencedColumns: ["contract_id","sponsor_id"]
    },{
      foreignKeyName: "contract_lines_contract_id_sponsor_id_fkey"
      columns: ["contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","sponsor_id"]
    },{
      foreignKeyName: "contract_lines_package_version_id_fkey"
      columns: ["package_version_id"]
isOneToOne: false
      referencedRelation: "package_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_rights": {
                  Row: {
                    "amendment_id": string | null,"cancelled_by_amendment_id": string | null,"contract_id": string,"contract_line_id": string | null,"created_at": string,"deadline": string | null,"description": string,"id": string,"portal_visible": boolean,"position": number,"quantity": number,"responsible_id": string | null,"source_template_id": string | null,"sponsor_id": string,"status": string,"unit": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amendment_id"?: string | null,"cancelled_by_amendment_id"?: string | null,"contract_id": string,"contract_line_id"?: string | null,"created_at"?: string,"deadline"?: string | null,"description": string,"id"?: string,"portal_visible"?: boolean,"position"?: number,"quantity": number,"responsible_id"?: string | null,"source_template_id"?: string | null,"sponsor_id": string,"status"?: string,"unit": string,"updated_at"?: string
                  }
                  Update: {
                    "amendment_id"?: string | null,"cancelled_by_amendment_id"?: string | null,"contract_id"?: string,"contract_line_id"?: string | null,"created_at"?: string,"deadline"?: string | null,"description"?: string,"id"?: string,"portal_visible"?: boolean,"position"?: number,"quantity"?: number,"responsible_id"?: string | null,"source_template_id"?: string | null,"sponsor_id"?: string,"status"?: string,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_rights_amendment_id_contract_id_fkey"
      columns: ["amendment_id","contract_id"]
isOneToOne: false
      referencedRelation: "contract_amendments"
      referencedColumns: ["id","contract_id"]
    },{
      foreignKeyName: "contract_rights_cancelled_by_amendment_id_contract_id_fkey"
      columns: ["cancelled_by_amendment_id","contract_id"]
isOneToOne: false
      referencedRelation: "contract_amendments"
      referencedColumns: ["id","contract_id"]
    },{
      foreignKeyName: "contract_rights_contract_id_sponsor_id_fkey"
      columns: ["contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contract_totals"
      referencedColumns: ["contract_id","sponsor_id"]
    },{
      foreignKeyName: "contract_rights_contract_id_sponsor_id_fkey"
      columns: ["contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","sponsor_id"]
    },{
      foreignKeyName: "contract_rights_contract_line_id_contract_id_fkey"
      columns: ["contract_line_id","contract_id"]
isOneToOne: false
      referencedRelation: "contract_lines"
      referencedColumns: ["id","contract_id"]
    },{
      foreignKeyName: "contract_rights_source_template_id_fkey"
      columns: ["source_template_id"]
isOneToOne: false
      referencedRelation: "package_right_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"contracts": {
                  Row: {
                    "confirmed_at": string | null,"confirmed_by": string | null,"contract_number": string,"created_at": string,"created_by": string | null,"currency": string,"ends_on": string,"id": string,"notice_deadline": string | null,"party_snapshot": Json | null,"predecessor_contract_id": string | null,"renewal_terms": string | null,"sponsor_id": string,"starts_on": string,"status": string,"terminated_at": string | null,"terminated_on": string | null,"termination_reason": string | null,"terms": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string | null,"confirmed_by"?: string | null,"contract_number": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"ends_on": string,"id"?: string,"notice_deadline"?: string | null,"party_snapshot"?: Json | null,"predecessor_contract_id"?: string | null,"renewal_terms"?: string | null,"sponsor_id": string,"starts_on": string,"status"?: string,"terminated_at"?: string | null,"terminated_on"?: string | null,"termination_reason"?: string | null,"terms"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "confirmed_at"?: string | null,"confirmed_by"?: string | null,"contract_number"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"ends_on"?: string,"id"?: string,"notice_deadline"?: string | null,"party_snapshot"?: Json | null,"predecessor_contract_id"?: string | null,"renewal_terms"?: string | null,"sponsor_id"?: string,"starts_on"?: string,"status"?: string,"terminated_at"?: string | null,"terminated_on"?: string | null,"termination_reason"?: string | null,"terms"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_predecessor_contract_id_sponsor_id_fkey"
      columns: ["predecessor_contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contract_totals"
      referencedColumns: ["contract_id","sponsor_id"]
    },{
      foreignKeyName: "contracts_predecessor_contract_id_sponsor_id_fkey"
      columns: ["predecessor_contract_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id","sponsor_id"]
    },{
      foreignKeyName: "contracts_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: false
      referencedRelation: "sponsors"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "board_shared": boolean,"category": string,"checksum": string | null,"created_at": string,"id": string,"mime_type": string | null,"object_path": string,"size_bytes": number | null,"sponsor_id": string,"sponsor_shared": boolean,"title": string,"upload_status": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "board_shared"?: boolean,"category"?: string,"checksum"?: string | null,"created_at"?: string,"id"?: string,"mime_type"?: string | null,"object_path": string,"size_bytes"?: number | null,"sponsor_id": string,"sponsor_shared"?: boolean,"title": string,"upload_status"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "board_shared"?: boolean,"category"?: string,"checksum"?: string | null,"created_at"?: string,"id"?: string,"mime_type"?: string | null,"object_path"?: string,"size_bytes"?: number | null,"sponsor_id"?: string,"sponsor_shared"?: boolean,"title"?: string,"upload_status"?: string,"uploaded_by"?: string | null
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
                },"fulfillment_evidence": {
                  Row: {
                    "created_at": string,"document_id": string,"right_fulfillment_id": string,"sponsor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_id": string,"right_fulfillment_id": string,"sponsor_id": string
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string,"right_fulfillment_id"?: string,"sponsor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fulfillment_evidence_document_id_sponsor_id_fkey"
      columns: ["document_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","sponsor_id"]
    },{
      foreignKeyName: "fulfillment_evidence_right_fulfillment_id_sponsor_id_fkey"
      columns: ["right_fulfillment_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "right_fulfillments"
      referencedColumns: ["id","sponsor_id"]
    }
                  ]
                },"package_right_templates": {
                  Row: {
                    "description": string,"id": string,"package_version_id": string,"position": number,"quantity": number,"timing": string | null,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"id"?: string,"package_version_id": string,"position"?: number,"quantity": number,"timing"?: string | null,"unit": string
                  }
                  Update: {
                    "description"?: string,"id"?: string,"package_version_id"?: string,"position"?: number,"quantity"?: number,"timing"?: string | null,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "package_right_templates_package_version_id_fkey"
      columns: ["package_version_id"]
isOneToOne: false
      referencedRelation: "package_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"package_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"description": string | null,"id": string,"list_price": number | null,"package_id": string,"published_at": string | null,"published_by": string | null,"status": string,"updated_at": string,"vat_rate": number | null,"version_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"list_price"?: number | null,"package_id": string,"published_at"?: string | null,"published_by"?: string | null,"status"?: string,"updated_at"?: string,"vat_rate"?: number | null,"version_number": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"list_price"?: number | null,"package_id"?: string,"published_at"?: string | null,"published_by"?: string | null,"status"?: string,"updated_at"?: string,"vat_rate"?: number | null,"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "package_versions_package_id_fkey"
      columns: ["package_id"]
isOneToOne: false
      referencedRelation: "sponsorship_packages"
      referencedColumns: ["id"]
    }
                  ]
                },"right_fulfillments": {
                  Row: {
                    "contract_right_id": string,"description": string,"fulfilled_on": string,"id": string,"portal_visible": boolean,"quantity": number,"registered_at": string,"registered_by": string | null,"sponsor_id": string,"verified_at": string | null,"verified_by": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_right_id": string,"description": string,"fulfilled_on": string,"id"?: string,"portal_visible"?: boolean,"quantity": number,"registered_at"?: string,"registered_by"?: string | null,"sponsor_id": string,"verified_at"?: string | null,"verified_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "contract_right_id"?: string,"description"?: string,"fulfilled_on"?: string,"id"?: string,"portal_visible"?: boolean,"quantity"?: number,"registered_at"?: string,"registered_by"?: string | null,"sponsor_id"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "right_fulfillments_contract_right_id_sponsor_id_fkey"
      columns: ["contract_right_id","sponsor_id"]
isOneToOne: false
      referencedRelation: "contract_rights"
      referencedColumns: ["id","sponsor_id"]
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
                },"sponsorship_packages": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
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
            "contract_totals": {
                  Row: {
                    "baseline_total": number | null,"contract_id": string,"current_total": number | null,"line_count": number | null,"sponsor_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "contracts_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: false
      referencedRelation: "sponsors"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_contract_amendment":
{ Args: { "details": Json,"target": string }; Returns: string
                           },
"add_contract_line":
{ Args: { "contract": string,"details": Json }; Returns: string
                           },
"add_contract_right":
{ Args: { "contract": string,"details": Json }; Returns: string
                           },
"confirm_contract":
{ Args: { "target": string }; Returns: undefined
                           },
"create_contract":
{ Args: { "company": string,"details": Json }; Returns: string
                           },
"crm_owners":
{ Args: Record<PropertyKey, never>; Returns: {
              "label": string,"user_id": string
            }[]
                           },
"finalize_document":
{ Args: { "target": string }; Returns: undefined
                           },
"get_access_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"manage_sponsor_member":
{ Args: { "active": boolean,"company": string,"contact": string,"target": string }; Returns: undefined
                           },
"publish_package_version":
{ Args: { "target": string }; Returns: undefined
                           },
"register_document":
{ Args: { "company": string,"details": Json,"link": Json }; Returns: string
                           },
"register_fulfillment":
{ Args: { "details": Json,"target": string }; Returns: string
                           },
"remove_contract_line":
{ Args: { "target": string }; Returns: undefined
                           },
"remove_contract_right":
{ Args: { "target": string }; Returns: undefined
                           },
"renew_contract":
{ Args: { "details": Json,"target": string }; Returns: string
                           },
"retire_package_version":
{ Args: { "target": string }; Returns: undefined
                           },
"review_fulfillment":
{ Args: { "action": string,"reason"?: string,"target": string }; Returns: undefined
                           },
"save_package":
{ Args: { "details": Json,"target": string }; Returns: string
                           },
"save_package_version":
{ Args: { "details": Json,"package": string,"target": string }; Returns: string
                           },
"save_sponsor":
{ Args: { "details": Json,"target": string }; Returns: string
                           },
"save_sponsor_contact":
{ Args: { "company": string,"details": Json,"target": string }; Returns: string
                           },
"set_package_archived":
{ Args: { "archive": boolean,"target": string }; Returns: undefined
                           },
"set_user_access":
{ Args: { "active": boolean,"company"?: string,"new_role": string,"target": string }; Returns: undefined
                           },
"sponsor_members":
{ Args: { "company": string }; Returns: {
              "is_active": boolean,"label": string,"user_id": string
            }[]
                           },
"terminate_contract":
{ Args: { "details": Json,"target": string }; Returns: undefined
                           },
"update_contract_draft":
{ Args: { "details": Json,"target": string }; Returns: undefined
                           },
"update_contract_right":
{ Args: { "details": Json,"target": string }; Returns: undefined
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

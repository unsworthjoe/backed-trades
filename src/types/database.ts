
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_alerts": {
                  Row: {
                    "created_at": string,"details": NonNullable<Json>,"id": string,"job_id": string | null,"kind": Database["public"]['Enums']["admin_alert_kind"],"resolved_at": string | null,"resolved_by": string | null,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"job_id"?: string | null,"kind": Database["public"]['Enums']["admin_alert_kind"],"resolved_at"?: string | null,"resolved_by"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"job_id"?: string | null,"kind"?: Database["public"]['Enums']["admin_alert_kind"],"resolved_at"?: string | null,"resolved_by"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_alerts_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_alerts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_audit_log": {
                  Row: {
                    "action": string,"admin_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"target_id": string | null,"target_table": string | null
                  }
                  Insert: {
                    "action": string,"admin_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"admin_invites": {
                  Row: {
                    "created_at": string,"email": string,"invited_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"invited_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"invited_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"app_settings": {
                  Row: {
                    "auto_close_hours": number,"callout_wave_minutes": number,"callout_window_minutes": number,"contact_due_hours": number,"customer_rating_min_count": number,"decline_limit": number,"default_queue_cap": number,"id": boolean,"id_image_retention_days": number,"low_rating_min_count": number,"low_rating_threshold": number,"miss_limit": number,"not_my_kind_limit": number,"offer_reminder_minutes": number,"offers_per_wave": number,"reply_window_minutes": number,"review_window_days": number,"signoff_reminder_hours": (number)[],"unmatched_alert_hours": number,"updated_at": string,"working_day_end": string,"working_day_start": string
                  }
                  Insert: {
                    "auto_close_hours"?: number,"callout_wave_minutes"?: number,"callout_window_minutes"?: number,"contact_due_hours"?: number,"customer_rating_min_count"?: number,"decline_limit"?: number,"default_queue_cap"?: number,"id"?: boolean,"id_image_retention_days"?: number,"low_rating_min_count"?: number,"low_rating_threshold"?: number,"miss_limit"?: number,"not_my_kind_limit"?: number,"offer_reminder_minutes"?: number,"offers_per_wave"?: number,"reply_window_minutes"?: number,"review_window_days"?: number,"signoff_reminder_hours"?: (number)[],"unmatched_alert_hours"?: number,"updated_at"?: string,"working_day_end"?: string,"working_day_start"?: string
                  }
                  Update: {
                    "auto_close_hours"?: number,"callout_wave_minutes"?: number,"callout_window_minutes"?: number,"contact_due_hours"?: number,"customer_rating_min_count"?: number,"decline_limit"?: number,"default_queue_cap"?: number,"id"?: boolean,"id_image_retention_days"?: number,"low_rating_min_count"?: number,"low_rating_threshold"?: number,"miss_limit"?: number,"not_my_kind_limit"?: number,"offer_reminder_minutes"?: number,"offers_per_wave"?: number,"reply_window_minutes"?: number,"review_window_days"?: number,"signoff_reminder_hours"?: (number)[],"unmatched_alert_hours"?: number,"updated_at"?: string,"working_day_end"?: string,"working_day_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customer_ratings": {
                  Row: {
                    "comment": string,"created_at": string,"customer_id": string,"id": string,"match_id": string,"released_at": string | null,"stars": number,"tags": (string)[],"trade_id": string
                  }
                  Insert: {
                    "comment"?: string,"created_at"?: string,"customer_id": string,"id"?: string,"match_id": string,"released_at"?: string | null,"stars": number,"tags"?: (string)[],"trade_id": string
                  }
                  Update: {
                    "comment"?: string,"created_at"?: string,"customer_id"?: string,"id"?: string,"match_id"?: string,"released_at"?: string | null,"stars"?: number,"tags"?: (string)[],"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_ratings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_ratings_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "job_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_ratings_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"id_checks": {
                  Row: {
                    "checked_at": string | null,"checked_by": string | null,"created_at": string,"id": string,"image_paths": (string)[],"images_purge_after": string | null,"images_purged_at": string | null,"provider": string,"result": Database["public"]['Enums']["id_check_result"],"trade_id": string
                  }
                  Insert: {
                    "checked_at"?: string | null,"checked_by"?: string | null,"created_at"?: string,"id"?: string,"image_paths"?: (string)[],"images_purge_after"?: string | null,"images_purged_at"?: string | null,"provider"?: string,"result"?: Database["public"]['Enums']["id_check_result"],"trade_id": string
                  }
                  Update: {
                    "checked_at"?: string | null,"checked_by"?: string | null,"created_at"?: string,"id"?: string,"image_paths"?: (string)[],"images_purge_after"?: string | null,"images_purged_at"?: string | null,"provider"?: string,"result"?: Database["public"]['Enums']["id_check_result"],"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "id_checks_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"job_addresses": {
                  Row: {
                    "address_line": string,"job_id": string,"postcode": string
                  }
                  Insert: {
                    "address_line"?: string,"job_id": string,"postcode": string
                  }
                  Update: {
                    "address_line"?: string,"job_id"?: string,"postcode"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_addresses_job_id_fkey"
      columns: ["job_id"]
isOneToOne: true
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_matches": {
                  Row: {
                    "auto_closed_at": string | null,"contact_due_at": string,"contacted_at": string | null,"done_at": string | null,"end_reason": Database["public"]['Enums']["match_end_reason"] | null,"ended_at": string | null,"id": string,"job_id": string,"matched_at": string,"no_contact_flagged_at": string | null,"offer_id": string,"signed_off_at": string | null,"trade_id": string
                  }
                  Insert: {
                    "auto_closed_at"?: string | null,"contact_due_at": string,"contacted_at"?: string | null,"done_at"?: string | null,"end_reason"?: Database["public"]['Enums']["match_end_reason"] | null,"ended_at"?: string | null,"id"?: string,"job_id": string,"matched_at"?: string,"no_contact_flagged_at"?: string | null,"offer_id": string,"signed_off_at"?: string | null,"trade_id": string
                  }
                  Update: {
                    "auto_closed_at"?: string | null,"contact_due_at"?: string,"contacted_at"?: string | null,"done_at"?: string | null,"end_reason"?: Database["public"]['Enums']["match_end_reason"] | null,"ended_at"?: string | null,"id"?: string,"job_id"?: string,"matched_at"?: string,"no_contact_flagged_at"?: string | null,"offer_id"?: string,"signed_off_at"?: string | null,"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_matches_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_matches_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: true
      referencedRelation: "job_offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_matches_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"job_offers": {
                  Row: {
                    "decline_note": string | null,"decline_reason": Database["public"]['Enums']["decline_reason"] | null,"expires_at": string,"id": string,"job_id": string,"offered_at": string,"queue_member_id": string | null,"responded_at": string | null,"status": Database["public"]['Enums']["offer_status"],"trade_id": string,"wave": number
                  }
                  Insert: {
                    "decline_note"?: string | null,"decline_reason"?: Database["public"]['Enums']["decline_reason"] | null,"expires_at": string,"id"?: string,"job_id": string,"offered_at"?: string,"queue_member_id"?: string | null,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["offer_status"],"trade_id": string,"wave"?: number
                  }
                  Update: {
                    "decline_note"?: string | null,"decline_reason"?: Database["public"]['Enums']["decline_reason"] | null,"expires_at"?: string,"id"?: string,"job_id"?: string,"offered_at"?: string,"queue_member_id"?: string | null,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["offer_status"],"trade_id"?: string,"wave"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_offers_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_offers_queue_member_id_fkey"
      columns: ["queue_member_id"]
isOneToOne: false
      referencedRelation: "queue_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_offers_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"job_photos": {
                  Row: {
                    "created_at": string,"id": string,"job_id": string,"storage_path": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"job_id": string,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"job_id"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_photos_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "budget": Database["public"]['Enums']["job_budget"],"cancelled_at": string | null,"category_id": number,"completed_at": string | null,"created_at": string,"current_wave": number,"customer_id": string,"description": string,"district": string,"expanded_at": string | null,"id": string,"is_callout": boolean,"last_wave_at": string | null,"size": Database["public"]['Enums']["job_size"],"status": Database["public"]['Enums']["job_status"],"timing": Database["public"]['Enums']["job_timing"],"title": string,"town_id": number,"unmatched_alerted_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "budget"?: Database["public"]['Enums']["job_budget"],"cancelled_at"?: string | null,"category_id": number,"completed_at"?: string | null,"created_at"?: string,"current_wave"?: number,"customer_id": string,"description"?: string,"district": string,"expanded_at"?: string | null,"id"?: string,"is_callout"?: boolean,"last_wave_at"?: string | null,"size"?: Database["public"]['Enums']["job_size"],"status"?: Database["public"]['Enums']["job_status"],"timing"?: Database["public"]['Enums']["job_timing"],"title": string,"town_id": number,"unmatched_alerted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "budget"?: Database["public"]['Enums']["job_budget"],"cancelled_at"?: string | null,"category_id"?: number,"completed_at"?: string | null,"created_at"?: string,"current_wave"?: number,"customer_id"?: string,"description"?: string,"district"?: string,"expanded_at"?: string | null,"id"?: string,"is_callout"?: boolean,"last_wave_at"?: string | null,"size"?: Database["public"]['Enums']["job_size"],"status"?: Database["public"]['Enums']["job_status"],"timing"?: Database["public"]['Enums']["job_timing"],"title"?: string,"town_id"?: number,"unmatched_alerted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "trade_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_town_id_fkey"
      columns: ["town_id"]
isOneToOne: false
      referencedRelation: "towns"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"match_id": string,"read_at": string | null,"sender_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"match_id": string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"match_id"?: string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "job_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"cancelled_at": string | null,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"data": NonNullable<Json>,"failed_at": string | null,"id": number,"last_error": string | null,"scheduled_for": string,"sent_at": string | null,"template": string,"urgent": boolean,"user_id": string
                  }
                  Insert: {
                    "attempts"?: number,"cancelled_at"?: string | null,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"data"?: NonNullable<Json>,"failed_at"?: string | null,"id"?: never,"last_error"?: string | null,"scheduled_for"?: string,"sent_at"?: string | null,"template": string,"urgent"?: boolean,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"cancelled_at"?: string | null,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"data"?: NonNullable<Json>,"failed_at"?: string | null,"id"?: never,"last_error"?: string | null,"scheduled_for"?: string,"sent_at"?: string | null,"template"?: string,"urgent"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"postcode_districts": {
                  Row: {
                    "district": string,"town_id": number
                  }
                  Insert: {
                    "district": string,"town_id": number
                  }
                  Update: {
                    "district"?: string,"town_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "postcode_districts_town_id_fkey"
      columns: ["town_id"]
isOneToOne: false
      referencedRelation: "towns"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id": string,"phone"?: string | null,"role": Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"id": string,"last_seen_at": string,"platform": string,"token": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_seen_at"?: string,"platform": string,"token": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_seen_at"?: string,"platform"?: string,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"queue_members": {
                  Row: {
                    "consecutive_declines": number,"id": string,"joined_at": string,"last_offered_at": string | null,"last_won_at": string | null,"not_my_kind_count": number,"position": number,"queue_id": string,"status": Database["public"]['Enums']["queue_member_status"],"trade_id": string,"tuned_out_at": string | null
                  }
                  Insert: {
                    "consecutive_declines"?: number,"id"?: string,"joined_at"?: string,"last_offered_at"?: string | null,"last_won_at"?: string | null,"not_my_kind_count"?: number,"position"?: number,"queue_id": string,"status": Database["public"]['Enums']["queue_member_status"],"trade_id": string,"tuned_out_at"?: string | null
                  }
                  Update: {
                    "consecutive_declines"?: number,"id"?: string,"joined_at"?: string,"last_offered_at"?: string | null,"last_won_at"?: string | null,"not_my_kind_count"?: number,"position"?: number,"queue_id"?: string,"status"?: Database["public"]['Enums']["queue_member_status"],"trade_id"?: string,"tuned_out_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "queue_members_queue_id_fkey"
      columns: ["queue_id"]
isOneToOne: false
      referencedRelation: "queues"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "queue_members_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"queues": {
                  Row: {
                    "cap": number,"category_id": number,"created_at": string,"id": string,"town_id": number
                  }
                  Insert: {
                    "cap"?: number,"category_id": number,"created_at"?: string,"id"?: string,"town_id": number
                  }
                  Update: {
                    "cap"?: number,"category_id"?: number,"created_at"?: string,"id"?: string,"town_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "queues_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "trade_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "queues_town_id_fkey"
      columns: ["town_id"]
isOneToOne: false
      referencedRelation: "towns"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "about_user_id": string | null,"created_at": string,"details": string,"id": string,"job_id": string | null,"reason": string,"reporter_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["report_status"]
                  }
                  Insert: {
                    "about_user_id"?: string | null,"created_at"?: string,"details"?: string,"id"?: string,"job_id"?: string | null,"reason": string,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Update: {
                    "about_user_id"?: string | null,"created_at"?: string,"details"?: string,"id"?: string,"job_id"?: string | null,"reason"?: string,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_about_user_id_fkey"
      columns: ["about_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "comment": string,"created_at": string,"customer_id": string,"hidden_at": string | null,"hidden_reason": string | null,"id": string,"match_id": string,"overall": number | null,"quality": number,"released_at": string | null,"reliability": number,"tidiness": number,"trade_id": string,"value": number
                  }
                  Insert: {
                    "comment"?: string,"created_at"?: string,"customer_id": string,"hidden_at"?: string | null,"hidden_reason"?: string | null,"id"?: string,"match_id": string,"overall"?: never,"quality": number,"released_at"?: string | null,"reliability": number,"tidiness": number,"trade_id": string,"value": number
                  }
                  Update: {
                    "comment"?: string,"created_at"?: string,"customer_id"?: string,"hidden_at"?: string | null,"hidden_reason"?: string | null,"id"?: string,"match_id"?: string,"overall"?: never,"quality"?: number,"released_at"?: string | null,"reliability"?: number,"tidiness"?: number,"trade_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "job_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"created_at": string,"current_period_end": string | null,"id": string,"is_founding": boolean,"plan": Database["public"]['Enums']["subscription_plan"],"price_pence": number,"status": Database["public"]['Enums']["subscription_status"],"stripe_customer_id": string,"stripe_subscription_id": string | null,"trade_id": string,"updated_at": string
                  }
                  Insert: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"is_founding"?: boolean,"plan": Database["public"]['Enums']["subscription_plan"],"price_pence": number,"status": Database["public"]['Enums']["subscription_status"],"stripe_customer_id": string,"stripe_subscription_id"?: string | null,"trade_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"is_founding"?: boolean,"plan"?: Database["public"]['Enums']["subscription_plan"],"price_pence"?: number,"status"?: Database["public"]['Enums']["subscription_status"],"stripe_customer_id"?: string,"stripe_subscription_id"?: string | null,"trade_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: true
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"town_neighbours": {
                  Row: {
                    "neighbour_id": number,"town_id": number
                  }
                  Insert: {
                    "neighbour_id": number,"town_id": number
                  }
                  Update: {
                    "neighbour_id"?: number,"town_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "town_neighbours_neighbour_id_fkey"
      columns: ["neighbour_id"]
isOneToOne: false
      referencedRelation: "towns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "town_neighbours_town_id_fkey"
      columns: ["town_id"]
isOneToOne: false
      referencedRelation: "towns"
      referencedColumns: ["id"]
    }
                  ]
                },"towns": {
                  Row: {
                    "active": boolean,"id": number,"name": string,"slug": string
                  }
                  Insert: {
                    "active"?: boolean,"id"?: never,"name": string,"slug": string
                  }
                  Update: {
                    "active"?: boolean,"id"?: never,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trade_categories": {
                  Row: {
                    "active": boolean,"id": number,"name": string,"slug": string,"sort_order": number
                  }
                  Insert: {
                    "active"?: boolean,"id"?: never,"name": string,"slug": string,"sort_order": number
                  }
                  Update: {
                    "active"?: boolean,"id"?: never,"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"trade_category_links": {
                  Row: {
                    "category_id": number,"trade_id": string
                  }
                  Insert: {
                    "category_id": number,"trade_id": string
                  }
                  Update: {
                    "category_id"?: number,"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trade_category_links_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "trade_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trade_category_links_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"trade_documents": {
                  Row: {
                    "created_at": string,"doc_type": Database["public"]['Enums']["document_type"],"expires_on": string | null,"id": string,"notes": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["review_status"],"storage_path": string,"trade_id": string
                  }
                  Insert: {
                    "created_at"?: string,"doc_type": Database["public"]['Enums']["document_type"],"expires_on"?: string | null,"id"?: string,"notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"storage_path": string,"trade_id": string
                  }
                  Update: {
                    "created_at"?: string,"doc_type"?: Database["public"]['Enums']["document_type"],"expires_on"?: string | null,"id"?: string,"notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"storage_path"?: string,"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trade_documents_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"trade_photos": {
                  Row: {
                    "caption": string,"created_at": string,"id": string,"sort_order": number,"storage_path": string,"trade_id": string
                  }
                  Insert: {
                    "caption"?: string,"created_at"?: string,"id"?: string,"sort_order"?: number,"storage_path": string,"trade_id": string
                  }
                  Update: {
                    "caption"?: string,"created_at"?: string,"id"?: string,"sort_order"?: number,"storage_path"?: string,"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trade_photos_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"trade_registrations": {
                  Row: {
                    "created_at": string,"expires_on": string | null,"id": string,"registration_number": string,"reviewed_at": string | null,"reviewed_by": string | null,"scheme": Database["public"]['Enums']["registration_scheme"],"status": Database["public"]['Enums']["review_status"],"trade_id": string
                  }
                  Insert: {
                    "created_at"?: string,"expires_on"?: string | null,"id"?: string,"registration_number": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"scheme": Database["public"]['Enums']["registration_scheme"],"status"?: Database["public"]['Enums']["review_status"],"trade_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_on"?: string | null,"id"?: string,"registration_number"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"scheme"?: Database["public"]['Enums']["registration_scheme"],"status"?: Database["public"]['Enums']["review_status"],"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trade_registrations_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"trade_towns": {
                  Row: {
                    "town_id": number,"trade_id": string
                  }
                  Insert: {
                    "town_id": number,"trade_id": string
                  }
                  Update: {
                    "town_id"?: number,"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trade_towns_town_id_fkey"
      columns: ["town_id"]
isOneToOne: false
      referencedRelation: "towns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trade_towns_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"trades": {
                  Row: {
                    "accepts_callouts": boolean,"applied_at": string,"approved_at": string | null,"approved_by": string | null,"bio": string,"business_name": string,"business_type": Database["public"]['Enums']["business_type"],"can_take_large_jobs": boolean,"company_checked_at": string | null,"company_number": string | null,"consecutive_misses": number,"contact_phone": string | null,"created_at": string,"id": string,"paused_at": string | null,"paused_reason": Database["public"]['Enums']["pause_reason"] | null,"rejection_reason": string | null,"status": Database["public"]['Enums']["trade_status"],"submitted_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "accepts_callouts"?: boolean,"applied_at"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"bio"?: string,"business_name": string,"business_type": Database["public"]['Enums']["business_type"],"can_take_large_jobs"?: boolean,"company_checked_at"?: string | null,"company_number"?: string | null,"consecutive_misses"?: number,"contact_phone"?: string | null,"created_at"?: string,"id": string,"paused_at"?: string | null,"paused_reason"?: Database["public"]['Enums']["pause_reason"] | null,"rejection_reason"?: string | null,"status"?: Database["public"]['Enums']["trade_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accepts_callouts"?: boolean,"applied_at"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"bio"?: string,"business_name"?: string,"business_type"?: Database["public"]['Enums']["business_type"],"can_take_large_jobs"?: boolean,"company_checked_at"?: string | null,"company_number"?: string | null,"consecutive_misses"?: number,"contact_phone"?: string | null,"created_at"?: string,"id"?: string,"paused_at"?: string | null,"paused_reason"?: Database["public"]['Enums']["pause_reason"] | null,"rejection_reason"?: string | null,"status"?: Database["public"]['Enums']["trade_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trades_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_offer":
{ Args: { "p_offer_id": string }; Returns: string
                           },
"approve_trade":
{ Args: { "p_trade_id": string }; Returns: undefined
                           },
"cancel_job":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"decline_offer":
{ Args: { "p_note"?: string,"p_offer_id": string,"p_reason": Database["public"]['Enums']["decline_reason"] }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"get_match_contact":
{ Args: { "p_match_id": string }; Returns: {
              "address_line": string,"customer_name": string,"customer_phone": string,"job_id": string,"postcode": string,"trade_business_name": string,"trade_phone": string
            }[]
                           },
"job_customer_rating":
{ Args: { "p_job_id": string }; Returns: {
              "average_stars": number,"is_new_customer": boolean,"rating_count": number
            }[]
                           },
"leave_review":
{ Args: { "p_comment"?: string,"p_match_id": string,"p_quality": number,"p_reliability": number,"p_tidiness": number,"p_value": number }; Returns: string
                           },
"mark_company_checked":
{ Args: { "p_trade_id": string }; Returns: undefined
                           },
"mark_contacted":
{ Args: { "p_match_id": string }; Returns: undefined
                           },
"mark_done":
{ Args: { "p_match_id": string }; Returns: undefined
                           },
"my_application_problems":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"normalise_key":
{ Args: { "value": string }; Returns: string
                           },
"pause_offers":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"post_job":
{ Args: { "p_address_line"?: string,"p_budget"?: Database["public"]['Enums']["job_budget"],"p_category_id": number,"p_description"?: string,"p_is_callout"?: boolean,"p_postcode": string,"p_size"?: Database["public"]['Enums']["job_size"],"p_timing"?: Database["public"]['Enums']["job_timing"],"p_title": string }; Returns: string
                           },
"postcode_district":
{ Args: { "p_postcode": string }; Returns: string
                           },
"rate_customer":
{ Args: { "p_comment"?: string,"p_match_id": string,"p_stars": number,"p_tags"?: (string)[] }; Returns: string
                           },
"reject_trade":
{ Args: { "p_reason": string,"p_trade_id": string }; Returns: undefined
                           },
"request_another_trade":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"resume_offers":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"set_queue_cap":
{ Args: { "p_cap": number,"p_queue_id": string }; Returns: undefined
                           },
"set_trade_suspended":
{ Args: { "p_reason"?: string,"p_suspended": boolean,"p_trade_id": string }; Returns: undefined
                           },
"sign_off":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"submit_application":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"sync_my_queues":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"tune_back_in":
{ Args: { "p_queue_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "admin_alert_kind": "job_unmatched"|"no_contact"|"low_customer_rating"|"trade_paused"|"insurance_expiring"|"application_submitted","business_type": "sole_trader"|"partnership"|"limited_company","decline_reason": "too_busy"|"too_far"|"not_my_kind_of_work"|"too_small"|"too_big"|"other","document_type": "public_liability_insurance"|"other","id_check_result": "pending"|"passed"|"failed"|"refer","job_budget": "under_250"|"250_to_1000"|"1000_to_5000"|"5000_to_15000"|"over_15000"|"not_sure","job_size": "small"|"large","job_status": "offering"|"matched"|"done"|"completed"|"cancelled","job_timing": "asap"|"within_a_week"|"within_a_month"|"flexible","match_end_reason": "customer_requested_another"|"cancelled"|"admin","notification_channel": "push"|"sms"|"email"|"whatsapp","offer_status": "pending"|"accepted"|"declined"|"expired"|"withdrawn","pause_reason": "self"|"missed_offers"|"admin","queue_member_status": "active"|"waiting","registration_scheme": "gas_safe"|"niceic"|"napit"|"fensa"|"certass"|"oftec"|"other","report_status": "open"|"resolved"|"dismissed","review_status": "pending"|"approved"|"rejected","subscription_plan": "monthly"|"yearly","subscription_status": "incomplete"|"trialing"|"active"|"past_due"|"canceled"|"unpaid","trade_status": "applied"|"approved"|"rejected"|"suspended","user_role": "customer"|"trade"|"admin"
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
            "admin_alert_kind": ["job_unmatched", "no_contact", "low_customer_rating", "trade_paused", "insurance_expiring", "application_submitted"],"business_type": ["sole_trader", "partnership", "limited_company"],"decline_reason": ["too_busy", "too_far", "not_my_kind_of_work", "too_small", "too_big", "other"],"document_type": ["public_liability_insurance", "other"],"id_check_result": ["pending", "passed", "failed", "refer"],"job_budget": ["under_250", "250_to_1000", "1000_to_5000", "5000_to_15000", "over_15000", "not_sure"],"job_size": ["small", "large"],"job_status": ["offering", "matched", "done", "completed", "cancelled"],"job_timing": ["asap", "within_a_week", "within_a_month", "flexible"],"match_end_reason": ["customer_requested_another", "cancelled", "admin"],"notification_channel": ["push", "sms", "email", "whatsapp"],"offer_status": ["pending", "accepted", "declined", "expired", "withdrawn"],"pause_reason": ["self", "missed_offers", "admin"],"queue_member_status": ["active", "waiting"],"registration_scheme": ["gas_safe", "niceic", "napit", "fensa", "certass", "oftec", "other"],"report_status": ["open", "resolved", "dismissed"],"review_status": ["pending", "approved", "rejected"],"subscription_plan": ["monthly", "yearly"],"subscription_status": ["incomplete", "trialing", "active", "past_due", "canceled", "unpaid"],"trade_status": ["applied", "approved", "rejected", "suspended"],"user_role": ["customer", "trade", "admin"]
          }
        }
} as const

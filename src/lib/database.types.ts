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
      academic_authors: {
        Row: {
          cited_by_count: number
          created_at: string
          display_name: string
          institution_name: string | null
          institution_openalex_id: string | null
          last_synced_at: string
          metadata: Json
          openalex_id: string
          orcid: string | null
          topics: Json
          works_count: number
        }
        Insert: {
          cited_by_count?: number
          created_at?: string
          display_name: string
          institution_name?: string | null
          institution_openalex_id?: string | null
          last_synced_at?: string
          metadata?: Json
          openalex_id: string
          orcid?: string | null
          topics?: Json
          works_count?: number
        }
        Update: {
          cited_by_count?: number
          created_at?: string
          display_name?: string
          institution_name?: string | null
          institution_openalex_id?: string | null
          last_synced_at?: string
          metadata?: Json
          openalex_id?: string
          orcid?: string | null
          topics?: Json
          works_count?: number
        }
        Relationships: []
      }
      academic_institutions: {
        Row: {
          cited_by_count: number
          city: string | null
          country_code: string | null
          created_at: string
          homepage_url: string | null
          institution_type: string | null
          last_synced_at: string
          metadata: Json
          name: string
          openalex_id: string
          works_count: number
        }
        Insert: {
          cited_by_count?: number
          city?: string | null
          country_code?: string | null
          created_at?: string
          homepage_url?: string | null
          institution_type?: string | null
          last_synced_at?: string
          metadata?: Json
          name: string
          openalex_id: string
          works_count?: number
        }
        Update: {
          cited_by_count?: number
          city?: string | null
          country_code?: string | null
          created_at?: string
          homepage_url?: string | null
          institution_type?: string | null
          last_synced_at?: string
          metadata?: Json
          name?: string
          openalex_id?: string
          works_count?: number
        }
        Relationships: []
      }
      academic_journals: {
        Row: {
          cited_by_count: number
          country_code: string | null
          created_at: string
          homepage_url: string | null
          issn: Json
          issn_l: string | null
          last_synced_at: string
          metadata: Json
          name: string
          openalex_id: string
          publisher: string | null
          works_count: number
        }
        Insert: {
          cited_by_count?: number
          country_code?: string | null
          created_at?: string
          homepage_url?: string | null
          issn?: Json
          issn_l?: string | null
          last_synced_at?: string
          metadata?: Json
          name: string
          openalex_id: string
          publisher?: string | null
          works_count?: number
        }
        Update: {
          cited_by_count?: number
          country_code?: string | null
          created_at?: string
          homepage_url?: string | null
          issn?: Json
          issn_l?: string | null
          last_synced_at?: string
          metadata?: Json
          name?: string
          openalex_id?: string
          publisher?: string | null
          works_count?: number
        }
        Relationships: []
      }
      academic_reading_status: {
        Row: {
          author_summary: string | null
          created_at: string
          journal_name: string | null
          publication_year: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
          work_openalex_id: string
        }
        Insert: {
          author_summary?: string | null
          created_at?: string
          journal_name?: string | null
          publication_year?: number | null
          status: string
          title: string
          updated_at?: string
          user_id: string
          work_openalex_id: string
        }
        Update: {
          author_summary?: string | null
          created_at?: string
          journal_name?: string | null
          publication_year?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          work_openalex_id?: string
        }
        Relationships: []
      }
      academic_work_authors: {
        Row: {
          author_openalex_id: string
          author_position: string | null
          is_corresponding: boolean
          work_openalex_id: string
        }
        Insert: {
          author_openalex_id: string
          author_position?: string | null
          is_corresponding?: boolean
          work_openalex_id: string
        }
        Update: {
          author_openalex_id?: string
          author_position?: string | null
          is_corresponding?: boolean
          work_openalex_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_work_authors_author_openalex_id_fkey"
            columns: ["author_openalex_id"]
            isOneToOne: false
            referencedRelation: "academic_authors"
            referencedColumns: ["openalex_id"]
          },
          {
            foreignKeyName: "academic_work_authors_work_openalex_id_fkey"
            columns: ["work_openalex_id"]
            isOneToOne: false
            referencedRelation: "academic_works"
            referencedColumns: ["openalex_id"]
          },
        ]
      }
      academic_work_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          work_openalex_id: string
          work_title: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          work_openalex_id: string
          work_title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          work_openalex_id?: string
          work_title?: string
        }
        Relationships: []
      }
      academic_works: {
        Row: {
          abstract: string | null
          cited_by_count: number
          created_at: string
          doi: string | null
          external_url: string | null
          journal_name: string | null
          journal_openalex_id: string | null
          language: string | null
          last_synced_at: string
          metadata: Json
          open_access_url: string | null
          openalex_id: string
          pdf_url: string | null
          primary_topic: string | null
          publication_date: string | null
          publication_year: number | null
          title: string
          work_type: string | null
        }
        Insert: {
          abstract?: string | null
          cited_by_count?: number
          created_at?: string
          doi?: string | null
          external_url?: string | null
          journal_name?: string | null
          journal_openalex_id?: string | null
          language?: string | null
          last_synced_at?: string
          metadata?: Json
          open_access_url?: string | null
          openalex_id: string
          pdf_url?: string | null
          primary_topic?: string | null
          publication_date?: string | null
          publication_year?: number | null
          title: string
          work_type?: string | null
        }
        Update: {
          abstract?: string | null
          cited_by_count?: number
          created_at?: string
          doi?: string | null
          external_url?: string | null
          journal_name?: string | null
          journal_openalex_id?: string | null
          language?: string | null
          last_synced_at?: string
          metadata?: Json
          open_access_url?: string | null
          openalex_id?: string
          pdf_url?: string | null
          primary_topic?: string | null
          publication_date?: string | null
          publication_year?: number | null
          title?: string
          work_type?: string | null
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_config_snapshots: {
        Row: {
          created_at: string
          created_by: string
          id: string
          label: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          label?: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          snapshot?: Json
        }
        Relationships: []
      }
      admin_notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          action_route: string | null
          active: boolean
          created_at: string
          created_by: string
          id: string
          message: string
          target_type: string
          target_value: string | null
          title: string
        }
        Insert: {
          action_route?: string | null
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          message: string
          target_type?: string
          target_value?: string | null
          title: string
        }
        Update: {
          action_route?: string | null
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          target_type?: string
          target_value?: string | null
          title?: string
        }
        Relationships: []
      }
      admin_trash_items: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          id: string
          reason: string | null
          restored_at: string | null
          restored_by: string | null
          snapshot: Json
          target_id: string
          target_type: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          reason?: string | null
          restored_at?: string | null
          restored_by?: string | null
          snapshot: Json
          target_id: string
          target_type: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          reason?: string | null
          restored_at?: string | null
          restored_by?: string | null
          snapshot?: Json
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          action_route: string | null
          active: boolean
          body: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          kind: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          action_route?: string | null
          active?: boolean
          body: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          kind?: string
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_route?: string | null
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          kind?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string
          key: string
          public_read: boolean
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string
          key: string
          public_read?: boolean
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string
          key?: string
          public_read?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      author_profiles: {
        Row: {
          featured: boolean
          pen_name: string | null
          priority: number
          updated_at: string
          updated_by: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          featured?: boolean
          pen_name?: string | null
          priority?: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          featured?: boolean
          pen_name?: string | null
          priority?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      book_notes: {
        Row: {
          book_key: string
          book_title: string
          content: string
          created_at: string
          id: string
          page_number: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_key: string
          book_title: string
          content: string
          created_at?: string
          id?: string
          page_number?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_key?: string
          book_title?: string
          content?: string
          created_at?: string
          id?: string
          page_number?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error_events: {
        Row: {
          app_version: string
          component_stack: string
          created_at: string
          error_kind: string
          id: string
          message: string
          platform: string
          stack: string
          user_id: string | null
        }
        Insert: {
          app_version?: string
          component_stack?: string
          created_at?: string
          error_kind?: string
          id?: string
          message?: string
          platform?: string
          stack?: string
          user_id?: string | null
        }
        Update: {
          app_version?: string
          component_stack?: string
          created_at?: string
          error_kind?: string
          id?: string
          message?: string
          platform?: string
          stack?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          created_at: string
          id: string
          review_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          created_at: string
          created_by: string | null
          current_book: string | null
          description: string | null
          id: string
          image_url: string | null
          kind: string
          name: string
          rules: string
          tags: string[]
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_book?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          name: string
          rules?: string
          tags?: string[]
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_book?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          name?: string
          rules?: string
          tags?: string[]
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_admin_controls: {
        Row: {
          community_id: string
          featured: boolean
          priority: number
          restricted: boolean
          updated_at: string
          updated_by: string | null
          verified: boolean
        }
        Insert: {
          community_id: string
          featured?: boolean
          priority?: number
          restricted?: boolean
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
        }
        Update: {
          community_id?: string
          featured?: boolean
          priority?: number
          restricted?: boolean
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "community_admin_controls_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: true
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_invites: {
        Row: {
          community_id: string
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_invites_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          created_at: string
          id: string
          post_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          community_id: string
          created_at: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_views: {
        Row: {
          content_id: string
          content_type: string
          id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          id?: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: []
      }
      conversation_hidden: {
        Row: {
          conversation_id: string
          hidden_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_hidden_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_pair_key: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_pair_key?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_pair_key?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      event_admin_controls: {
        Row: {
          cancelled: boolean
          event_id: string
          featured: boolean
          hidden: boolean
          note: string | null
          priority: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancelled?: boolean
          event_id: string
          featured?: boolean
          hidden?: boolean
          note?: string | null
          priority?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancelled?: boolean
          event_id?: string
          featured?: boolean
          hidden?: boolean
          note?: string | null
          priority?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_admin_controls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          image_url: string | null
          location: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          id?: string
          image_url?: string | null
          location?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          image_url?: string | null
          location?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      explore_featured_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          priority: number
          starts_at: string
          subtitle: string | null
          target_id: string
          target_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          priority?: number
          starts_at?: string
          subtitle?: string | null
          target_id: string
          target_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          priority?: number
          starts_at?: string
          subtitle?: string | null
          target_id?: string
          target_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          allowed_roles: string[]
          allowed_user_ids: string[]
          description: string
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_roles?: string[]
          allowed_user_ids?: string[]
          description?: string
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_roles?: string[]
          allowed_user_ids?: string[]
          description?: string
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          requester_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          requester_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          requester_id?: string
          target_id?: string
        }
        Relationships: []
      }
      followed_academic_entities: {
        Row: {
          created_at: string
          display_name: string
          entity_openalex_id: string
          entity_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          entity_openalex_id: string
          entity_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          entity_openalex_id?: string
          entity_type?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtag_controls: {
        Row: {
          blocked: boolean
          featured: boolean
          priority: number
          tag: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blocked?: boolean
          featured?: boolean
          priority?: number
          tag: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blocked?: boolean
          featured?: boolean
          priority?: number
          tag?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          comments_enabled: boolean
          created_at: string
          follows_enabled: boolean
          likes_enabled: boolean
          messages_enabled: boolean
          reposts_enabled: boolean
          system_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_enabled?: boolean
          created_at?: string
          follows_enabled?: boolean
          likes_enabled?: boolean
          messages_enabled?: boolean
          reposts_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_enabled?: boolean
          created_at?: string
          follows_enabled?: boolean
          likes_enabled?: boolean
          messages_enabled?: boolean
          reposts_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          message: string
          post_id: string | null
          read: boolean
          review_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          message: string
          post_id?: string | null
          read?: boolean
          review_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          message?: string
          post_id?: string | null
          read?: boolean
          review_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          created_at: string
          id: string
          post_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reposts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          book_key: string | null
          book_title: string | null
          created_at: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          rating: number | null
          text: string | null
          user_id: string | null
          username: string
          view_count: number
        }
        Insert: {
          book_key?: string | null
          book_title?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          rating?: number | null
          text?: string | null
          user_id?: string | null
          username: string
          view_count?: number
        }
        Update: {
          book_key?: string | null
          book_title?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          rating?: number | null
          text?: string | null
          user_id?: string | null
          username?: string
          view_count?: number
        }
        Relationships: []
      }
      premium_analytics_events: {
        Row: {
          created_at: string
          entitlement_id: string | null
          event_type: string
          expires_at: string | null
          id: number
          previous_status: string | null
          product_id: string | null
          provider_event_type: string | null
          source: string
          status: string
          user_id: string
          will_renew: boolean | null
        }
        Insert: {
          created_at?: string
          entitlement_id?: string | null
          event_type: string
          expires_at?: string | null
          id?: number
          previous_status?: string | null
          product_id?: string | null
          provider_event_type?: string | null
          source: string
          status: string
          user_id: string
          will_renew?: boolean | null
        }
        Update: {
          created_at?: string
          entitlement_id?: string | null
          event_type?: string
          expires_at?: string | null
          id?: number
          previous_status?: string | null
          product_id?: string | null
          provider_event_type?: string | null
          source?: string
          status?: string
          user_id?: string
          will_renew?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_analytics_events_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "premium_entitlements"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_entitlements: {
        Row: {
          created_at: string
          entitlement_id: string
          expires_at: string | null
          id: string
          product_id: string | null
          provider_environment: string | null
          provider_event_at: string | null
          provider_event_id: string | null
          provider_event_type: string | null
          revoked_at: string | null
          source: string
          source_reference: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
          will_renew: boolean | null
        }
        Insert: {
          created_at?: string
          entitlement_id?: string
          expires_at?: string | null
          id?: string
          product_id?: string | null
          provider_environment?: string | null
          provider_event_at?: string | null
          provider_event_id?: string | null
          provider_event_type?: string | null
          revoked_at?: string | null
          source: string
          source_reference?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
          will_renew?: boolean | null
        }
        Update: {
          created_at?: string
          entitlement_id?: string
          expires_at?: string | null
          id?: string
          product_id?: string | null
          provider_environment?: string | null
          provider_event_at?: string | null
          provider_event_id?: string | null
          provider_event_type?: string | null
          revoked_at?: string | null
          source?: string
          source_reference?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          will_renew?: boolean | null
        }
        Relationships: []
      }
      premium_profile_customizations: {
        Row: {
          created_at: string
          highlight_text: string
          layout_key: string
          show_premium_frame: boolean
          theme_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          highlight_text?: string
          layout_key?: string
          show_premium_frame?: boolean
          theme_key?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          highlight_text?: string
          layout_key?: string
          show_premium_frame?: boolean
          theme_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      premium_reading_goals: {
        Row: {
          created_at: string
          monthly_page_goal: number
          streak_goal_days: number
          updated_at: string
          user_id: string
          weekly_page_goal: number
          yearly_book_goal: number
        }
        Insert: {
          created_at?: string
          monthly_page_goal?: number
          streak_goal_days?: number
          updated_at?: string
          user_id: string
          weekly_page_goal?: number
          yearly_book_goal?: number
        }
        Update: {
          created_at?: string
          monthly_page_goal?: number
          streak_goal_days?: number
          updated_at?: string
          user_id?: string
          weekly_page_goal?: number
          yearly_book_goal?: number
        }
        Relationships: []
      }
      premium_reading_plans: {
        Row: {
          book_key: string
          book_title: string
          created_at: string
          current_page: number
          daily_pages: number
          target_date: string
          total_pages: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_key: string
          book_title: string
          created_at?: string
          current_page?: number
          daily_pages: number
          target_date: string
          total_pages: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_key?: string
          book_title?: string
          created_at?: string
          current_page?: number
          daily_pages?: number
          target_date?: string
          total_pages?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_reading_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_shelf_customizations: {
        Row: {
          accent_key: string
          created_at: string
          layout_key: string
          read_label: string
          reading_label: string
          show_counts: boolean
          updated_at: string
          user_id: string
          want_label: string
        }
        Insert: {
          accent_key?: string
          created_at?: string
          layout_key?: string
          read_label?: string
          reading_label?: string
          show_counts?: boolean
          updated_at?: string
          user_id: string
          want_label?: string
        }
        Update: {
          accent_key?: string
          created_at?: string
          layout_key?: string
          read_label?: string
          reading_label?: string
          show_counts?: boolean
          updated_at?: string
          user_id?: string
          want_label?: string
        }
        Relationships: []
      }
      product_analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: number
          metadata: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: number
          metadata?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: number
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      profile_admin_controls: {
        Row: {
          content_filter_level: string
          follow_restricted: boolean
          note: string
          updated_at: string
          updated_by: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          content_filter_level?: string
          follow_restricted?: boolean
          note?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          content_filter_level?: string
          follow_restricted?: boolean
          note?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      profile_privacy_settings: {
        Row: {
          created_at: string
          discoverable: boolean
          is_private: boolean
          message_permission: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discoverable?: boolean
          is_private?: boolean
          message_permission?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discoverable?: boolean
          is_private?: boolean
          message_permission?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          cover_image: string | null
          created_at: string
          full_name: string | null
          id: string
          profile_image: string | null
          updated_at: string
          username: string
        }
        Insert: {
          bio?: string | null
          cover_image?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          profile_image?: string | null
          updated_at?: string
          username?: string
        }
        Update: {
          bio?: string | null
          cover_image?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          profile_image?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      quote_comments: {
        Row: {
          created_at: string
          id: string
          quote_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quote_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quote_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_comments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_likes: {
        Row: {
          created_at: string
          quote_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          quote_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          quote_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_likes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_reposts: {
        Row: {
          created_at: string
          quote_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          quote_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          quote_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_reposts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          book_key: string
          book_title: string
          card_template_key: string
          created_at: string
          id: string
          note: string | null
          page_number: number | null
          text: string
          title: string | null
          topic: string | null
          user_id: string
          view_count: number
        }
        Insert: {
          book_key: string
          book_title: string
          card_template_key?: string
          created_at?: string
          id?: string
          note?: string | null
          page_number?: number | null
          text: string
          title?: string | null
          topic?: string | null
          user_id: string
          view_count?: number
        }
        Update: {
          book_key?: string
          book_title?: string
          card_template_key?: string
          created_at?: string
          id?: string
          note?: string | null
          page_number?: number | null
          text?: string
          title?: string | null
          topic?: string | null
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      reader_suggestion_feedback: {
        Row: {
          candidate_id: string
          created_at: string
          hidden_until: string
          reason: string
          user_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          hidden_until?: string
          reason?: string
          user_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          hidden_until?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_daily_stats: {
        Row: {
          created_at: string
          id: string
          pages_read: number
          reading_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pages_read?: number
          reading_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pages_read?: number
          reading_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_preferences: {
        Row: {
          created_at: string
          daily_page_goal: number
          id: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_page_goal?: number
          id?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_page_goal?: number
          id?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_progress: {
        Row: {
          book_key: string
          book_title: string | null
          created_at: string
          current_page: number
          furthest_page: number
          id: string
          total_pages: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_key: string
          book_title?: string | null
          created_at?: string
          current_page?: number
          furthest_page?: number
          id?: string
          total_pages?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_key?: string
          book_title?: string | null
          created_at?: string
          current_page?: number
          furthest_page?: number
          id?: string
          total_pages?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          legacy_user_report_id: string | null
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          source: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          legacy_user_report_id?: string | null
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          legacy_user_report_id?: string | null
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      reposts: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      revenuecat_webhook_events: {
        Row: {
          app_user_id: string | null
          cancel_reason: string | null
          environment: string | null
          event_id: string
          event_type: string
          expiration_reason: string | null
          processed: boolean
          processed_at: string | null
          product_id: string | null
          provider_event_at: string
          received_at: string
          source: string | null
          source_reference: string | null
          transferred_from: string[] | null
          transferred_to: string[] | null
        }
        Insert: {
          app_user_id?: string | null
          cancel_reason?: string | null
          environment?: string | null
          event_id: string
          event_type: string
          expiration_reason?: string | null
          processed?: boolean
          processed_at?: string | null
          product_id?: string | null
          provider_event_at: string
          received_at?: string
          source?: string | null
          source_reference?: string | null
          transferred_from?: string[] | null
          transferred_to?: string[] | null
        }
        Update: {
          app_user_id?: string | null
          cancel_reason?: string | null
          environment?: string | null
          event_id?: string
          event_type?: string
          expiration_reason?: string | null
          processed?: boolean
          processed_at?: string | null
          product_id?: string | null
          provider_event_at?: string
          received_at?: string
          source?: string | null
          source_reference?: string | null
          transferred_from?: string[] | null
          transferred_to?: string[] | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          book_key: string
          book_title: string
          contains_spoiler: boolean
          created_at: string
          id: string
          rating: number
          tags: string[]
          text: string
          title: string | null
          topic: string | null
          user_id: string
          view_count: number
        }
        Insert: {
          book_key: string
          book_title: string
          contains_spoiler?: boolean
          created_at?: string
          id?: string
          rating: number
          tags?: string[]
          text: string
          title?: string | null
          topic?: string | null
          user_id: string
          view_count?: number
        }
        Update: {
          book_key?: string
          book_title?: string
          contains_spoiler?: boolean
          created_at?: string
          id?: string
          rating?: number
          tags?: string[]
          text?: string
          title?: string | null
          topic?: string | null
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      saved_academic_works: {
        Row: {
          author_summary: string | null
          created_at: string
          doi: string | null
          journal_name: string | null
          publication_year: number | null
          title: string
          user_id: string
          work_openalex_id: string
        }
        Insert: {
          author_summary?: string | null
          created_at?: string
          doi?: string | null
          journal_name?: string | null
          publication_year?: number | null
          title: string
          user_id: string
          work_openalex_id: string
        }
        Update: {
          author_summary?: string | null
          created_at?: string
          doi?: string | null
          journal_name?: string | null
          publication_year?: number | null
          title?: string
          user_id?: string
          work_openalex_id?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_works: {
        Row: {
          created_at: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_works_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      search_events: {
        Row: {
          created_at: string
          id: string
          query: string
          result_count: number
          scope: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          result_count?: number
          scope?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          result_count?: number
          scope?: string
          user_id?: string | null
        }
        Relationships: []
      }
      social_notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      storage_cleanup_candidates: {
        Row: {
          attempt_count: number
          auto_cleanup: boolean
          bucket_id: string
          created_at: string
          created_by: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          object_name: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          auto_cleanup?: boolean
          bucket_id: string
          created_at?: string
          created_by: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          object_name: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          auto_cleanup?: boolean
          bucket_id?: string
          created_at?: string
          created_by?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          object_name?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          allow_likes: boolean
          allow_replies: boolean
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          storage_path: string | null
          text: string | null
          user_id: string
          username: string
        }
        Insert: {
          allow_likes?: boolean
          allow_replies?: boolean
          created_at?: string
          expires_at: string
          id?: string
          image_url?: string | null
          storage_path?: string | null
          text?: string | null
          user_id: string
          username: string
        }
        Update: {
          allow_likes?: boolean
          allow_replies?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          storage_path?: string | null
          text?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      story_likes: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_book_status: {
        Row: {
          book_key: string
          book_title: string | null
          created_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_key: string
          book_title?: string | null
          created_at?: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_key?: string
          book_title?: string | null
          created_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          reported_id: string
          reporter_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          id?: string
          reported_id: string
          reporter_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          reported_id?: string
          reporter_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_sanctions: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          sanction_type: string
          starts_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          sanction_type: string
          starts_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          sanction_type?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verified_accounts: {
        Row: {
          created_at: string
          is_verified: boolean
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          is_verified?: boolean
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          is_verified?: boolean
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      work_chapters: {
        Row: {
          content: string
          created_at: string
          id: string
          position: number
          published_at: string | null
          status: string
          title: string
          updated_at: string
          work_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          published_at?: string | null
          status?: string
          title: string
          updated_at?: string
          work_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_chapters_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          audience: string
          author_id: string
          completed: boolean
          cover_url: string | null
          created_at: string
          description: string
          genre: string
          id: string
          language: string
          published_at: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          author_id: string
          completed?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string
          genre?: string
          id?: string
          language?: string
          published_at?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          author_id?: string
          completed?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string
          genre?: string
          id?: string
          language?: string
          published_at?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_sanction: {
        Args: {
          p_ends_at?: string
          p_reason?: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      admin_analytics_daily: {
        Args: { p_days?: number }
        Returns: {
          comments: number
          day: string
          new_users: number
          posts: number
          quotes: number
          reviews: number
        }[]
      }
      admin_analytics_overview: {
        Args: never
        Returns: {
          comments_7d: number
          pending_reports: number
          posts_7d: number
          quotes_7d: number
          reviews_7d: number
          total_comments: number
          total_communities: number
          total_events: number
          total_posts: number
          total_quotes: number
          total_reviews: number
          total_users: number
          users_30d: number
          users_7d: number
        }[]
      }
      admin_audit_filter_options: {
        Args: never
        Returns: {
          actions: string[]
          target_types: string[]
        }[]
      }
      admin_client_error_summary: {
        Args: { p_hours?: number }
        Returns: {
          affected_users: number
          alert_level: string
          boundary_events: number
          fatal_events: number
          latest_event_at: string
          total_events: number
        }[]
      }
      admin_create_config_snapshot: {
        Args: { p_label?: string }
        Returns: string
      }
      admin_delete_announcement: { Args: { p_id: string }; Returns: undefined }
      admin_delete_content: {
        Args: { p_reason?: string; p_target_id: string; p_target_type: string }
        Returns: Json
      }
      admin_delete_explore_item: { Args: { p_id: string }; Returns: undefined }
      admin_delete_feature_flag: { Args: { p_key: string }; Returns: undefined }
      admin_grant_premium: {
        Args: { p_duration?: string; p_reason?: string; p_user_id: string }
        Returns: {
          created_at: string
          entitlement_id: string
          expires_at: string | null
          id: string
          product_id: string | null
          provider_environment: string | null
          provider_event_at: string | null
          provider_event_id: string | null
          provider_event_type: string | null
          revoked_at: string | null
          source: string
          source_reference: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
          will_renew: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "premium_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_grant_verification: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: {
          created_at: string
          is_verified: boolean
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "verified_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_admin_accounts: {
        Args: never
        Returns: {
          full_name: string
          profile_image: string
          role: string
          updated_at: string
          updated_by: string
          user_id: string
          username: string
        }[]
      }
      admin_list_announcements: {
        Args: { p_limit?: number }
        Returns: {
          action_route: string
          active: boolean
          body: string
          created_at: string
          created_by: string
          ends_at: string
          id: string
          kind: string
          starts_at: string
          title: string
          updated_at: string
        }[]
      }
      admin_list_audit_logs: {
        Args: {
          p_action?: string
          p_admin_id?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_target_type?: string
        }
        Returns: {
          action: string
          admin_full_name: string
          admin_id: string
          admin_username: string
          created_at: string
          id: string
          metadata: Json
          new_value: Json
          old_value: Json
          reason: string
          target_id: string
          target_type: string
        }[]
      }
      admin_list_authors: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          draft_work_count: number
          featured: boolean
          full_name: string
          last_work_updated_at: string
          pen_name: string
          priority: number
          profile_image: string
          published_work_count: number
          user_id: string
          username: string
          verified: boolean
          work_count: number
        }[]
      }
      admin_list_client_errors: {
        Args: { p_limit?: number }
        Returns: {
          app_version: string
          component_stack: string
          created_at: string
          error_kind: string
          id: string
          message: string
          platform: string
          stack: string
          user_id: string
        }[]
      }
      admin_list_communities: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          admin_count: number
          created_at: string
          created_by: string
          description: string
          featured: boolean
          id: string
          image_url: string
          kind: string
          member_count: number
          name: string
          owner_username: string
          priority: number
          restricted: boolean
          verified: boolean
          visibility: string
        }[]
      }
      admin_list_community_members: {
        Args: { p_community_id: string }
        Returns: {
          full_name: string
          joined_at: string
          role: string
          user_id: string
          username: string
        }[]
      }
      admin_list_event_attendees: {
        Args: { p_event_id: string }
        Returns: {
          full_name: string
          profile_image: string
          user_id: string
          username: string
        }[]
      }
      admin_list_events: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          attendee_count: number
          cancelled: boolean
          created_by: string
          description: string
          event_date: string
          featured: boolean
          hidden: boolean
          id: string
          image_url: string
          location: string
          note: string
          owner_username: string
          priority: number
          title: string
        }[]
      }
      admin_list_feature_flags: {
        Args: never
        Returns: {
          allowed_roles: string[]
          allowed_user_ids: string[]
          description: string
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string
        }[]
      }
      admin_list_hashtags: {
        Args: never
        Returns: {
          blocked: boolean
          featured: boolean
          post_count: number
          priority: number
          review_count: number
          tag: string
          updated_at: string
          usage_count: number
        }[]
      }
      admin_list_profile_controls: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          content_filter_level: string
          follow_restricted: boolean
          full_name: string
          note: string
          user_id: string
          username: string
          verified: boolean
        }[]
      }
      admin_list_sanctions: {
        Args: { p_active_only?: boolean; p_limit?: number; p_search?: string }
        Returns: {
          active: boolean
          created_at: string
          created_by: string
          ends_at: string
          id: string
          reason: string
          sanction_type: string
          starts_at: string
          user_id: string
          username: string
        }[]
      }
      admin_list_storage_objects: {
        Args: { p_bucket?: string; p_limit?: number; p_search?: string }
        Returns: {
          bucket_id: string
          cleanup_status: string
          created_at: string
          id: string
          last_accessed_at: string
          mimetype: string
          object_name: string
          owner_id: string
          referenced: boolean
          size_bytes: number
          updated_at: string
        }[]
      }
      admin_list_system_settings: {
        Args: never
        Returns: {
          description: string
          key: string
          public_read: boolean
          updated_at: string
          updated_by: string
          value: Json
        }[]
      }
      admin_list_trash: {
        Args: { p_limit?: number; p_offset?: number; p_target_type?: string }
        Returns: {
          deleted_at: string
          deleted_by: string
          deleted_username: string
          id: string
          reason: string
          snapshot: Json
          target_id: string
          target_type: string
        }[]
      }
      admin_list_verified_accounts: {
        Args: never
        Returns: {
          created_at: string
          is_verified: boolean
          reason: string
          revoked_at: string
          revoked_by: string
          updated_at: string
          user_id: string
          verified_at: string
          verified_by: string
        }[]
      }
      admin_list_works: {
        Args: { p_limit?: number; p_search?: string; p_status?: string }
        Returns: {
          audience: string
          author_id: string
          author_username: string
          chapter_count: number
          completed: boolean
          cover_url: string
          created_at: string
          description: string
          genre: string
          id: string
          language: string
          published_at: string
          published_chapter_count: number
          status: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      admin_mark_storage_cleanup: {
        Args: { p_bucket: string; p_object_name: string; p_reason?: string }
        Returns: string
      }
      admin_premium_analytics_daily: {
        Args: { p_days?: number }
        Returns: {
          day: string
          entitlement_created: number
          expiration_changed: number
          renewal_state_changed: number
          source_state_changed: number
          status_changed: number
        }[]
      }
      admin_premium_analytics_overview: {
        Args: never
        Returns: {
          active_admin_grant_users: number
          active_paid_users: number
          active_premium_users: number
          apple_active_users: number
          expiring_7d_users: number
          google_active_users: number
          grace_period_users: number
          non_renewing_paid_users: number
          premium_events_30d: number
          premium_events_7d: number
          trialing_users: number
        }[]
      }
      admin_remove_event_attendee: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_reported_message_context: {
        Args: { p_report_id: string }
        Returns: Json
      }
      admin_restore_trash: { Args: { p_trash_id: string }; Returns: Json }
      admin_review_storage_cleanup: {
        Args: { p_bucket: string; p_object_name: string; p_status: string }
        Returns: undefined
      }
      admin_revoke_premium: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: {
          created_at: string
          entitlement_id: string
          expires_at: string | null
          id: string
          product_id: string | null
          provider_environment: string | null
          provider_event_at: string | null
          provider_event_id: string | null
          provider_event_type: string | null
          revoked_at: string | null
          source: string
          source_reference: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
          will_renew: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "premium_entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_revoke_sanction: {
        Args: { p_reason?: string; p_sanction_id: string }
        Returns: undefined
      }
      admin_revoke_verification: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: {
          created_at: string
          is_verified: boolean
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "verified_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_save_announcement: {
        Args: {
          p_action_route?: string
          p_active?: boolean
          p_body?: string
          p_ends_at?: string
          p_id?: string
          p_kind?: string
          p_starts_at?: string
          p_title?: string
        }
        Returns: string
      }
      admin_save_feature_flag: {
        Args: {
          p_allowed_roles?: string[]
          p_allowed_user_ids?: string[]
          p_description?: string
          p_enabled?: boolean
          p_key: string
        }
        Returns: undefined
      }
      admin_search_analytics: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          avg_results: number
          last_searched_at: string
          query: string
          search_count: number
          unique_users: number
        }[]
      }
      admin_search_role_candidates: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          full_name: string
          profile_image: string
          role: string
          user_id: string
          username: string
        }[]
      }
      admin_security_health: { Args: never; Returns: Json }
      admin_send_notification: {
        Args: {
          p_action_route?: string
          p_message: string
          p_target_type?: string
          p_target_value?: string
          p_title: string
        }
        Returns: string
      }
      admin_set_author_profile: {
        Args: {
          p_featured?: boolean
          p_pen_name?: string
          p_priority?: number
          p_user_id: string
          p_verified?: boolean
        }
        Returns: undefined
      }
      admin_set_community_control: {
        Args: {
          p_community_id: string
          p_featured?: boolean
          p_priority?: number
          p_restricted?: boolean
          p_verified?: boolean
        }
        Returns: undefined
      }
      admin_set_community_member_role: {
        Args: { p_community_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_event_control: {
        Args: {
          p_cancelled?: boolean
          p_event_id: string
          p_featured?: boolean
          p_hidden?: boolean
          p_note?: string
          p_priority?: number
        }
        Returns: undefined
      }
      admin_set_hashtag_control: {
        Args: {
          p_blocked?: boolean
          p_featured?: boolean
          p_priority?: number
          p_tag: string
        }
        Returns: undefined
      }
      admin_set_profile_control: {
        Args: {
          p_content_filter_level?: string
          p_follow_restricted: boolean
          p_note?: string
          p_user_id: string
          p_verified: boolean
        }
        Returns: undefined
      }
      admin_set_system_setting: {
        Args: {
          p_description?: string
          p_key: string
          p_public_read?: boolean
          p_value: Json
        }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      admin_storage_bucket_stats: {
        Args: never
        Returns: {
          bucket_id: string
          bucket_name: string
          file_size_limit: number
          is_public: boolean
          object_count: number
          total_bytes: number
        }[]
      }
      admin_update_report_status: {
        Args: { p_report_id: string; p_resolution?: string; p_status: string }
        Returns: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          legacy_user_report_id: string | null
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          source: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_work_state: {
        Args: { p_completed: boolean; p_status: string; p_work_id: string }
        Returns: undefined
      }
      admin_upsert_explore_item: {
        Args: {
          p_active?: boolean
          p_priority?: number
          p_subtitle?: string
          p_target_id: string
          p_target_type: string
          p_title?: string
        }
        Returns: string
      }
      admin_visible_hashtags: {
        Args: never
        Returns: {
          blocked: boolean
          featured: boolean
          priority: number
          tag: string
        }[]
      }
      can_follow_user: { Args: { p_target_user: string }; Returns: boolean }
      can_message_user: {
        Args: { p_sender: string; p_target: string }
        Returns: boolean
      }
      can_view_profile_content: { Args: { p_owner: string }; Returns: boolean }
      can_view_user_content: { Args: { p_owner: string }; Returns: boolean }
      cancel_follow_request: { Args: { p_target: string }; Returns: undefined }
      community_access: { Args: { cid: string }; Returns: boolean }
      community_admin: { Args: { cid: string }; Returns: boolean }
      current_app_role: { Args: never; Returns: string }
      filter_discoverable_reader_candidates: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          is_private: boolean
        }[]
      }
      get_active_readers: {
        Args: never
        Returns: {
          profile_image: string
          user_id: string
          username: string
        }[]
      }
      get_automatic_storage_cleanup_candidates: {
        Args: { p_limit?: number }
        Returns: {
          bucket_id: string
          id: string
          object_name: string
        }[]
      }
      get_discover_communities: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          description: string
          id: string
          image_url: string
          is_member: boolean
          member_count: number
          name: string
        }[]
      }
      get_event_attendees: {
        Args: { p_event_id: string }
        Returns: {
          profile_image: string
          user_id: string
          username: string
        }[]
      }
      get_expired_story_cleanup_candidates: {
        Args: { p_cutoff: string; p_limit?: number }
        Returns: {
          id: string
          media_path: string
          user_id: string
        }[]
      }
      get_follow_relationship: {
        Args: { p_target: string }
        Returns: {
          can_view_content: boolean
          is_following: boolean
          is_private: boolean
          request_pending: boolean
        }[]
      }
      get_hashtag_content: {
        Args: { p_before?: string; p_hashtag: string; p_limit?: number }
        Returns: {
          book_key: string
          book_title: string
          comments_count: number
          content_id: string
          content_type: string
          created_at: string
          image_url: string
          likes_count: number
          profile_image: string
          rating: number
          reposts_count: number
          text: string
          user_id: string
          username: string
        }[]
      }
      get_my_admin_notifications: {
        Args: { p_limit?: number }
        Returns: {
          action_route: string
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
        }[]
      }
      get_my_community_invites: {
        Args: never
        Returns: {
          community_id: string
          community_image_url: string
          community_name: string
          created_at: string
          invite_id: string
          inviter_id: string
          inviter_username: string
        }[]
      }
      get_my_inbox: {
        Args: { p_limit?: number }
        Returns: {
          conversation_id: string
          conversation_updated_at: string
          last_message: string
          last_message_at: string
          other_user_id: string
          unread_count: number
        }[]
      }
      get_my_premium_access: {
        Args: never
        Returns: {
          active_entitlements: Json
          all_entitlements: Json
          has_admin_premium: boolean
          has_paid_premium: boolean
          is_premium: boolean
          next_expiration_at: string
          paid_sources: string[]
        }[]
      }
      get_my_shelf_counts: {
        Args: never
        Returns: {
          abandoned_count: number
          read_count: number
          reading_count: number
          total_count: number
          want_count: number
        }[]
      }
      get_my_storage_objects: {
        Args: never
        Returns: {
          bucket_id: string
          object_name: string
        }[]
      }
      get_orphan_story_storage_paths: {
        Args: { p_limit?: number }
        Returns: {
          storage_path: string
        }[]
      }
      get_popular_books: {
        Args: never
        Returns: {
          book_key: string
          book_title: string
          popularity_score: number
          read_count: number
          reading_count: number
          total_users: number
          want_count: number
        }[]
      }
      get_premium_badge_user_ids: {
        Args: { p_user_ids: string[] }
        Returns: {
          user_id: string
        }[]
      }
      get_premium_goal_dashboard: {
        Args: never
        Returns: {
          current_streak: number
          monthly_page_goal: number
          monthly_pages_read: number
          streak_goal_days: number
          weekly_page_goal: number
          weekly_pages_read: number
          yearly_book_goal: number
          yearly_books_completed: number
        }[]
      }
      get_premium_reading_stats: {
        Args: never
        Returns: {
          active_days_30d: number
          average_pages_active_day: number
          best_day: string
          best_day_pages: number
          current_streak: number
          daily_page_goal: number
          daily_series: Json
          goal_hit_days: number
          pages_last_7d: number
          pages_previous_7d: number
          period_end: string
          period_start: string
          total_pages_30d: number
        }[]
      }
      get_premium_year_report: {
        Args: { p_year?: number }
        Returns: {
          active_days: number
          average_pages_active_day: number
          best_day: string
          best_day_pages: number
          best_month: number
          best_month_pages: number
          books_completed: number
          goal_hit_days: number
          monthly_series: Json
          report_year: number
          total_pages: number
        }[]
      }
      get_profile_content_stats: {
        Args: { p_target: string }
        Returns: {
          book_count: number
          quote_count: number
          review_count: number
        }[]
      }
      get_reader_directory: {
        Args: {
          p_limit?: number
          p_mode?: string
          p_offset?: number
          p_query?: string
          p_target?: string
        }
        Returns: {
          full_name: string
          id: string
          is_following: boolean
          is_private: boolean
          profile_image: string
          request_pending: boolean
          username: string
        }[]
      }
      get_reading_dashboard: {
        Args: never
        Returns: {
          current_streak: number
          daily_page_goal: number
          timezone: string
          today_pages_read: number
        }[]
      }
      get_same_book_readers: {
        Args: { p_book_key: string }
        Returns: {
          profile_image: string
          user_id: string
          username: string
        }[]
      }
      get_trending_content: {
        Args: never
        Returns: {
          book_key: string
          book_title: string
          comments_count: number
          content_id: string
          content_type: string
          created_at: string
          image_url: string
          likes_count: number
          rating: number
          reposts_count: number
          text: string
          trend_score: number
          user_id: string
          username: string
        }[]
      }
      get_trending_hashtags: {
        Args: never
        Returns: {
          display_hashtag: string
          hashtag: string
          latest_mention_at: string
          mention_count: number
          post_count: number
          review_count: number
          trend_score: number
          unique_users: number
        }[]
      }
      has_admin_role: { Args: { required_roles?: string[] }; Returns: boolean }
      has_effective_premium: { Args: { p_user_id: string }; Returns: boolean }
      invite_to_community: {
        Args: { p_community_id: string; p_invitee_id: string }
        Returns: string
      }
      log_search_event: {
        Args: { p_query: string; p_result_count?: number; p_scope?: string }
        Returns: undefined
      }
      mark_admin_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      media_owner_visible: { Args: { p_owner: string }; Returns: boolean }
      notification_type_enabled: {
        Args: { p_type: string; p_user_id: string }
        Returns: boolean
      }
      process_revenuecat_premium_event: {
        Args: {
          p_cancel_reason?: string
          p_environment: string
          p_event_id: string
          p_event_type: string
          p_expiration_reason?: string
          p_expires_at: string
          p_product_id: string
          p_provider_event_at: string
          p_source: string
          p_source_reference: string
          p_started_at: string
          p_status: string
          p_user_id: string
        }
        Returns: boolean
      }
      process_revenuecat_transfer_event: {
        Args: {
          p_environment: string
          p_event_id: string
          p_provider_event_at: string
          p_transferred_from: string[]
          p_transferred_to: string[]
        }
        Returns: boolean
      }
      public_profile_verifications: {
        Args: { p_user_ids: string[] }
        Returns: {
          user_id: string
          verified: boolean
        }[]
      }
      queue_my_storage_cleanup: {
        Args: { p_bucket: string; p_object_name: string; p_reason?: string }
        Returns: undefined
      }
      readers_blocked: { Args: { a: string; b: string }; Returns: boolean }
      record_automatic_storage_cleanup_result: {
        Args: { p_error?: string; p_ids: string[]; p_success: boolean }
        Returns: undefined
      }
      record_content_view: {
        Args: { p_content_id: string; p_content_type: string }
        Returns: number
      }
      remove_community_member: {
        Args: { p_community_id: string; p_user_id: string }
        Returns: undefined
      }
      report_client_error: {
        Args: {
          p_app_version?: string
          p_component_stack?: string
          p_error_kind: string
          p_message: string
          p_platform?: string
          p_stack?: string
        }
        Returns: undefined
      }
      request_follow: { Args: { p_target: string }; Returns: string }
      respond_follow_request: {
        Args: { p_accept: boolean; p_requester: string }
        Returns: undefined
      }
      respond_to_community_invite: {
        Args: { p_accept: boolean; p_invite_id: string }
        Returns: boolean
      }
      runtime_controls: { Args: never; Returns: Json }
      search_visible_profiles: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          bio: string
          id: string
          profile_image: string
          username: string
        }[]
      }
      set_community_member_role: {
        Args: { p_community_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      set_premium_profile_customization: {
        Args: {
          p_highlight_text: string
          p_layout_key: string
          p_show_premium_frame: boolean
          p_theme_key: string
        }
        Returns: {
          created_at: string
          highlight_text: string
          layout_key: string
          show_premium_frame: boolean
          theme_key: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "premium_profile_customizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_premium_reading_goals: {
        Args: {
          p_monthly_page_goal: number
          p_streak_goal_days: number
          p_weekly_page_goal: number
          p_yearly_book_goal: number
        }
        Returns: {
          created_at: string
          monthly_page_goal: number
          streak_goal_days: number
          updated_at: string
          user_id: string
          weekly_page_goal: number
          yearly_book_goal: number
        }
        SetofOptions: {
          from: "*"
          to: "premium_reading_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_premium_shelf_customization: {
        Args: {
          p_accent_key: string
          p_layout_key: string
          p_read_label: string
          p_reading_label: string
          p_show_counts: boolean
          p_want_label: string
        }
        Returns: {
          accent_key: string
          created_at: string
          layout_key: string
          read_label: string
          reading_label: string
          show_counts: boolean
          updated_at: string
          user_id: string
          want_label: string
        }
        SetofOptions: {
          from: "*"
          to: "premium_shelf_customizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_book_status: {
        Args: { p_book_key: string; p_book_title: string; p_status: string }
        Returns: {
          book_key: string
          book_title: string | null
          created_at: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_book_status"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      should_deliver_notification: {
        Args: { p_kind: string; p_user_id: string }
        Returns: boolean
      }
      storage_object_owner: { Args: { p_name: string }; Returns: string }
      submit_report: {
        Args: {
          p_category: string
          p_description?: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      swap_work_chapters: {
        Args: { first_id: string; second_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          position: number
          published_at: string | null
          status: string
          title: string
          updated_at: string
          work_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "work_chapters"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      track_product_event: {
        Args: { p_event_name: string; p_metadata?: Json }
        Returns: undefined
      }
      update_reading_progress: {
        Args: {
          p_book_key: string
          p_book_title: string
          p_current_page: number
          p_total_pages: number
        }
        Returns: {
          added_pages: number
          current_page: number
          furthest_page: number
          today_pages_read: number
          total_pages: number
          updated_at: string
        }[]
      }
      validate_story_cleanup_token: {
        Args: { p_token: string }
        Returns: boolean
      }
      work_popularity: {
        Args: { genre_filter?: string }
        Returns: {
          saves: number
          work_id: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

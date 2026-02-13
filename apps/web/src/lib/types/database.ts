export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AccountStatus = 'active' | 'suspended' | 'banned' | 'under_review';
export type PeriodType = 'hourly' | 'daily' | 'monthly';
export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AccountLinkType = 'device_fingerprint' | 'ip_address' | 'payment_method' | 'email_pattern' | 'behavioral';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          subscription_tier: 'free' | 'pro' | 'enterprise';
          stripe_customer_id: string | null;
          created_at: string;
          // Security fields
          email_verified: boolean;
          phone_verified: boolean;
          phone_number: string | null;
          account_status: AccountStatus;
          trust_score: number;
          risk_flags: string[];
          last_activity_at: string | null;
          failed_login_attempts: number;
          locked_until: string | null;
          require_verification_for_premium: boolean;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          subscription_tier?: 'free' | 'pro' | 'enterprise';
          stripe_customer_id?: string | null;
          created_at?: string;
          // Security fields
          email_verified?: boolean;
          phone_verified?: boolean;
          phone_number?: string | null;
          account_status?: AccountStatus;
          trust_score?: number;
          risk_flags?: string[];
          last_activity_at?: string | null;
          failed_login_attempts?: number;
          locked_until?: string | null;
          require_verification_for_premium?: boolean;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          subscription_tier?: 'free' | 'pro' | 'enterprise';
          stripe_customer_id?: string | null;
          created_at?: string;
          // Security fields
          email_verified?: boolean;
          phone_verified?: boolean;
          phone_number?: string | null;
          account_status?: AccountStatus;
          trust_score?: number;
          risk_flags?: string[];
          last_activity_at?: string | null;
          failed_login_attempts?: number;
          locked_until?: string | null;
          require_verification_for_premium?: boolean;
        };
        Relationships: [];
      };
      patterns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          parameters: Json;
          parameter_hash: string;
          thumbnail_url: string | null;
          is_public: boolean;
          is_listed: boolean;
          license_type: 'personal' | 'commercial' | 'remix';
          price_cents: number;
          remix_of: string | null;
          tags: string[];
          view_count: number;
          download_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          parameters: Json;
          parameter_hash: string;
          thumbnail_url?: string | null;
          is_public?: boolean;
          is_listed?: boolean;
          license_type?: 'personal' | 'commercial' | 'remix';
          price_cents?: number;
          remix_of?: string | null;
          tags?: string[];
          view_count?: number;
          download_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          parameters?: Json;
          parameter_hash?: string;
          thumbnail_url?: string | null;
          is_public?: boolean;
          is_listed?: boolean;
          license_type?: 'personal' | 'commercial' | 'remix';
          price_cents?: number;
          remix_of?: string | null;
          tags?: string[];
          view_count?: number;
          download_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patterns_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patterns_remix_of_fkey';
            columns: ['remix_of'];
            referencedRelation: 'patterns';
            referencedColumns: ['id'];
          }
        ];
      };
      pattern_dna: {
        Row: {
          short_code: string;
          pattern_id: string | null;
          parameters_compressed: string;
          created_at: string;
        };
        Insert: {
          short_code: string;
          pattern_id?: string | null;
          parameters_compressed: string;
          created_at?: string;
        };
        Update: {
          short_code?: string;
          pattern_id?: string | null;
          parameters_compressed?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pattern_dna_pattern_id_fkey';
            columns: ['pattern_id'];
            referencedRelation: 'patterns';
            referencedColumns: ['id'];
          }
        ];
      };
      purchases: {
        Row: {
          id: string;
          user_id: string;
          pattern_id: string;
          license_type: 'personal' | 'commercial' | 'remix';
          price_cents: number;
          stripe_payment_id: string | null;
          royalty_paid_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pattern_id: string;
          license_type: 'personal' | 'commercial' | 'remix';
          price_cents: number;
          stripe_payment_id?: string | null;
          royalty_paid_cents?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pattern_id?: string;
          license_type?: 'personal' | 'commercial' | 'remix';
          price_cents?: number;
          stripe_payment_id?: string | null;
          royalty_paid_cents?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'purchases_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_pattern_id_fkey';
            columns: ['pattern_id'];
            referencedRelation: 'patterns';
            referencedColumns: ['id'];
          }
        ];
      };
      remixes: {
        Row: {
          id: string;
          original_pattern_id: string;
          remix_pattern_id: string;
          similarity_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          original_pattern_id: string;
          remix_pattern_id: string;
          similarity_score?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          original_pattern_id?: string;
          remix_pattern_id?: string;
          similarity_score?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'remixes_original_pattern_id_fkey';
            columns: ['original_pattern_id'];
            referencedRelation: 'patterns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'remixes_remix_pattern_id_fkey';
            columns: ['remix_pattern_id'];
            referencedRelation: 'patterns';
            referencedColumns: ['id'];
          }
        ];
      };
      ai_style_presets: {
        Row: {
          id: string;
          keywords: string[];
          parameters: Json;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          keywords: string[];
          parameters: Json;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          keywords?: string[];
          parameters?: Json;
          embedding?: number[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      collaboration_sessions: {
        Row: {
          id: string;
          pattern_id: string;
          host_id: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          pattern_id: string;
          host_id: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          pattern_id?: string;
          host_id?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collaboration_sessions_pattern_id_fkey';
            columns: ['pattern_id'];
            referencedRelation: 'patterns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collaboration_sessions_host_id_fkey';
            columns: ['host_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      pattern_comments: {
        Row: {
          id: string;
          pattern_id: string;
          session_id: string | null;
          user_id: string;
          content: string;
          position_x: number | null;
          position_y: number | null;
          resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          pattern_id: string;
          session_id?: string | null;
          user_id: string;
          content: string;
          position_x?: number | null;
          position_y?: number | null;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          pattern_id?: string;
          session_id?: string | null;
          user_id?: string;
          content?: string;
          position_x?: number | null;
          position_y?: number | null;
          resolved?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pattern_comments_pattern_id_fkey';
            columns: ['pattern_id'];
            referencedRelation: 'patterns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pattern_comments_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      comment_replies: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          comment_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comment_replies_comment_id_fkey';
            columns: ['comment_id'];
            referencedRelation: 'pattern_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comment_replies_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      pattern_versions: {
        Row: {
          id: string;
          pattern_id: string;
          name: string;
          parameters: Json;
          created_by: string;
          parent_version_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pattern_id: string;
          name: string;
          parameters: Json;
          created_by: string;
          parent_version_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pattern_id?: string;
          name?: string;
          parameters?: Json;
          created_by?: string;
          parent_version_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pattern_versions_pattern_id_fkey';
            columns: ['pattern_id'];
            referencedRelation: 'patterns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pattern_versions_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_subscription_id?: string;
          stripe_price_id?: string;
          status?: string;
          current_period_start?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      device_fingerprints: {
        Row: {
          id: string;
          fingerprint_hash: string;
          user_id: string | null;
          user_agent_hash: string;
          screen_hash: string | null;
          timezone: string | null;
          language: string | null;
          platform: string | null;
          webgl_hash: string | null;
          canvas_hash: string | null;
          audio_hash: string | null;
          fonts_hash: string | null;
          is_incognito: boolean;
          is_headless: boolean;
          is_automated: boolean;
          has_webdriver: boolean;
          first_seen_at: string;
          last_seen_at: string;
          visit_count: number;
          associated_user_ids: string[];
        };
        Insert: {
          id?: string;
          fingerprint_hash: string;
          user_id?: string | null;
          user_agent_hash: string;
          screen_hash?: string | null;
          timezone?: string | null;
          language?: string | null;
          platform?: string | null;
          webgl_hash?: string | null;
          canvas_hash?: string | null;
          audio_hash?: string | null;
          fonts_hash?: string | null;
          is_incognito?: boolean;
          is_headless?: boolean;
          is_automated?: boolean;
          has_webdriver?: boolean;
          first_seen_at?: string;
          last_seen_at?: string;
          visit_count?: number;
          associated_user_ids?: string[];
        };
        Update: {
          id?: string;
          fingerprint_hash?: string;
          user_id?: string | null;
          user_agent_hash?: string;
          screen_hash?: string | null;
          timezone?: string | null;
          language?: string | null;
          platform?: string | null;
          webgl_hash?: string | null;
          canvas_hash?: string | null;
          audio_hash?: string | null;
          fonts_hash?: string | null;
          is_incognito?: boolean;
          is_headless?: boolean;
          is_automated?: boolean;
          has_webdriver?: boolean;
          first_seen_at?: string;
          last_seen_at?: string;
          visit_count?: number;
          associated_user_ids?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'device_fingerprints_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      user_sessions: {
        Row: {
          id: string;
          user_id: string;
          device_fingerprint_id: string | null;
          session_token_hash: string;
          refresh_token_hash: string | null;
          ip_address: string;
          user_agent: string | null;
          country_code: string | null;
          city: string | null;
          is_suspicious: boolean;
          risk_score: number;
          mfa_verified: boolean;
          created_at: string;
          last_activity_at: string;
          expires_at: string;
          revoked_at: string | null;
          revocation_reason: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_fingerprint_id?: string | null;
          session_token_hash: string;
          refresh_token_hash?: string | null;
          ip_address: string;
          user_agent?: string | null;
          country_code?: string | null;
          city?: string | null;
          is_suspicious?: boolean;
          risk_score?: number;
          mfa_verified?: boolean;
          created_at?: string;
          last_activity_at?: string;
          expires_at: string;
          revoked_at?: string | null;
          revocation_reason?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_fingerprint_id?: string | null;
          session_token_hash?: string;
          refresh_token_hash?: string | null;
          ip_address?: string;
          user_agent?: string | null;
          country_code?: string | null;
          city?: string | null;
          is_suspicious?: boolean;
          risk_score?: number;
          mfa_verified?: boolean;
          created_at?: string;
          last_activity_at?: string;
          expires_at?: string;
          revoked_at?: string | null;
          revocation_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_sessions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_sessions_device_fingerprint_id_fkey';
            columns: ['device_fingerprint_id'];
            referencedRelation: 'device_fingerprints';
            referencedColumns: ['id'];
          }
        ];
      };
      usage_records: {
        Row: {
          id: string;
          user_id: string;
          period_type: PeriodType;
          period_start: string;
          period_end: string;
          patterns_created: number;
          patterns_saved: number;
          ai_requests: number;
          exports_png: number;
          exports_svg: number;
          exports_pdf: number;
          exports_dxf: number;
          api_calls: number;
          bandwidth_bytes: number;
          total_operations: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_type: PeriodType;
          period_start: string;
          period_end: string;
          patterns_created?: number;
          patterns_saved?: number;
          ai_requests?: number;
          exports_png?: number;
          exports_svg?: number;
          exports_pdf?: number;
          exports_dxf?: number;
          api_calls?: number;
          bandwidth_bytes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          period_type?: PeriodType;
          period_start?: string;
          period_end?: string;
          patterns_created?: number;
          patterns_saved?: number;
          ai_requests?: number;
          exports_png?: number;
          exports_svg?: number;
          exports_pdf?: number;
          exports_dxf?: number;
          api_calls?: number;
          bandwidth_bytes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_records_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      usage_lifetime: {
        Row: {
          user_id: string;
          total_patterns_created: number;
          total_ai_requests: number;
          total_exports: number;
          total_api_calls: number;
          total_bandwidth_bytes: number;
          current_period_patterns: number;
          current_period_ai_requests: number;
          current_period_exports: number;
          current_period_start: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_patterns_created?: number;
          total_ai_requests?: number;
          total_exports?: number;
          total_api_calls?: number;
          total_bandwidth_bytes?: number;
          current_period_patterns?: number;
          current_period_ai_requests?: number;
          current_period_exports?: number;
          current_period_start?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          total_patterns_created?: number;
          total_ai_requests?: number;
          total_exports?: number;
          total_api_calls?: number;
          total_bandwidth_bytes?: number;
          current_period_patterns?: number;
          current_period_ai_requests?: number;
          current_period_exports?: number;
          current_period_start?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_lifetime_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      security_events: {
        Row: {
          id: string;
          user_id: string | null;
          device_fingerprint_id: string | null;
          session_id: string | null;
          event_type: string;
          severity: SecurityEventSeverity;
          description: string | null;
          ip_address: string | null;
          user_agent: string | null;
          request_path: string | null;
          request_method: string | null;
          metadata: Json;
          resolved_at: string | null;
          resolved_by: string | null;
          resolution_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          device_fingerprint_id?: string | null;
          session_id?: string | null;
          event_type: string;
          severity: SecurityEventSeverity;
          description?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          request_path?: string | null;
          request_method?: string | null;
          metadata?: Json;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          device_fingerprint_id?: string | null;
          session_id?: string | null;
          event_type?: string;
          severity?: SecurityEventSeverity;
          description?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          request_path?: string | null;
          request_method?: string | null;
          metadata?: Json;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'security_events_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'security_events_device_fingerprint_id_fkey';
            columns: ['device_fingerprint_id'];
            referencedRelation: 'device_fingerprints';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'security_events_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'user_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'security_events_resolved_by_fkey';
            columns: ['resolved_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      ip_reputation: {
        Row: {
          ip_address: string;
          reputation_score: number;
          total_requests: number;
          failed_logins: number;
          rate_limit_hits: number;
          abuse_reports: number;
          is_vpn: boolean;
          is_proxy: boolean;
          is_tor: boolean;
          is_datacenter: boolean;
          is_blocked: boolean;
          country_code: string | null;
          asn: number | null;
          org_name: string | null;
          first_seen_at: string;
          last_seen_at: string;
          blocked_until: string | null;
        };
        Insert: {
          ip_address: string;
          reputation_score?: number;
          total_requests?: number;
          failed_logins?: number;
          rate_limit_hits?: number;
          abuse_reports?: number;
          is_vpn?: boolean;
          is_proxy?: boolean;
          is_tor?: boolean;
          is_datacenter?: boolean;
          is_blocked?: boolean;
          country_code?: string | null;
          asn?: number | null;
          org_name?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          blocked_until?: string | null;
        };
        Update: {
          ip_address?: string;
          reputation_score?: number;
          total_requests?: number;
          failed_logins?: number;
          rate_limit_hits?: number;
          abuse_reports?: number;
          is_vpn?: boolean;
          is_proxy?: boolean;
          is_tor?: boolean;
          is_datacenter?: boolean;
          is_blocked?: boolean;
          country_code?: string | null;
          asn?: number | null;
          org_name?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          blocked_until?: string | null;
        };
        Relationships: [];
      };
      account_links: {
        Row: {
          id: string;
          user_id_1: string;
          user_id_2: string;
          link_type: AccountLinkType;
          confidence_score: number;
          evidence: Json;
          reviewed_at: string | null;
          reviewed_by: string | null;
          is_legitimate: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id_1: string;
          user_id_2: string;
          link_type: AccountLinkType;
          confidence_score: number;
          evidence: Json;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          is_legitimate?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id_1?: string;
          user_id_2?: string;
          link_type?: AccountLinkType;
          confidence_score?: number;
          evidence?: Json;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          is_legitimate?: boolean | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_links_user_id_1_fkey';
            columns: ['user_id_1'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_links_user_id_2_fkey';
            columns: ['user_id_2'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_links_reviewed_by_fkey';
            columns: ['reviewed_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      rate_limit_state: {
        Row: {
          key: string;
          count: number;
          window_start: string;
          window_end: string;
          violation_count: number;
          last_violation_at: string | null;
          penalty_multiplier: number;
        };
        Insert: {
          key: string;
          count?: number;
          window_start: string;
          window_end: string;
          violation_count?: number;
          last_violation_at?: string | null;
          penalty_multiplier?: number;
        };
        Update: {
          key?: string;
          count?: number;
          window_start?: string;
          window_end?: string;
          violation_count?: number;
          last_violation_at?: string | null;
          penalty_multiplier?: number;
        };
        Relationships: [];
      };
      request_signatures: {
        Row: {
          signature_hash: string;
          user_id: string | null;
          request_timestamp: string;
          expires_at: string;
          used_at: string | null;
          endpoint: string;
          ip_address: string | null;
        };
        Insert: {
          signature_hash: string;
          user_id?: string | null;
          request_timestamp: string;
          expires_at: string;
          used_at?: string | null;
          endpoint: string;
          ip_address?: string | null;
        };
        Update: {
          signature_hash?: string;
          user_id?: string | null;
          request_timestamp?: string;
          expires_at?: string;
          used_at?: string | null;
          endpoint?: string;
          ip_address?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'request_signatures_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      feature_access: {
        Row: {
          id: string;
          user_id: string;
          feature_name: string;
          is_enabled: boolean;
          granted_at: string;
          expires_at: string | null;
          granted_by: string | null;
          usage_count: number;
          usage_limit: number | null;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature_name: string;
          is_enabled?: boolean;
          granted_at?: string;
          expires_at?: string | null;
          granted_by?: string | null;
          usage_count?: number;
          usage_limit?: number | null;
          last_used_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          feature_name?: string;
          is_enabled?: boolean;
          granted_at?: string;
          expires_at?: string | null;
          granted_by?: string | null;
          usage_count?: number;
          usage_limit?: number | null;
          last_used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'feature_access_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      marketplace_patterns: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          thumbnail_url: string | null;
          price_cents: number;
          license_type: 'personal' | 'commercial' | 'remix';
          tags: string[];
          view_count: number;
          download_count: number;
          created_at: string;
          user_id: string;
          creator_username: string | null;
          creator_display_name: string | null;
          creator_avatar_url: string | null;
        };
      };
      user_pattern_summary: {
        Row: {
          user_id: string;
          total_patterns: number;
          public_count: number;
          listed_count: number;
          total_views: number;
          total_downloads: number;
          last_activity: string;
        };
      };
    };
    Functions: {
      match_style_presets: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          id: string;
          keywords: string[];
          parameters: Json;
          similarity: number;
        }[];
      };
      increment_pattern_view: {
        Args: {
          pattern_uuid: string;
        };
        Returns: void;
      };
      increment_pattern_download: {
        Args: {
          pattern_uuid: string;
        };
        Returns: void;
      };
      user_has_pattern_access: {
        Args: {
          pattern_uuid: string;
          user_uuid: string;
        };
        Returns: boolean;
      };
      user_has_purchased: {
        Args: {
          pattern_uuid: string;
          user_uuid: string;
        };
        Returns: boolean;
      };
      get_user_tier: {
        Args: {
          user_uuid: string;
        };
        Returns: 'free' | 'pro' | 'enterprise';
      };
      get_marketplace_patterns: {
        Args: {
          page_limit?: number;
          page_offset?: number;
          sort_by?: string;
          filter_tags?: string[] | null;
          min_price?: number | null;
          max_price?: number | null;
        };
        Returns: {
          id: string;
          name: string;
          description: string | null;
          thumbnail_url: string | null;
          price_cents: number;
          view_count: number;
          download_count: number;
          created_at: string;
          user_id: string;
          username: string | null;
          avatar_url: string | null;
          tags: string[];
        }[];
      };
      get_user_pattern_stats: {
        Args: {
          user_uuid: string;
        };
        Returns: {
          total_patterns: number;
          public_patterns: number;
          listed_patterns: number;
          total_views: number;
          total_downloads: number;
          total_earnings_cents: number;
        }[];
      };
      search_patterns: {
        Args: {
          search_query: string;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: {
          id: string;
          name: string;
          description: string | null;
          thumbnail_url: string | null;
          price_cents: number;
          tags: string[];
          rank: number;
        }[];
      };
      record_remix: {
        Args: {
          original_uuid: string;
          remix_uuid: string;
          similarity?: number | null;
        };
        Returns: string;
      };
      create_pattern_dna: {
        Args: {
          p_pattern_id: string;
          p_parameters_compressed: string;
        };
        Returns: string;
      };
      generate_short_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      check_tier_limit: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_tier?: 'free' | 'pro' | 'enterprise' | null;
        };
        Returns: {
          allowed: boolean;
          current: number;
          limit: number;
          remaining: number;
          tier: 'free' | 'pro' | 'enterprise';
        };
      };
      increment_usage: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_amount?: number;
        };
        Returns: boolean;
      };
      log_security_event: {
        Args: {
          p_user_id: string | null;
          p_event_type: string;
          p_severity: SecurityEventSeverity;
          p_description: string;
          p_metadata?: Json;
          p_ip_address?: string | null;
          p_device_fingerprint_id?: string | null;
        };
        Returns: string;
      };
      detect_account_link: {
        Args: {
          p_user_id: string;
          p_fingerprint_hash: string;
          p_ip_address: string;
        };
        Returns: {
          has_linked_accounts: boolean;
          linked_count: number;
          linked_user_ids: string[];
        };
      };
      validate_request_signature: {
        Args: {
          p_signature_hash: string;
          p_user_id: string | null;
          p_endpoint: string;
          p_timestamp: string;
          p_ip_address: string | null;
        };
        Returns: {
          valid: boolean;
          reason?: string;
        };
      };
      cleanup_expired_signatures: {
        Args: Record<string, never>;
        Returns: void;
      };
      reset_monthly_usage: {
        Args: Record<string, never>;
        Returns: void;
      };
      cleanup_rate_limits: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: {
      subscription_tier: 'free' | 'pro' | 'enterprise';
      license_type: 'personal' | 'commercial' | 'remix';
      account_status: 'active' | 'suspended' | 'banned' | 'under_review';
      period_type: 'hourly' | 'daily' | 'monthly';
      security_event_severity: 'low' | 'medium' | 'high' | 'critical';
      account_link_type: 'device_fingerprint' | 'ip_address' | 'payment_method' | 'email_pattern' | 'behavioral';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

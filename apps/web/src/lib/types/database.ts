export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
    };
    Enums: {
      subscription_tier: 'free' | 'pro' | 'enterprise';
      license_type: 'personal' | 'commercial' | 'remix';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

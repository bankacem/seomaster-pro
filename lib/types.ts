export type Plan = "free" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "inactive";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  credits: number;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: string;
  user_id: string;
  content: string;
  url: string | null;
  score: number | null;
  results: SEOAnalysis;
  tokens_used: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  plan: Plan;
  status: SubscriptionStatus | string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  action: string;
  tokens_used: number;
  cost_usd: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SiteAudit {
  id: string;
  user_id: string;
  url: string;
  pages_crawled: number;
  results: SiteAuditResult;
  created_at: string;
}

export interface Issue {
  type: string;
  message: string;
  severity?: "low" | "medium" | "high";
}

export interface SEOAnalysis {
  score: number;
  title: string;
  metaDescription: string;
  keywords: string[];
  suggestions: string[];
  readability: number;
  wordCount: number;
  issues: Issue[];
}

export interface SiteAuditResult {
  url: string;
  pages: Array<Record<string, unknown>>;
  robots: { found: boolean; disallowedPaths: string[] };
  summary: {
    pagesCrawled: number;
    pagesWithIssues: number;
    brokenPages: number;
    totalIssues: number;
    issueCounts: Record<string, number>;
  };
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      analyses: {
        Row: Analysis;
        Insert: Omit<Analysis, "id" | "created_at">;
        Update: Partial<Analysis>;
        Relationships: [];
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, "id" | "created_at" | "updated_at"> & Partial<Pick<Subscription, "id" | "created_at" | "updated_at">>;
        Update: Partial<Subscription>;
        Relationships: [];
      };
      usage_logs: {
        Row: UsageLog;
        Insert: Omit<UsageLog, "id" | "created_at">;
        Update: Partial<UsageLog>;
        Relationships: [];
      };
      site_audits: {
        Row: SiteAudit;
        Insert: Omit<SiteAudit, "id" | "created_at">;
        Update: Partial<SiteAudit>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      decrement_profile_credits: {
        Args: { p_user_id: string; p_amount: number };
        Returns: number;
      };
      add_profile_credits: {
        Args: { p_user_id: string; p_amount: number };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
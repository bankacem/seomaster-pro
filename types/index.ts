export type SubscriptionPlan = "free" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";

export interface SeoIssue { type: string; message: string; }

export interface ArticleAnalysis {
  score: number;
  title: string;
  metaDescription: string;
  keywords: string[];
  suggestions: string[];
  readability: number;
  wordCount: number;
  issues: SeoIssue[];
  competitorComparison?: Record<string, unknown>;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: SubscriptionPlan;
  credits: number;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRecord {
  id: string;
  user_id: string;
  content: string;
  url: string | null;
  score: number;
  results: ArticleAnalysis;
  created_at: string;
}

export interface UsageStats {
  analysesThisMonth: number;
  monthlyLimit: number;
  remaining: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & Pick<Profile, "id">; Update: Partial<Profile> };
      analyses: { Row: AnalysisRecord; Insert: Omit<AnalysisRecord, "id" | "created_at">; Update: Partial<AnalysisRecord> };
      reports: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      subscriptions: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      usage_logs: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

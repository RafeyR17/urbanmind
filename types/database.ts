export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type InfrastructureType =
  | 'hospital'
  | 'school'
  | 'fire_station'
  | 'police';

export interface Database {
  public: {
    Tables: {
      city_infrastructure: {
        Row: {
          id: string;
          name: string;
          type: InfrastructureType;
          lat: number;
          lng: number;
          metadata: Json;
          created_at: string;
          location: unknown | null;
        };
        Insert: {
          id?: string;
          name: string;
          type: InfrastructureType;
          lat: number;
          lng: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: InfrastructureType;
          lat?: number;
          lng?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      district_zones: {
        Row: {
          id: string;
          name: string;
          slug: string;
          polygon: unknown | null;
          base_traffic_score: number;
          base_flood_risk: number;
          base_emergency_minutes: number;
          population: number;
          area_sqkm: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          polygon?: unknown | null;
          base_traffic_score?: number;
          base_flood_risk?: number;
          base_emergency_minutes?: number;
          population?: number;
          area_sqkm?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          polygon?: unknown | null;
          base_traffic_score?: number;
          base_flood_risk?: number;
          base_emergency_minutes?: number;
          population?: number;
          area_sqkm?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      simulation_runs: {
        Row: {
          id: string;
          policy_type: string;
          location: unknown | null;
          budget_pkr: number | null;
          radius_km: number | null;
          parameters: Json;
          result: Json | null;
          ai_verdict: string | null;
          ai_summary: string | null;
          processing_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          policy_type: string;
          location?: unknown | null;
          budget_pkr?: number | null;
          radius_km?: number | null;
          parameters?: Json;
          result?: Json | null;
          ai_verdict?: string | null;
          ai_summary?: string | null;
          processing_time_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          policy_type?: string;
          location?: unknown | null;
          budget_pkr?: number | null;
          radius_km?: number | null;
          parameters?: Json;
          result?: Json | null;
          ai_verdict?: string | null;
          ai_summary?: string | null;
          processing_time_ms?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      scenarios: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          policy_type: string | null;
          location: unknown | null;
          budget_pkr: number | null;
          parameters: Json;
          result: Json | null;
          ai_response: Json | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          policy_type?: string | null;
          location?: unknown | null;
          budget_pkr?: number | null;
          parameters?: Json;
          result?: Json | null;
          ai_response?: Json | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          policy_type?: string | null;
          location?: unknown | null;
          budget_pkr?: number | null;
          parameters?: Json;
          result?: Json | null;
          ai_response?: Json | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

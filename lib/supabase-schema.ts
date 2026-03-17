/**
 * Type definitions for future Supabase schema.
 * These represent the recommended DB schema for the pharmacy translation workflow.
 */

export interface ConversationSession {
  id: string;
  staff_language: string;
  guest_language: string | null;
  guest_language_confidence: number | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  ended_at: string | null;
}

export interface Transcript {
  id: string;
  session_id: string;
  user_id: string | null;
  source_language: string | null;
  full_transcript_text: string;
  speaker_role: 'staff' | 'guest' | 'system';
  raw_detected_language: string | null;
  normalized_language: string | null;
  is_detection_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface Translation {
  id: string;
  session_id: string;
  transcript_id: string;
  source_role: 'staff' | 'guest';
  source_language: string;
  target_language: string;
  source_text: string;
  translated_text: string;
  created_at: string;
}

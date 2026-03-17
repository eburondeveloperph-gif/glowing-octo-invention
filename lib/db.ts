import { supabase } from './supabase';

export async function createSession(staffId: string, staffLanguage: string) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ staff_id: staffId, staff_language: staffLanguage })
    .select('id')
    .single();
  if (error) { console.error('createSession error:', error); return null; }
  return data.id as string;
}

export async function endSession(sessionId: string, guestLanguage: string | null) {
  await supabase
    .from('sessions')
    .update({ ended_at: new Date().toISOString(), guest_language: guestLanguage })
    .eq('id', sessionId);
}

export async function saveTranslation(
  sessionId: string,
  speaker: 'staff' | 'guest',
  originalText: string,
  translatedText: string,
) {
  await supabase.from('translations').insert({
    session_id: sessionId,
    speaker,
    original_text: originalText,
    translated_text: translatedText,
  });
}

export async function uploadAudio(userId: string, sessionId: string, blob: Blob) {
  const path = `${userId}/${sessionId}.webm`;
  const { error } = await supabase.storage.from('recordings').upload(path, blob, {
    contentType: 'audio/webm',
    upsert: true,
  });
  if (error) { console.error('uploadAudio error:', error); return null; }

  await supabase.from('sessions').update({ audio_path: path }).eq('id', sessionId);
  return path;
}

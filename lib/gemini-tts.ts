/**
 * Gemini TTS API client using gemini-2.5-flash-preview-tts.
 * Uses streamGenerateContent for text-to-speech with Orus voice.
 */

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface TTSOptions {
  apiKey: string;
  voice?: string;
  text: string;
}

/**
 * Calls the Gemini TTS API and returns PCM16 audio at 24kHz.
 * Streams chunks to onChunk as they arrive for low-latency playback.
 */
export async function generateTTSAudio({
  apiKey,
  voice = 'Orus',
  text,
  onChunk,
}: TTSOptions & { onChunk?: (chunk: Uint8Array) => void }): Promise<ArrayBuffer> {
  const url = `${TTS_BASE}/models/${TTS_MODEL}:streamGenerateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `Read aloud in a warm and friendly tone:\n\n${text}` }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature: 1,
      speech_config: {
        voice_config: {
          prebuilt_voice_config: {
            voice_name: voice,
          },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS API error ${res.status}: ${err}`);
  }

  const chunks: Uint8Array[] = [];
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) continue;
      try {
        const obj = JSON.parse(trimmed);
        const parts = obj?.candidates?.[0]?.content?.parts ?? [];
        for (const p of Array.isArray(parts) ? parts : [parts]) {
          if (p?.inlineData?.data) {
            const b64 = p.inlineData.data;
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            chunks.push(bytes);
            onChunk?.(bytes);
          }
        }
      } catch {
        // skip malformed lines
      }
    }
  }
  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer.trim());
      const parts = obj?.candidates?.[0]?.content?.parts ?? [];
      for (const p of parts) {
        if (p?.inlineData?.data) {
          const bytes = Uint8Array.from(atob(p.inlineData.data), c => c.charCodeAt(0));
          chunks.push(bytes);
          onChunk?.(bytes);
        }
      }
    } catch {
      // skip
    }
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result.buffer;
}

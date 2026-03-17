import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, Modality } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useSettings } from '../../lib/state';
import { generateTTSAudio } from '../../lib/gemini-tts';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  configRef: React.RefObject<LiveConnectConfig>;
  connect: () => Promise<void>;
  connectWithConfig: (overrideConfig: LiveConnectConfig) => Promise<void>;
  disconnect: () => void;
  connected: boolean;
  volume: number;
  isTtsMuted: boolean;
  toggleTtsMute: () => void;
  playTTS: (text: string) => Promise<void>;
};

/** Use Live API audio for lowest latency; set true to use TTS API instead */
const USE_TTS_API = false;

export function useLiveApi({ apiKey }: { apiKey: string }): UseLiveApiResults {
  const { model, voice } = useSettings();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const configRef = useRef<LiveConnectConfig>({});

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [config, _setConfig] = useState<LiveConnectConfig>({});
  const [isTtsMuted, setIsTtsMuted] = useState(false);

  const setConfig = useCallback((c: LiveConnectConfig) => {
    configRef.current = c;
    _setConfig(c);
  }, []);

  const toggleTtsMute = useCallback(() => {
    setIsTtsMuted((prev) => {
      const newMuted = !prev;
      if (audioStreamerRef.current) {
        audioStreamerRef.current.gainNode.gain.value = newMuted ? 0 : 1;
      }
      return newMuted;
    });
  }, []);

  const streamerReadyRef = useRef<Promise<AudioStreamer | null>>(Promise.resolve(null));
  useEffect(() => {
    if (!audioStreamerRef.current) {
      streamerReadyRef.current = audioContext({ id: 'audio-out' }).then(
        (audioCtx: AudioContext) => {
          const streamer = new AudioStreamer(audioCtx);
          audioStreamerRef.current = streamer;
          streamer
            .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
              setVolume(ev.data.volume);
            })
            .catch((err) => console.error('Error adding worklet:', err));
          return streamer;
        },
      );
    }
  }, []);

  const playTTS = useCallback(
    async (text: string) => {
      if (!text?.trim() || isTtsMuted) return;
      if (!USE_TTS_API) return; // Live API audio plays instead
      const streamer = audioStreamerRef.current;
      if (!streamer) {
        console.warn('TTS: audio streamer not ready');
        return;
      }
      try {
        await streamer.resume();
        await generateTTSAudio({
          apiKey: apiKeyRef.current,
          voice: voice || 'Orus',
          text: text.trim(),
          onChunk: (chunk) => streamer.addPCM16(chunk),
        });
      } catch (err) {
        console.error('TTS error:', err);
      }
    },
    [voice, isTtsMuted],
  );

  useEffect(() => {
    const onOpen = () => setConnected(true);
    const onClose = () => setConnected(false);
    const stopAudioStreamer = () => audioStreamerRef.current?.stop();
    const onAudio = (data: ArrayBuffer) => {
      if (!USE_TTS_API) {
        streamerReadyRef.current.then((streamer) => {
          if (streamer) {
            streamer.resume().then(() => streamer.addPCM16(new Uint8Array(data)));
          }
        });
      }
    };

    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);

    return () => {
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
    };
  }, [client]);

  const connect = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg) throw new Error('config has not been set');
    client.disconnect();
    await client.connect(cfg);
  }, [client]);

  const connectWithConfig = useCallback(
    async (overrideConfig: LiveConnectConfig) => {
      configRef.current = overrideConfig;
      _setConfig(overrideConfig);
      client.disconnect();
      await client.connect(overrideConfig);
    },
    [client],
  );

  const disconnect = useCallback(() => {
    client.disconnect();
    setConnected(false);
  }, [client]);

  return {
    client,
    config,
    configRef,
    setConfig,
    connect,
    connectWithConfig,
    disconnect,
    connected,
    volume,
    isTtsMuted,
    toggleTtsMute,
    playTTS,
  };
}

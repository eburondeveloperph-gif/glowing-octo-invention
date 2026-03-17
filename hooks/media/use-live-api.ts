import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, Modality } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useSettings } from '../../lib/state';

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
};

export function useLiveApi({ apiKey }: { apiKey: string }): UseLiveApiResults {
  const { model } = useSettings();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);

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

  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .catch((err) => console.error('Error adding worklet:', err));
      });
    }
  }, []);

  useEffect(() => {
    const onOpen = () => setConnected(true);
    const onClose = () => setConnected(false);
    const stopAudioStreamer = () => audioStreamerRef.current?.stop();
    const onAudio = (data: ArrayBuffer) => {
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));
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
  };
}

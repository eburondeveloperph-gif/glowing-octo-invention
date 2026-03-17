import cn from 'classnames';
import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useSessionStore, useLogStore, useUI } from '../../../lib/state';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { uploadAudio } from '../../../lib/db';
import { supabase } from '../../../lib/supabase';

export type ControlTrayProps = {
  children?: ReactNode;
};

function autoDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function ts() {
  return new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
}

function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);

  const {
    client,
    connected,
    isTtsMuted,
    toggleTtsMute,
    volume: ttsVolume,
  } = useLiveAPIContext();

  const session = useSessionStore();
  const { toggleSidebar, toggleProfile, setMicVolume } = useUI();
  const activeSpeaker = useUI((s) => s.activeSpeaker);
  const setTtsVolume = useUI((s) => s.setTtsVolume);

  const isIdle = session.sessionPhase === 'idle';
  const isError = session.sessionPhase === 'error';
  const isActive = !isIdle && !isError;

  useEffect(() => { setTtsVolume(ttsVolume); }, [ttsVolume, setTtsVolume]);

  const ttsPlayingRef = useRef(false);
  const ttsGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ttsVolume > 0.01) {
      ttsPlayingRef.current = true;
      if (ttsGraceRef.current) {
        clearTimeout(ttsGraceRef.current);
        ttsGraceRef.current = null;
      }
    } else if (ttsPlayingRef.current) {
      if (!ttsGraceRef.current) {
        ttsGraceRef.current = setTimeout(() => {
          ttsPlayingRef.current = false;
          ttsGraceRef.current = null;
        }, 800);
      }
    }
  }, [ttsVolume]);

  useEffect(() => {
    if (!connected) {
      setMuted(false);
      setMicVolume(0);
      ttsPlayingRef.current = false;
    }
  }, [connected, setMicVolume]);

  useEffect(() => {
    const onData = (base64: string) => {
      const ui = useUI.getState();
      if (!ui.introComplete) return;
      if (ttsPlayingRef.current) return;
      client.sendRealtimeInput([
        { mimeType: 'audio/pcm;rate=16000', data: base64 },
      ]);
    };
    const onVolume = (vol: number) => setMicVolume(vol);

    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData);
      audioRecorder.on('volume', onVolume);
      audioRecorder.start();
    } else {
      setMicVolume(0);
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off('data', onData);
      audioRecorder.off('volume', onVolume);
    };
  }, [connected, client, muted, audioRecorder, setMicVolume]);

  // --- Background audio recording ---
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        recChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recChunksRef.current.push(e.data);
        };
        recorder.start(1000);
        recorderRef.current = recorder;
      } catch (err) {
        console.error('Recording start failed:', err);
      }
    };

    startRecording();
  }, [isActive]);

  const handleStop = () => {
    sessionIdRef.current = useUI.getState().dbSessionId;

    const recorder = recorderRef.current;
    const stream = recStreamRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = recChunksRef.current.length > 0
          ? new Blob(recChunksRef.current, { type: mimeType })
          : null;
        if (blob) setPendingBlob(blob);
        stream?.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        recStreamRef.current = null;
        recChunksRef.current = [];
      };
      recorder.stop();
    }

    session.requestStop();
  };

  const handleDownload = async () => {
    if (pendingBlob) {
      autoDownload(pendingBlob, `orbit-conversation-${ts()}.webm`);

      const { data } = await supabase.auth.getUser();
      if (data.user && sessionIdRef.current) {
        uploadAudio(data.user.id, sessionIdRef.current, pendingBlob);
      }
    }
    setPendingBlob(null);
    sessionIdRef.current = null;
  };

  const handleDiscard = () => {
    setPendingBlob(null);
    sessionIdRef.current = null;
  };

  const handleMicToggle = () => {
    if (connected && !ttsPlayingRef.current) setMuted(!muted);
  };

  return (
    <>
      <footer className="bottom-bar">
        <div className="controls-pill">
          {/* Volume / TTS mute */}
          <button
            className={cn('icon-btn', { active: isTtsMuted })}
            onClick={toggleTtsMute}
            disabled={!isActive}
            aria-label={isTtsMuted ? 'Unmute audio' : 'Mute audio'}
          >
            <svg viewBox="0 0 24 24">
              {isTtsMuted ? (
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              ) : (
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              )}
            </svg>
          </button>

          {/* Stop conversation */}
          <button
            className={cn('icon-btn', { active: isActive })}
            onClick={handleStop}
            disabled={!isActive}
            aria-label="Stop conversation"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>

          {/* Center mic button — glows with mic volume */}
          <button
            className={cn('center-mic-btn', {
              muted: connected && muted,
              listening:
                connected &&
                !muted &&
                !ttsPlayingRef.current &&
                (activeSpeaker === 'staff' || activeSpeaker === 'guest'),
              'mic-active':
                connected &&
                !muted &&
                !ttsPlayingRef.current &&
                (activeSpeaker === 'staff' || activeSpeaker === 'guest') &&
                useUI.getState().micVolume > 0.05,
            })}
            onClick={handleMicToggle}
            disabled={!connected || ttsPlayingRef.current}
            aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            <svg viewBox="0 0 24 24">
              {connected && muted ? (
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
              ) : (
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              )}
            </svg>
          </button>

          {/* Settings */}
          <button
            className="icon-btn"
            onClick={toggleSidebar}
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
          </button>

          {/* User profile */}
          <button
            className="icon-btn"
            onClick={toggleProfile}
            aria-label="User profile"
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>

          {children}
        </div>
      </footer>

      {/* Download prompt overlay */}
      {pendingBlob && (
        <div className="download-prompt-overlay">
          <div className="download-prompt">
            <p className="download-prompt-text">Save conversation audio?</p>
            <div className="download-prompt-actions">
              <button className="download-btn accept" onClick={handleDownload}>
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Download
              </button>
              <button className="download-btn discard" onClick={handleDiscard}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(ControlTray);

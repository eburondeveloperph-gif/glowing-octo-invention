import { useCallback, useEffect, useRef } from 'react';
import { Modality, LiveServerContent } from '@google/genai';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSessionStore,
  useSettings,
  useLogStore,
  useUI,
  ConversationTurn,
} from '../../../lib/state';
import { useHistoryStore } from '../../../lib/history';
import { buildDetectionPrompt, buildBidirectionalPrompt } from '../../../lib/prompts';
import {
  detectLanguageFromText,
  inferTurnDirection,
  isStaffLanguage,
} from '../../../lib/language-detection';
import { MIN_DETECTION_CONFIDENCE } from '../../../lib/constants';
import { createSession, endSession, saveTranslation } from '../../../lib/db';
import { supabase } from '../../../lib/supabase';
import SessionDisplay from '../welcome-screen/SessionDisplay';

export default function StreamingConsole() {
  const { client, connectWithConfig, disconnect, connected } = useLiveAPIContext();
  const { voice, topic } = useSettings();
  const session = useSessionStore();
  const { addHistoryItem } = useHistoryStore();

  const detectionBufferRef = useRef('');
  const welcomeCompletedRef = useRef(false);
  const phaseRef = useRef(session.sessionPhase);
  phaseRef.current = session.sessionPhase;

  const guestLangRef = useRef(session.guestLanguage);
  guestLangRef.current = session.guestLanguage;

  const staffLangRef = useRef(session.staffLanguage);
  staffLangRef.current = session.staffLanguage;

  const introPlayedRef = useRef(false);
  const prevSpeakerRef = useRef<'staff' | 'guest' | 'ai' | 'none'>('none');

  function playTurnChime() {
    try {
      const ctx = new AudioContext();
      const g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1100, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.18);
      o.connect(g);
      o.start();
      o.stop(ctx.currentTime + 0.4);

      setTimeout(() => ctx.close().catch(() => {}), 600);
    } catch {
      // ignore
    }
  }

  const buildConfig = useCallback(
    (systemPrompt: string) =>
      ({
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }) as any,
    [voice],
  );

  const introFrameRef = useRef<number>(0);

  // Play intro audio instantly on Start; visualize on the orb via AnalyserNode
  useEffect(() => {
    const phase = session.sessionPhase;

    if (phase !== 'idle' && phase !== 'error' && !introPlayedRef.current) {
      introPlayedRef.current = true;
      useUI.getState().setIntroComplete(false);

      const audioCtx = new AudioContext();
      const audio = new Audio('/play.mp3');
      audio.crossOrigin = 'anonymous';
      const source = audioCtx.createMediaElementSource(audio);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const measure = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        useUI.getState().setIntroVolume(avg / 255);
        introFrameRef.current = requestAnimationFrame(measure);
      };

      const cleanup = () => {
        cancelAnimationFrame(introFrameRef.current);
        useUI.getState().setIntroVolume(0);
        useUI.getState().setIntroComplete(true);
        audioCtx.close().catch(() => {});
      };

      audio.addEventListener('ended', cleanup);
      audio.addEventListener('error', cleanup);
      audio.play().then(measure).catch(cleanup);
    }

    if (phase === 'idle') {
      introPlayedRef.current = false;
      cancelAnimationFrame(introFrameRef.current);
      useUI.getState().setIntroVolume(0);
      useUI.getState().setIntroComplete(false);
    }
  }, [session.sessionPhase]);

  useEffect(() => {
    const action = session.pendingAction;
    if (!action) return;
    session.clearPendingAction();

    if (action === 'start') {
      detectionBufferRef.current = '';
      welcomeCompletedRef.current = false;
      useLogStore.getState().clearTurns();
      session.setPhase('prompting');

      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          const sLang = useSessionStore.getState().staffLanguage;
          createSession(data.user.id, sLang).then((id) => {
            if (id) useUI.setState({ dbSessionId: id });
          });
        }
      });

      const sLang = useSessionStore.getState().staffLanguage;
      const prompt = buildDetectionPrompt(sLang);
      connectWithConfig(buildConfig(prompt)).catch(() => {
        session.setError('Kan geen verbinding maken');
      });
    }

    if (action === 'stop') {
      useUI.getState().setActiveSpeaker('none');

      const dbSid = useUI.getState().dbSessionId;
      if (dbSid) {
        endSession(dbSid, useSessionStore.getState().guestLanguage);
        useUI.setState({ dbSessionId: null });
      }

      disconnect();
      session.reset();
    }

    if (action === 'reset-language') {
      if (useSessionStore.getState().guestLanguage) return;

      const sLang = useSessionStore.getState().staffLanguage;
      const override = session.pendingLanguageOverride;
      if (override) {
        session.setGuestLanguage(override, 1.0, 'manual-override');
        const prompt = buildBidirectionalPrompt(override, topic, sLang);
        disconnect();
        connectWithConfig(buildConfig(prompt))
          .then(() => session.setPhase('live'))
          .catch(() => session.setError('Herverbinding mislukt'));
      } else {
        detectionBufferRef.current = '';
        welcomeCompletedRef.current = false;
        session.setPhase('detecting');
        const prompt = buildDetectionPrompt(sLang);
        disconnect();
        connectWithConfig(buildConfig(prompt)).catch(() =>
          session.setError('Herverbinding mislukt'),
        );
      }
    }
  }, [session.pendingAction]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const commitLanguage = (locale: string, confidence: number) => {
      if (useSessionStore.getState().guestLanguage) return;
      const sLang = staffLangRef.current;
      useSessionStore.getState().setGuestLanguage(locale, confidence, 'auto');
      const prompt = buildBidirectionalPrompt(locale, topic, sLang);
      disconnect();
      connectWithConfig(buildConfig(prompt))
        .then(() => useSessionStore.getState().setPhase('live'))
        .catch(() => useSessionStore.getState().setError('Herverbinding mislukt'));
    };

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];

      const phase = phaseRef.current;
      const gLang = guestLangRef.current;

      if (phase === 'prompting' && !welcomeCompletedRef.current) {
        return;
      }

      if (!gLang && (phase === 'detecting' || (phase === 'prompting' && welcomeCompletedRef.current))) {
        detectionBufferRef.current += ' ' + text;
        const trimmed = detectionBufferRef.current.trim();
        useSessionStore.getState().setLastDetectedTranscript(trimmed);

        const sLang = staffLangRef.current;
        const result = detectLanguageFromText(trimmed);

        if (result && !isStaffLanguage(result.normalizedLocale, sLang) && result.confidence >= MIN_DETECTION_CONFIDENCE) {
          commitLanguage(result.normalizedLocale, result.confidence);
          return;
        }
        return;
      }

      const sLangCurrent = staffLangRef.current;
      const direction = gLang ? inferTurnDirection(text, gLang, sLangCurrent) : null;
      const speakerRole = direction === 'staff-to-guest' ? 'staff' : 'guest';
      if (direction) {
        useSessionStore.getState().setActiveTurn(direction);
        const newSpeaker = speakerRole;
        const ui = useUI.getState();
        if (prevSpeakerRef.current !== newSpeaker) {
          prevSpeakerRef.current = newSpeaker;
          ui.setActiveSpeaker(newSpeaker);
          playTurnChime();
        }
      }

      if (last && last.role === 'user' && !last.isFinal) {
        const separator = last.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ';
        updateLastTurn({ text: last.text + separator + text, isFinal });
      } else {
        addTurn({
          role: 'user',
          text,
          isFinal,
          speakerRole: speakerRole as 'staff' | 'guest',
          direction,
          sourceLanguage: direction === 'staff-to-guest' ? sLangCurrent : (gLang ?? undefined),
          targetLanguage: direction === 'staff-to-guest' ? (gLang ?? undefined) : sLangCurrent,
        });
      }
    };

    const handleOutputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];

      const phase = phaseRef.current;

      if (phase === 'prompting' && !welcomeCompletedRef.current) {
        if (last && last.role === 'system' && !last.isFinal) {
          const separator = last.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ';
          updateLastTurn({ text: last.text + separator + text, isFinal });
        } else {
          addTurn({ role: 'system', text, isFinal, speakerRole: 'system' });
        }
        return;
      }

      if (last && last.role === 'agent' && !last.isFinal) {
        const separator = last.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ';
        updateLastTurn({ text: last.text + separator + text, isFinal });
      } else {
        const currentSession = useSessionStore.getState();
        const dir = currentSession.activeTurn;
        addTurn({
          role: 'agent',
          text,
          isFinal,
          speakerRole: 'system',
          direction: dir,
          sourceLanguage: dir === 'staff-to-guest' ? currentSession.staffLanguage : (currentSession.guestLanguage ?? undefined),
          targetLanguage: dir === 'staff-to-guest' ? (currentSession.guestLanguage ?? undefined) : currentSession.staffLanguage,
        });
        const ui = useUI.getState();
        if (prevSpeakerRef.current !== 'ai') {
          prevSpeakerRef.current = 'ai';
          ui.setActiveSpeaker('ai');
          playTurnChime();
        }
      }
    };

    const handleContent = (serverContent: LiveServerContent) => {
      const text =
        serverContent.modelTurn?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join(' ') ?? '';
      const groundingChunks = serverContent.groundingMetadata?.groundingChunks as any;
      // We rely on `outputTranscription` for agent text to avoid double / partial
      // updates. Here we only enrich the latest agent turn with grounding info.
      if (!groundingChunks) return;

      const turns = useLogStore.getState().turns;
      const last = turns.at(-1);
      if (last?.role === 'agent') {
        const u: Partial<ConversationTurn> = {
          groundingChunks: [...(last.groundingChunks || []), ...groundingChunks],
        };
        updateLastTurn(u);
      }
    };

    const handleTurnComplete = () => {
      const { turns, updateLastTurn: upd } = useLogStore.getState();
      const last = turns.at(-1);

      if (!last || last.isFinal) return;
      upd({ isFinal: true });

      const phase = phaseRef.current;
      if (phase === 'prompting' && !welcomeCompletedRef.current) {
        welcomeCompletedRef.current = true;
        useSessionStore.getState().setPhase('detecting');
        return;
      }

      const updatedTurns = useLogStore.getState().turns;
      const finalAgent = updatedTurns.at(-1);
      if (finalAgent?.role === 'agent' && finalAgent.text) {
        let correspondingUser: ConversationTurn | null = null;
        for (let i = updatedTurns.length - 2; i >= 0; i--) {
          if (updatedTurns[i].role === 'user') {
            correspondingUser = updatedTurns[i];
            break;
          }
        }
        if (correspondingUser?.text) {
          const gLang = guestLangRef.current;
          const speaker = correspondingUser.speakerRole === 'staff' ? 'staff' : 'guest';
          addHistoryItem({
            sourceText: correspondingUser.text.trim(),
            translatedText: finalAgent.text.trim(),
            lang1: staffLangRef.current,
            lang2: gLang || 'Unknown',
          });

          const dbSid = useUI.getState().dbSessionId;
          if (dbSid) {
            saveTranslation(dbSid, speaker as 'staff' | 'guest', correspondingUser.text.trim(), finalAgent.text.trim());
          }
        }
      }

      // Turn has fully completed; no-one actively has the floor now.
      prevSpeakerRef.current = 'none';
      useUI.getState().setActiveSpeaker('none');
    };

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', handleContent);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', handleContent);
      client.off('turncomplete', handleTurnComplete);
    };
  }, [client, addHistoryItem, topic, disconnect, connectWithConfig, buildConfig]);

  return (
    <main className="center-stage">
      <SessionDisplay />
    </main>
  );
}

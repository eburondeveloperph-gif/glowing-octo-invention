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
  detectLanguageNameFromTranscript,
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
  const detectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectionCandidateRef = useRef<{ locale: string; confidence: number } | null>(null);
  const phaseRef = useRef(session.sessionPhase);
  phaseRef.current = session.sessionPhase;

  const guestLangRef = useRef(session.guestLanguage);
  guestLangRef.current = session.guestLanguage;

  const staffLangRef = useRef(session.staffLanguage);
  staffLangRef.current = session.staffLanguage;

  const introPlayedRef = useRef(false);

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

  // Play play.mp3 for 5s, then enable mic for language detection
  useEffect(() => {
    const phase = session.sessionPhase;

    if (phase !== 'idle' && phase !== 'error' && !introPlayedRef.current) {
      introPlayedRef.current = true;
      useUI.getState().setIntroComplete(false);

      // Play audio for 5 seconds
      const audio = new Audio('/play.mp3');
      audio.play().catch(() => {});
      
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        useUI.getState().setIntroComplete(true);
      }, 5000);
    }

    if (phase === 'idle') {
      introPlayedRef.current = false;
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
      detectionCandidateRef.current = null;
      if (detectionTimerRef.current) { clearTimeout(detectionTimerRef.current); detectionTimerRef.current = null; }
      welcomeCompletedRef.current = false;
      useLogStore.getState().clearTurns();
      session.setPhase('detecting');

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
      if (detectionTimerRef.current) { clearTimeout(detectionTimerRef.current); detectionTimerRef.current = null; }
      detectionCandidateRef.current = null;

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
      if (detectionTimerRef.current) {
        clearTimeout(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
      detectionCandidateRef.current = null;
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

        // First check if user said a language name (e.g. "French", "Arabic")
        const langName = detectLanguageNameFromTranscript(trimmed);
        if (langName && !isStaffLanguage(langName, sLang)) {
          if (detectionTimerRef.current) { clearTimeout(detectionTimerRef.current); detectionTimerRef.current = null; }
          useSessionStore.getState().setGuestLanguage(langName, 1.0, 'manual-override');
          
          // Start DB session now that we know languages
          supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
              createSession(data.user.id, sLang).then((id) => {
                if (id) useUI.setState({ dbSessionId: id });
              });
            }
          });

          // Switch to bidirectional translation
          const prompt = buildBidirectionalPrompt(langName, topic, sLang);
          disconnect();
          connectWithConfig(buildConfig(prompt)).catch(() => {
            useSessionStore.getState().setError('Kan geen verbinding maken');
          });
          useSessionStore.getState().setPhase('live');
          return;
        }

        // Fallback: detect language from speech patterns
        const result = detectLanguageFromText(trimmed);

        if (result && !isStaffLanguage(result.normalizedLocale, sLang)) {
          if (result.confidence >= 0.35) {
            commitLanguage(result.normalizedLocale, result.confidence);
            return;
          }
          if (!detectionCandidateRef.current || result.confidence > detectionCandidateRef.current.confidence) {
            detectionCandidateRef.current = { locale: result.normalizedLocale, confidence: result.confidence };
          }
        }

        if (!detectionTimerRef.current) {
          detectionTimerRef.current = setTimeout(() => {
            detectionTimerRef.current = null;
            if (useSessionStore.getState().guestLanguage) return;
            const candidate = detectionCandidateRef.current;
            if (candidate) {
              commitLanguage(candidate.locale, candidate.confidence);
            }
          }, 3000);
        }
        return;
      }

      const sLangCurrent = staffLangRef.current;
      const direction = gLang ? inferTurnDirection(text, gLang, sLangCurrent) : null;
      const speakerRole = direction === 'staff-to-guest' ? 'staff' : 'guest';
      if (direction) {
        useSessionStore.getState().setActiveTurn(direction);
      }

      if (last && last.role === 'user' && !last.isFinal) {
        updateLastTurn({ text: last.text + text, isFinal });
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
          updateLastTurn({ text: last.text + text, isFinal });
        } else {
          addTurn({ role: 'system', text, isFinal, speakerRole: 'system' });
        }
        return;
      }

      if (last && last.role === 'agent' && !last.isFinal) {
        updateLastTurn({ text: last.text + text, isFinal });
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
      }
    };

    const handleContent = (serverContent: LiveServerContent) => {
      const text =
        serverContent.modelTurn?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join(' ') ?? '';
      const groundingChunks = serverContent.groundingMetadata?.groundingChunks as any;
      if (!text && !groundingChunks) return;

      const turns = useLogStore.getState().turns;
      const last = turns.at(-1);
      if (last?.role === 'agent' && !last.isFinal) {
        const u: Partial<ConversationTurn> = { text: last.text + text };
        if (groundingChunks) {
          u.groundingChunks = [...(last.groundingChunks || []), ...groundingChunks];
        }
        updateLastTurn(u);
      } else {
        addTurn({ role: 'agent', text, isFinal: false, groundingChunks });
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

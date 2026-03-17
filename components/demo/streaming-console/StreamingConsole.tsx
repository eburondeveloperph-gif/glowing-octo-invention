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
import { inferTurnDirection } from '../../../lib/language-detection';
import { AVAILABLE_LANGUAGES } from '../../../lib/constants';
import { createSession, endSession, saveTranslation } from '../../../lib/db';
import { supabase } from '../../../lib/supabase';
import { playTurnChime, playLanguageConfirmedChime, playSelectLanguageAudio, playMicOnChime, playLanguageSelectedChime } from '../../../lib/chime';
import SessionDisplay from '../welcome-screen/SessionDisplay';

function isNoiseMarker(text: string): boolean {
  const t = text.trim();
  return /^<noise>$/i.test(t) || /^\[noise\]$/i.test(t) || /^\(noise\)$/i.test(t) || t.length < 2;
}

function isEmptyOrEllipsis(text: string): boolean {
  const t = text.trim();
  return !t || /^[.…\s]+$/i.test(t);
}

/** Strip model commentary (headers, reasoning) and return only the translation. */
function stripTranslationCommentary(text: string): string {
  const t = text.trim();
  if (!t || t.length < 3) return t;
  if (!/\*\*|Translating|I've got it|I'm (now )?focusing|The goal is|my (task|current challenge)|After considering|Finding the right/i.test(t)) {
    return t;
  }
  const paragraphs = t.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const translationCandidates = paragraphs.filter(
    (p) =>
      p.length < 200 &&
      !/^(I've|I'm|The|My|After|Finding|So|Thus|Therefore)/i.test(p) &&
      !/\*\*/.test(p),
  );
  if (translationCandidates.length > 0) {
    return translationCandidates[translationCandidates.length - 1].trim();
  }
  const lastPara = paragraphs[paragraphs.length - 1];
  if (lastPara && lastPara.length < 300 && !/\*\*/.test(lastPara)) return lastPara.trim();
  let out = t.replace(/\*\*[^*]+\*\*/g, '').trim();
  const lines = out.split(/\n/).filter((l) => l.length < 150 && !/^(I've|I'm|The|My|After|Finding)/i.test(l));
  return (lines[lines.length - 1] ?? out).trim();
}

function extractLanguageFromConfirm(text: string): string | null {
  const m = text.match(/Confirm\s+for\s+(.+?)(?:\.|$)/i);
  if (!m) return null;
  const said = m[1].trim();
  for (const lang of AVAILABLE_LANGUAGES) {
    if (
      lang.name.toLowerCase() === said.toLowerCase() ||
      lang.value.toLowerCase() === said.toLowerCase() ||
      lang.name.toLowerCase().includes(said.toLowerCase()) ||
      lang.value.toLowerCase().includes(said.toLowerCase()) ||
      said.toLowerCase().includes(lang.name.toLowerCase()) ||
      said.toLowerCase().includes(lang.value.toLowerCase())
    ) {
      return lang.value;
    }
  }
  return null;
}

export default function StreamingConsole() {
  const { client, connectWithConfig, disconnect, connected, playTTS } = useLiveAPIContext();
  const { voice, topic } = useSettings();
  const session = useSessionStore();
  const { addHistoryItem } = useHistoryStore();

  const detectionBufferRef = useRef('');
  const aiOutputBufferRef = useRef('');
  const pendingLanguageRef = useRef<string | null>(null);
  const welcomeCompletedRef = useRef(false);
  const phaseRef = useRef(session.sessionPhase);
  phaseRef.current = session.sessionPhase;

  const guestLangRef = useRef(session.guestLanguage);
  guestLangRef.current = session.guestLanguage;

  const staffLangRef = useRef(session.staffLanguage);
  staffLangRef.current = session.staffLanguage;

  const prevSpeakerRef = useRef<'staff' | 'guest' | 'ai' | 'none'>('none');

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

  useEffect(() => {
    const action = session.pendingAction;
    if (!action) return;
    const locale = action === 'select-language' ? useSessionStore.getState().pendingSelectedLanguage : null;
    session.clearPendingAction();

    if (action === 'start') {
      detectionBufferRef.current = '';
      aiOutputBufferRef.current = '';
      welcomeCompletedRef.current = false;
      pendingLanguageRef.current = null;
      useSessionStore.getState().setPendingGuestLanguage(null);
      useLogStore.getState().clearTurns();
      session.setPhase('selecting-language');
      useUI.getState().setIntroComplete(true);
      useUI.getState().setIntroVolume(0);
      playSelectLanguageAudio();

      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          const sLang = useSessionStore.getState().staffLanguage;
          createSession(data.user.id, sLang).then((id) => {
            if (id) useUI.setState({ dbSessionId: id });
          });
        }
      });
    }

    if (action === 'select-language') {
      if (!locale) return;
      const sLang = useSessionStore.getState().staffLanguage;
      useSessionStore.getState().setGuestLanguage(locale, 1.0, 'manual-override');
      useUI.getState().setGuestLanguageJustConfirmed(true);
      useSessionStore.getState().setPhase('live');
      useLogStore.getState().clearTurns();
      useUI.getState().setAwaitingAiResponse(false);
      playLanguageSelectedChime();
      playMicOnChime();
      setTimeout(() => useUI.getState().setGuestLanguageJustConfirmed(false), 1500);
      const prompt = buildBidirectionalPrompt(locale, topic, sLang);
      connectWithConfig(buildConfig(prompt))
        .then(() => useSessionStore.getState().setPhase('live'))
        .catch(() => useSessionStore.getState().setError('Herverbinding mislukt'));
    }

    if (action === 'stop') {
      useUI.getState().setActiveSpeaker('none');
      useUI.getState().setAwaitingAiResponse(false);
      useUI.getState().setIntroComplete(false);
      useUI.getState().setIntroVolume(0);
      useUI.getState().setGuestLanguageJustConfirmed(false);
      pendingLanguageRef.current = null;
      useSessionStore.getState().setPendingGuestLanguage(null);

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
        pendingLanguageRef.current = null;
        welcomeCompletedRef.current = false;
        session.setPhase('prompting');
        const prompt = buildDetectionPrompt(sLang);
        disconnect();
        connectWithConfig(buildConfig(prompt)).catch(() =>
          session.setError('Herverbinding mislukt'),
        );
      }
    }
  }, [session.pendingAction, client, connectWithConfig, buildConfig, session, disconnect, topic]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const commitLanguage = (locale: string, confidence: number) => {
      if (useSessionStore.getState().guestLanguage) return;
      const sLang = staffLangRef.current;
      useSessionStore.getState().setGuestLanguage(locale, confidence, 'auto');
      useSessionStore.getState().setLastDetectedTranscript('');
      useUI.getState().setGuestLanguageJustConfirmed(true);
      playLanguageConfirmedChime();
      setTimeout(() => useUI.getState().setGuestLanguageJustConfirmed(false), 1500);
      // Lock phase to live immediately — stop detection, start translation
      useSessionStore.getState().setPhase('live');
      detectionBufferRef.current = '';
      aiOutputBufferRef.current = '';
      pendingLanguageRef.current = null;
      useLogStore.getState().clearTurns();
      useUI.getState().setAwaitingAiResponse(false);
      const prompt = buildBidirectionalPrompt(locale, topic, sLang);
      disconnect();
      connectWithConfig(buildConfig(prompt))
        .then(() => {
          useSessionStore.getState().setPhase('live');
        })
        .catch(() => {
          useSessionStore.getState().setError('Herverbinding mislukt');
        });
    };

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];

      const phase = phaseRef.current;
      const gLang = guestLangRef.current;

      if (!gLang && (phase === 'prompting' || phase === 'detecting')) {
        detectionBufferRef.current += ' ' + text;
        const trimmed = detectionBufferRef.current.trim();
        useSessionStore.getState().setLastDetectedTranscript(trimmed);

        if (!isFinal) return;

        const answer = trimmed.toLowerCase().trim();

        // User said "confirm" or "yes" → lock pending language
        if (/^(confirm|yes|ok|yeah|yep|oui|ja|si)$/.test(answer) && pendingLanguageRef.current) {
          commitLanguage(pendingLanguageRef.current, 1.0);
          pendingLanguageRef.current = null;
          return;
        }

        // User said a language name → store for confirmation, AI will say "Confirm for X"
        let matched: string | null = null;
        for (const lang of AVAILABLE_LANGUAGES) {
          const name = lang.name.toLowerCase();
          const value = lang.value.toLowerCase();
          if (
            answer === name ||
            answer === value ||
            answer.includes(name) ||
            answer.includes(value) ||
            name.includes(answer) ||
            value.includes(answer)
          ) {
            matched = lang.value;
            break;
          }
        }
        if (matched) {
          pendingLanguageRef.current = matched;
          useSessionStore.getState().setPendingGuestLanguage(matched);
        }
        return;
      }

      if (isNoiseMarker(text)) return;

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
        if (isNoiseMarker(text)) return;
        const separator = last.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ';
        updateLastTurn({ text: last.text + separator + text, isFinal });
      } else if (last && last.role === 'user' && last.isFinal && isFinal && text.trim().length >= 4) {
        const lastText = (last.text ?? '').trim();
        const newText = text.trim();
        if (newText === lastText || (newText.length > lastText.length && newText.startsWith(lastText.slice(0, 4)))) {
          updateLastTurn({ text: newText.length > lastText.length ? newText : lastText, isFinal: true });
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
          if (phase === 'live' && isFinal) useUI.getState().setAwaitingAiResponse(true);
        }
      } else if (!isFinal || text.trim().length >= 3) {
        addTurn({
          role: 'user',
          text,
          isFinal,
          speakerRole: speakerRole as 'staff' | 'guest',
          direction,
          sourceLanguage: direction === 'staff-to-guest' ? sLangCurrent : (gLang ?? undefined),
          targetLanguage: direction === 'staff-to-guest' ? (gLang ?? undefined) : sLangCurrent,
        });
        if (phase === 'live' && isFinal) useUI.getState().setAwaitingAiResponse(true);
      }
    };

    const handleOutputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];

      const phase = phaseRef.current;

      if (phase === 'detecting' && !guestLangRef.current) {
        if (!isNoiseMarker(text)) {
          aiOutputBufferRef.current += (aiOutputBufferRef.current ? ' ' : '') + text;
        }
        const extracted = extractLanguageFromConfirm(aiOutputBufferRef.current);
        if (extracted) {
          pendingLanguageRef.current = extracted;
          useSessionStore.getState().setPendingGuestLanguage(extracted);
        }
        if (isFinal) {
          const toSpeak = aiOutputBufferRef.current.trim();
          if (toSpeak) playTTS(toSpeak).catch(() => {});
          aiOutputBufferRef.current = '';
        }
      }

      if (phase === 'prompting' && !welcomeCompletedRef.current) {
        let fullText = '';
        if (last && last.role === 'system' && !last.isFinal) {
          const separator = last.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ';
          fullText = last.text + separator + text;
          updateLastTurn({ text: fullText, isFinal });
        } else {
          fullText = text;
          addTurn({ role: 'system', text, isFinal, speakerRole: 'system' });
        }
        if (isFinal && fullText.trim()) playTTS(fullText.trim()).catch(() => {});
        return;
      }

      if (isNoiseMarker(text)) return;

      let finalText = '';
      if (last && last.role === 'agent' && !last.isFinal) {
        const separator = last.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ';
        finalText = last.text + separator + text;
        if (phaseRef.current === 'live' && isFinal) {
          finalText = stripTranslationCommentary(finalText.trim());
        }
        if (!isEmptyOrEllipsis(finalText)) {
          updateLastTurn({ text: finalText, isFinal });
        }
      } else {
        finalText = text;
        if (phaseRef.current === 'live' && isFinal) {
          finalText = stripTranslationCommentary(finalText.trim());
        }
        if (isEmptyOrEllipsis(finalText) && phaseRef.current === 'live') return;
        const currentSession = useSessionStore.getState();
        const dir = currentSession.activeTurn;
        addTurn({
          role: 'agent',
          text: finalText,
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
          /* Skip chime when AI speaks - Live API audio plays translation, avoid double audio */
        }
      }
      if (phaseRef.current === 'live' && isFinal && finalText.trim() && !isEmptyOrEllipsis(finalText)) {
        playTTS(finalText.trim()).catch(() => {});
      }
    };

    const handleContent = (serverContent: LiveServerContent) => {
      let text =
        serverContent.modelTurn?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join(' ') ?? '';
      if (phaseRef.current === 'live' && text.includes('\n\n') && text.trim().length > 80) {
        const stripped = stripTranslationCommentary(text.trim());
        if (stripped && !isEmptyOrEllipsis(stripped)) text = stripped;
      }
      if (isNoiseMarker(text) || (phaseRef.current === 'live' && isEmptyOrEllipsis(text))) return;
      const groundingChunks = serverContent.groundingMetadata?.groundingChunks as any;
      const turns = useLogStore.getState().turns;
      const last = turns.at(-1);
      if (last?.role === 'agent') {
        const u: Partial<ConversationTurn> = {};
        if (groundingChunks?.length) {
          u.groundingChunks = [...(last.groundingChunks || []), ...groundingChunks];
        }
        const currentText = (last.text ?? '').trim();
        const newText = text.trim();
        if (newText && newText.length > currentText.length) {
          u.text = newText;
        }
        if (Object.keys(u).length) updateLastTurn(u);
      } else if (last?.role === 'user' && text && phaseRef.current === 'live') {
        const userText = (last.text ?? '').trim().toLowerCase();
        const modelText = text.trim().toLowerCase();
        const isLikelyEcho = userText.length > 3 && (modelText === userText || modelText.startsWith(userText.slice(0, 15)) || userText.startsWith(modelText.slice(0, 15)));
        if (isLikelyEcho) return;
        const currentSession = useSessionStore.getState();
        const dir = currentSession.activeTurn;
        addTurn({
          role: 'agent',
          text,
          isFinal: false,
          speakerRole: 'system',
          direction: dir,
          sourceLanguage: dir === 'staff-to-guest' ? currentSession.staffLanguage : (currentSession.guestLanguage ?? undefined),
          targetLanguage: dir === 'staff-to-guest' ? (currentSession.guestLanguage ?? undefined) : currentSession.staffLanguage,
        });
        const ui = useUI.getState();
        if (prevSpeakerRef.current !== 'ai') {
          prevSpeakerRef.current = 'ai';
          ui.setActiveSpeaker('ai');
          /* Skip chime when AI speaks - Live API audio plays translation, avoid double audio */
        }
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
        aiOutputBufferRef.current = '';
        useSessionStore.getState().setPhase('detecting');
        return;
      }

      const updatedTurns = useLogStore.getState().turns;
      const finalAgent = updatedTurns.at(-1);
      if (finalAgent?.role === 'agent' && finalAgent.text) {
        const translatedText = finalAgent.text.trim();
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
            translatedText,
            lang1: staffLangRef.current,
            lang2: gLang || 'Unknown',
          });

          const dbSid = useUI.getState().dbSessionId;
          if (dbSid) {
            saveTranslation(dbSid, speaker as 'staff' | 'guest', correspondingUser.text.trim(), translatedText);
          }
        }
      }

      // Turn has fully completed; no-one actively has the floor now.
      prevSpeakerRef.current = 'none';
      useUI.getState().setActiveSpeaker('none');
      useUI.getState().setAwaitingAiResponse(false);
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
  }, [client, addHistoryItem, topic, disconnect, connectWithConfig, buildConfig, playTTS]);

  return (
    <main className="center-stage">
      <SessionDisplay />
    </main>
  );
}

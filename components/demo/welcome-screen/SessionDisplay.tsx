import React, { useMemo, useRef, useEffect, useState } from 'react';
import cn from 'classnames';
import './SessionDisplay.css';
import { useSessionStore, useLogStore, useUI, ConversationTurn } from '../../../lib/state';
import { whichLanguage } from '../../../lib/language-detection';

function playChime() {
  const ctx = new AudioContext();
  const g = ctx.createGain();
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0.25, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(880, ctx.currentTime);
  o1.frequency.setValueAtTime(1318, ctx.currentTime + 0.12);
  o1.connect(g);
  o1.start(ctx.currentTime);
  o1.stop(ctx.currentTime + 0.5);
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(1318, ctx.currentTime + 0.15);
  o2.frequency.setValueAtTime(1760, ctx.currentTime + 0.27);
  const g2 = ctx.createGain();
  g2.connect(ctx.destination);
  g2.gain.setValueAtTime(0, ctx.currentTime);
  g2.gain.setValueAtTime(0.15, ctx.currentTime + 0.15);
  g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  o2.connect(g2);
  o2.start(ctx.currentTime + 0.15);
  o2.stop(ctx.currentTime + 0.55);
  setTimeout(() => ctx.close().catch(() => {}), 700);
}

interface ConvRecord {
  speaker: 'staff' | 'guest';
  staffLangText: string;
  guestLangText: string;
  isStreaming: boolean;
  key: number;
}

function isNoise(text: string): boolean {
  return text.replace(/[.\s,!?;:'"()\-–—…]/g, '').trim().length < 2;
}

function buildRecords(turns: ConversationTurn[], staffLang: string, guestLang: string | null): ConvRecord[] {
  const records: ConvRecord[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role !== 'user' || isNoise(t.text)) continue;

    let agent: ConversationTurn | undefined;
    for (let j = i + 1; j < turns.length; j++) {
      if (turns[j].role === 'agent') { agent = turns[j]; break; }
      if (turns[j].role === 'user') break;
    }
    if (!agent || !agent.text || isNoise(agent.text)) continue;

    const agentLang = guestLang ? whichLanguage(agent.text, staffLang, guestLang) : null;
    const agentIsStaffLang = agentLang === 'a';

    const speaker: 'staff' | 'guest' = agentIsStaffLang ? 'guest' : 'staff';

    records.push({
      speaker,
      staffLangText: agentIsStaffLang ? agent.text.trim() : t.text.trim(),
      guestLangText: agentIsStaffLang ? t.text.trim() : agent.text.trim(),
      isStreaming: !agent.isFinal,
      key: i,
    });
  }
  return records;
}

const NUM_ORB_BARS = 24;
const ORB_SEEDS = Array.from({ length: NUM_ORB_BARS }, () => ({
  phase: Math.random() * Math.PI * 2,
  freq: 1.2 + Math.random() * 2,
}));

const INTRO_TEXT = 'Dear Guest, please say a sentence so I can recognize your language. Thank you!';

const SessionDisplay: React.FC = () => {
  const session = useSessionStore();
  const turns = useLogStore((s) => s.turns);
  const micVolume = useUI((s) => s.micVolume);
  const introVolume = useUI((s) => s.introVolume);
  const ttsVolume = useUI((s) => s.ttsVolume);
  const introComplete = useUI((s) => s.introComplete);

  const orbVolume = Math.max(introVolume, ttsVolume);

  const isIdle = session.sessionPhase === 'idle';
  const isError = session.sessionPhase === 'error';
  const isActive = !isIdle && !isError;
  const isDetecting = session.sessionPhase === 'detecting';

  const records = useMemo(
    () => buildRecords(turns, session.staffLanguage, session.guestLanguage),
    [turns, session.staffLanguage, session.guestLanguage],
  );
  const hasConversation = isActive && records.length > 0;
  const showIntroText = isActive && !hasConversation && isDetecting && !introComplete;

  const staffScrollRef = useRef<HTMLDivElement>(null);
  const guestScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    staffScrollRef.current?.scrollTo({ top: staffScrollRef.current.scrollHeight, behavior: 'smooth' });
    guestScrollRef.current?.scrollTo({ top: guestScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [records.length]);

  const [typedLen, setTypedLen] = useState(0);
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!showIntroText) { setTypedLen(0); if (typeTimerRef.current) clearTimeout(typeTimerRef.current); return; }
    if (typedLen >= INTRO_TEXT.length) return;
    typeTimerRef.current = setTimeout(() => setTypedLen((l) => l + 1), 35);
    return () => { if (typeTimerRef.current) clearTimeout(typeTimerRef.current); };
  }, [showIntroText, typedLen]);

  const orbBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  const handleOrbClick = () => {
    if (isActive) session.requestStop();
    else { playChime(); session.requestStart(); }
  };

  useEffect(() => {
    let prev = performance.now();
    const animate = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      timeRef.current += dt;
      const t = timeRef.current;
      const ui = useUI.getState();
      const vol = Math.max(ui.introVolume, ui.ttsVolume);
      const active = session.sessionPhase !== 'idle' && session.sessionPhase !== 'error';

      for (let i = 0; i < NUM_ORB_BARS; i++) {
        const el = orbBarsRef.current[i];
        if (!el) continue;
        const s = ORB_SEEDS[i];
        const intensity = 1 - Math.abs(NUM_ORB_BARS / 2 - i) / (NUM_ORB_BARS / 2);
        if (active && vol > 0.01) {
          const w = Math.sin(t * s.freq * 10 + s.phase + vol * 7) * 0.5 + 0.5;
          el.style.height = `${4 + vol * intensity * 45 * w}px`;
          el.style.opacity = `${0.5 + vol * 0.5}`;
        } else if (active) {
          el.style.height = `${Math.max(3, 4 + Math.sin(t * 1.2 + s.phase) * 4 * intensity)}px`;
          el.style.opacity = '0.3';
        } else {
          el.style.height = '3px';
          el.style.opacity = '0.15';
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [session.sessionPhase]);

  const orbGlow = isActive && orbVolume > 0.01
    ? `0 0 ${50 + orbVolume * 50}px ${10 + orbVolume * 25}px rgba(0,110,255,${0.5 + orbVolume * 0.4}),
       inset 0 0 ${20 + orbVolume * 20}px rgba(0,150,255,${0.6 + orbVolume * 0.3}),
       inset 0 -${20 + orbVolume * 15}px ${25 + orbVolume * 20}px rgba(0,212,255,${0.8 + orbVolume * 0.2})`
    : undefined;

  return (
    <div className={cn('center-stage-content', { 'has-conversation': hasConversation })}>
      {/* Orb — center idle, mini header once intro done or conversation active */}
      <div className={cn('orb-wrapper', { mini: isActive && (hasConversation || introComplete) })}>
        <div className={cn('orb-container', { error: isError })} onClick={handleOrbClick}
          style={orbGlow ? { boxShadow: orbGlow } : undefined}>
          <div className="orb-grid" />
          <div className="orb-stars" />
          <div className="orb-visualizer">
            {Array.from({ length: NUM_ORB_BARS }, (_, i) => (
              <div key={i} ref={(el) => { orbBarsRef.current[i] = el; }} className="orb-vis-bar" />
            ))}
          </div>
          <div className="orb-reflection" />
          <span className="orb-text">{isIdle ? 'Start' : ''}</span>
        </div>
        <div className="orb-base-glow" />
      </div>

      {showIntroText && typedLen > 0 && (
        <p className="intro-typewriter">
          {INTRO_TEXT.slice(0, typedLen)}<span className="tw-cursor" />
        </p>
      )}

      {/* Two-panel conversation — every record renders on BOTH sides */}
      {hasConversation && (
        <div className="conversation-area">
          <div className="conversation-side staff-side">
            <div className="conv-scroll" ref={staffScrollRef}>
              {records.map((r) => (
                <div className={cn('conv-card', r.speaker === 'staff' ? 'own-card' : 'other-card')} key={r.key}>
                  <p className="conv-text">
                    <strong className="conv-tag">{r.speaker === 'staff' ? 'Staff:' : 'Guest:'}</strong> {r.staffLangText}
                  </p>
                  <p className="conv-trans">
                    <span className="conv-trans-label">↳</span> {r.guestLangText}
                    {r.isStreaming && <span className="transcript-cursor" />}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="conversation-divider" />

          <div className="conversation-side guest-side">
            <div className="conv-scroll" ref={guestScrollRef}>
              {records.map((r) => (
                <div className={cn('conv-card', r.speaker === 'guest' ? 'own-card' : 'other-card')} key={r.key}>
                  <p className="conv-text">
                    <strong className="conv-tag">{r.speaker === 'staff' ? 'Staff:' : 'Guest:'}</strong> {r.guestLangText}
                  </p>
                  <p className="conv-trans">
                    <span className="conv-trans-label">↳</span> {r.staffLangText}
                    {r.isStreaming && <span className="transcript-cursor" />}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionDisplay;

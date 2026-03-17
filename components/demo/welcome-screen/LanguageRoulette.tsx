import React, { useRef, useEffect, useCallback } from 'react';
import { useSessionStore } from '../../../lib/state';
import { AVAILABLE_LANGUAGES, STAFF_LANGUAGE } from '../../../lib/constants';
import './LanguageRoulette.css';

const ROULETTE_LANGUAGES = AVAILABLE_LANGUAGES.filter(
  (l) => l.value !== STAFF_LANGUAGE,
);

function playRouletteTick() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.03);
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
    setTimeout(() => ctx.close().catch(() => {}), 100);
  } catch {
    // ignore
  }
}

export default function LanguageRoulette() {
  const listRef = useRef<HTMLUListElement>(null);
  const lastSelectedRef = useRef<number>(-1);
  const requestSelectLanguage = useSessionStore((s) => s.requestSelectLanguage);

  const updateSelection = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll('.roulette-item');
    const containerRect = list.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;
    let closestIndex = -1;
    let minDistance = Infinity;
    items.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const d = Math.abs(containerCenter - center);
      if (d < minDistance) {
        minDistance = d;
        closestIndex = index;
      }
    });
    if (closestIndex !== lastSelectedRef.current && closestIndex >= 0) {
      items.forEach((el) => el.classList.remove('selected'));
      items[closestIndex]?.classList.add('selected');
      if (lastSelectedRef.current >= 0) playRouletteTick();
      lastSelectedRef.current = closestIndex;
    }
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const center = list.scrollHeight / 2 - list.clientHeight / 2;
    list.scrollTop = Math.max(0, center - 80);
    requestAnimationFrame(() => updateSelection());
  }, [updateSelection]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => requestAnimationFrame(updateSelection);
    list.addEventListener('scroll', onScroll);
    return () => list.removeEventListener('scroll', onScroll);
  }, [updateSelection]);

  const handleItemClick = useCallback(
    (value: string) => {
      const list = listRef.current;
      if (!list) return;
      const items = list.querySelectorAll('.roulette-item');
      const idx = ROULETTE_LANGUAGES.findIndex((l) => l.value === value);
      if (idx >= 0 && items[idx]) {
        items[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [],
  );

  const handleCheckClick = useCallback(
    (e: React.MouseEvent, value: string) => {
      e.stopPropagation();
      requestSelectLanguage(value);
    },
    [requestSelectLanguage],
  );

  return (
    <div className="roulette-container">
      <div className="roulette-highlight" />
      <ul className="roulette-list" ref={listRef}>
        {ROULETTE_LANGUAGES.map((lang) => (
          <li
            key={lang.value}
            className="roulette-item"
            onClick={() => handleItemClick(lang.value)}
          >
            <span className="roulette-select-label">Select</span>
            <span className="roulette-lang-name">{lang.name}</span>
            <button
              type="button"
              className="roulette-check-btn"
              onClick={(e) => handleCheckClick(e, lang.value)}
              aria-label={`Confirm ${lang.name}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useSessionStore, useUI } from '../lib/state';
import { AVAILABLE_LANGUAGES } from '../lib/constants';
import cn from 'classnames';

export default function Header() {
  const staffLanguage = useSessionStore((s) => s.staffLanguage);
  const guestLanguage = useSessionStore((s) => s.guestLanguage);
  const sessionPhase = useSessionStore((s) => s.sessionPhase);
  const introVolume = useUI((s) => s.introVolume);
  const micVolume = useUI((s) => s.micVolume);
  const isIdle = sessionPhase === 'idle';
  const isActive = sessionPhase !== 'idle' && sessionPhase !== 'error';

  const langName = (value: string) => {
    const lang = AVAILABLE_LANGUAGES.find((l) => l.value === value);
    return lang?.name || value;
  };

  const orbVolume = isActive ? Math.max(introVolume, micVolume) : 0;

  const handleStart = () => {
    if (isIdle) {
      useSessionStore.getState().requestStart();
    }
  };

  return (
    <header className="top-bar">
      <div className="user-panel">
        <div className="user-info">
          <div className="avatar-box">🇧🇪</div>
          <span className="user-name">The Staff</span>
        </div>
        <div className="lang-chip">{langName(staffLanguage)}</div>
      </div>

      {/* Start button in header when idle */}
      {isIdle ? (
        <button className="header-start-btn" onClick={handleStart}>
          Start
        </button>
      ) : (
        /* Mini orb in header when active */
        <div className="header-orb" style={{
          boxShadow: orbVolume > 0.01
            ? `0 0 ${20 + orbVolume * 30}px ${8 + orbVolume * 15}px rgba(255,68,68,${0.4 + orbVolume * 0.4})`
            : undefined
        }}>
          <div className="header-orb-visualizer">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="header-orb-bar"
                style={{
                  height: `${Math.max(3, (orbVolume > 0.01 ? orbVolume : 0.05) * 15 * (0.5 + Math.random() * 0.5))}px`,
                  background: '#ff4444',
                  boxShadow: '0 0 4px rgba(255,68,68,0.6)'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="user-panel">
        <div className="user-info">
          <div className="avatar-box">🌐</div>
          <span className="user-name">Guest</span>
        </div>
        <div className="lang-chip">{guestLanguage ? langName(guestLanguage) : '—'}</div>
      </div>
    </header>
  );
}

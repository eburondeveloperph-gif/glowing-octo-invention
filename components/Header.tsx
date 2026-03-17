import { useSessionStore } from '../lib/state';
import { AVAILABLE_LANGUAGES } from '../lib/constants';

export default function Header() {
  const staffLanguage = useSessionStore((s) => s.staffLanguage);
  const guestLanguage = useSessionStore((s) => s.guestLanguage);

  const langName = (value: string) => {
    const lang = AVAILABLE_LANGUAGES.find((l) => l.value === value);
    return lang?.name || value;
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

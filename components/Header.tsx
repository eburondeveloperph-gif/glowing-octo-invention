import cn from 'classnames';
import { useSessionStore, useUI } from '../lib/state';
import { AVAILABLE_LANGUAGES } from '../lib/constants';

export default function Header() {
  const staffLanguage = useSessionStore((s) => s.staffLanguage);
  const guestLanguage = useSessionStore((s) => s.guestLanguage);
  const pendingGuestLanguage = useSessionStore((s) => s.pendingGuestLanguage);
  const sessionPhase = useSessionStore((s) => s.sessionPhase);
  const guestLanguageJustConfirmed = useUI((s) => s.guestLanguageJustConfirmed);

  const langName = (value: string) => {
    const lang = AVAILABLE_LANGUAGES.find((l) => l.value === value);
    return lang?.name || value;
  };

  const languageDetecting =
    (sessionPhase === 'prompting' || sessionPhase === 'detecting') && !guestLanguage;
  const isSelectingLanguage = sessionPhase === 'selecting-language' && !guestLanguage;

  const guestLangDisplay = guestLanguage
    ? langName(guestLanguage)
    : pendingGuestLanguage
      ? `${langName(pendingGuestLanguage)} (say yes to confirm)`
      : null;

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
        <div
          className={cn('lang-chip', {
            confirmed: guestLanguage && guestLanguageJustConfirmed,
            detecting: languageDetecting,
          })}
          title={
            guestLanguage
              ? `Guest language: ${langName(guestLanguage)}`
              : pendingGuestLanguage
                ? `Detected: ${langName(pendingGuestLanguage)} — say yes to confirm`
                : undefined
          }
        >
          {languageDetecting ? (
            pendingGuestLanguage ? (
              <span className="lang-chip-pending">{guestLangDisplay}</span>
            ) : (
              <span className="lang-chip-loading">
                <span className="lang-chip-spinner" aria-hidden />
                Detecting…
              </span>
            )
          ) : isSelectingLanguage ? (
            <span className="lang-chip-loading">Select language…</span>
          ) : guestLangDisplay ? (
            guestLangDisplay
          ) : (
            '—'
          )}
        </div>
      </div>
    </header>
  );
}

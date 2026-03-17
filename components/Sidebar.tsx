import { useSessionStore, useSettings, useUI } from '../lib/state';
import c from 'classnames';
import { AVAILABLE_VOICES, AVAILABLE_LANGUAGES } from '../lib/constants';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useHistoryStore } from '../lib/history';

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { voice, topic, setVoice, setTopic } = useSettings();
  const session = useSessionStore();
  const { connected } = useLiveAPIContext();
  const { history, clearHistory } = useHistoryStore();

  const handleManualOverride = (lang: string) => {
    if (lang) {
      session.requestLanguageOverride(lang);
      toggleSidebar();
    }
  };

  return (
    <aside className={c('sidebar', { open: isSidebarOpen })}>
      <div className="sidebar-header">
        <h3>Instellingen & Diagnose</h3>
        <button onClick={toggleSidebar} className="close-button">
          <span className="icon">close</span>
        </button>
      </div>
      <div className="sidebar-content">
        {/* Session diagnostics */}
        <div className="sidebar-section">
          <h4 className="sidebar-section-title">Sessie</h4>
          <div className="diagnostics-grid">
            <div className="diag-row">
              <span className="diag-label">Status</span>
              <span className={c('diag-value', `phase-${session.sessionPhase}`)}>
                {session.sessionPhase}
              </span>
            </div>
            <div className="diag-row">
              <span className="diag-label">Medewerker taal</span>
              <span className="diag-value">{session.staffLanguage}</span>
            </div>
            <div className="diag-row">
              <span className="diag-label">Gast taal</span>
              <span className="diag-value">
                {session.guestLanguage ?? '—'}
                {session.guestLanguageSource === 'auto' && ' (auto)'}
                {session.guestLanguageSource === 'manual-override' && ' (handmatig)'}
              </span>
            </div>
            {session.detectionConfidence != null && (
              <div className="diag-row">
                <span className="diag-label">Betrouwbaarheid</span>
                <span className="diag-value">
                  {(session.detectionConfidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {session.lastDetectedTranscript && (
              <div className="diag-row">
                <span className="diag-label">Detectie sample</span>
                <span className="diag-value diag-transcript">
                  {session.lastDetectedTranscript.slice(0, 80)}
                  {(session.lastDetectedTranscript.length > 80) && '...'}
                </span>
              </div>
            )}
            {session.errorMessage && (
              <div className="diag-row">
                <span className="diag-label">Fout</span>
                <span className="diag-value diag-error">{session.errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Manual language override */}
        <div className="sidebar-section">
          <h4 className="sidebar-section-title">Taal handmatig instellen</h4>
          <select
            defaultValue=""
            onChange={(e) => handleManualOverride(e.target.value)}
            disabled={session.sessionPhase === 'idle' || !!session.guestLanguage}
            title="Taal handmatig selecteren"
            aria-label="Taal handmatig selecteren"
          >
            <option value="" disabled>Selecteer taal...</option>
            {AVAILABLE_LANGUAGES.filter(
              (l) => l.value !== session.staffLanguage,
            ).map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Staff language */}
        <div className="sidebar-section">
          <h4 className="sidebar-section-title">Medewerker taal</h4>
          <select
            value={session.staffLanguage}
            onChange={(e) => session.setStaffLanguage(e.target.value)}
            disabled={session.sessionPhase !== 'idle'}
            aria-label="Medewerker taal selecteren"
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Voice & topic settings */}
        <div className="sidebar-section">
          <h4 className="sidebar-section-title">Steminstelling</h4>
          <fieldset disabled={connected}>
            <label>
              Stem
              <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                {AVAILABLE_VOICES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Onderwerp (optioneel)
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                placeholder="bijv. Medicijnverstrekking, receptbespreking..."
              />
            </label>
          </fieldset>
        </div>

        {/* Translation history */}
        <div className="sidebar-section history-section">
          <div className="sidebar-section-title-wrapper">
            <h4 className="sidebar-section-title">Vertaalgeschiedenis</h4>
            <button
              onClick={clearHistory}
              className="clear-history-button"
              disabled={history.length === 0}
            >
              <span className="icon">delete_sweep</span> Wissen
            </button>
          </div>
          <div className="history-list">
            {history.length > 0 ? (
              history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-item-source">
                    <strong>Bron:</strong> {item.sourceText}
                  </div>
                  <div className="history-item-translation">
                    <strong>Vertaling:</strong> {item.translatedText}
                  </div>
                </div>
              ))
            ) : (
              <p className="history-empty-placeholder">
                Nog geen geschiedenis. Begin een vertaling om het hier te zien.
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

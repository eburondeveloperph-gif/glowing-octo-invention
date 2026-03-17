import { useUI } from '../lib/state';
import { useAuth } from '../hooks/use-auth';
import c from 'classnames';
import { useState } from 'react';

export default function ProfileSidebar() {
  const { isProfileOpen, toggleProfile } = useUI();
  const { user, profile, loading, signUp, signIn, signOut, updateProfile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async () => {
    setAuthError('');
    setAuthLoading(true);
    const err = isRegister ? await signUp(email, password) : await signIn(email, password);
    setAuthLoading(false);
    if (err) setAuthError(err.message);
    else { setEmail(''); setPassword(''); }
  };

  const handleProfileChange = (field: string, value: string) => {
    updateProfile({ [field]: value });
  };

  return (
    <aside className={c('sidebar profile-sidebar', { open: isProfileOpen })}>
      <div className="sidebar-header">
        <h3>Staff Profile</h3>
        <button onClick={toggleProfile} className="close-button">
          <span className="icon">close</span>
        </button>
      </div>
      <div className="sidebar-content">
        {loading ? (
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>Loading...</p>
        ) : !user ? (
          /* Auth form */
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">{isRegister ? 'Create Account' : 'Sign In'}</h4>
            <label className="profile-field">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pharmacy.com"
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              />
            </label>
            <label className="profile-field">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              />
            </label>
            {authError && <p className="auth-error">{authError}</p>}
            <button className="auth-btn primary" onClick={handleAuth} disabled={authLoading}>
              {authLoading ? '...' : isRegister ? 'Register' : 'Sign In'}
            </button>
            <button className="auth-btn secondary" onClick={() => { setIsRegister(!isRegister); setAuthError(''); }}>
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        ) : (
          /* Logged-in profile */
          <>
            <div className="profile-avatar-section">
              <div className="profile-avatar">
                <svg viewBox="0 0 24 24" width="48" height="48">
                  <path fill="rgba(255,255,255,0.5)" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <p className="profile-label">{profile?.name || user.email}</p>
              <p className="profile-email">{user.email}</p>
            </div>

            <div className="sidebar-section">
              <h4 className="sidebar-section-title">Personal Information</h4>
              <label className="profile-field">
                Name
                <input
                  type="text"
                  value={profile?.name || ''}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  placeholder="Enter your name..."
                />
              </label>
              <label className="profile-field">
                Role
                <input
                  type="text"
                  value={profile?.role || ''}
                  onChange={(e) => handleProfileChange('role', e.target.value)}
                  placeholder="e.g. Pharmacist, Assistant..."
                />
              </label>
              <label className="profile-field">
                Staff ID
                <input
                  type="text"
                  value={profile?.staff_id || ''}
                  onChange={(e) => handleProfileChange('staff_id', e.target.value)}
                  placeholder="Employee number..."
                />
              </label>
            </div>

            <div className="sidebar-section">
              <h4 className="sidebar-section-title">Workplace</h4>
              <label className="profile-field">
                Pharmacy / Location
                <input
                  type="text"
                  value={profile?.pharmacy || ''}
                  onChange={(e) => handleProfileChange('pharmacy', e.target.value)}
                  placeholder="e.g. Apotheek Centrum..."
                />
              </label>
            </div>

            <div className="sidebar-section">
              <button className="auth-btn secondary signout" onClick={signOut}>
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

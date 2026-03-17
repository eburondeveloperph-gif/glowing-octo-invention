import cn from 'classnames';
import ControlTray from './components/console/control-tray/ControlTray';
import ErrorScreen from './components/demo/ErrorScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ProfileSidebar from './components/ProfileSidebar';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import { useSessionStore } from './lib/state';

const API_KEY = process.env.GEMINI_API_KEY as string;
if (typeof API_KEY !== 'string' || !API_KEY) {
  throw new Error('Missing required environment variable: GEMINI_API_KEY');
}

export default function App() {
  const phase = useSessionStore((s) => s.sessionPhase);
  const isActive = phase !== 'idle' && phase !== 'error';

  return (
    <div className={cn('App', { active: isActive })}>
      <LiveAPIProvider apiKey={API_KEY}>
        <ErrorScreen />
        <Header />
        <StreamingConsole />
        <ControlTray />
        <Sidebar />
        <ProfileSidebar />
      </LiveAPIProvider>
    </div>
  );
}

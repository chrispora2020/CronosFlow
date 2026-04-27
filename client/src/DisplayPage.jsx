import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TimerText } from './components/TimerText';
import { useRoomId } from './hooks/useRoomId';
import { socket } from './socket';

const defaultConfig = {
  showName: true,
  showTimer: true,
  namePosition: 'top',
  timerSize: 'lg',
  nameSize: 'md',
  alertEffect: 'pulse',
  bgColor: 'black',
  timerColorMode: 'auto'
};

const bgColorClass = {
  black:  'bg-black',
  slate:  'bg-slate-950',
  indigo: 'bg-indigo-950'
};

// Each value includes both the animation and a base bg so they work standalone
const alertEffectClass = {
  pulse: 'animate-pulse bg-red-950',
  flash: 'animate-alert-flash bg-red-950',
  shake: 'animate-alert-shake bg-red-950',
  glow:  'animate-alert-glow  bg-red-950'
};

const timerSizeClass = {
  sm: 'text-6xl leading-none sm:text-7xl',
  md: 'text-7xl leading-none sm:text-8xl md:text-9xl',
  lg: 'text-8xl leading-none sm:text-9xl md:text-[12rem]',
  xl: 'text-9xl leading-none sm:text-[10rem] md:text-[16rem]'
};

const nameSizeClass = {
  sm: 'text-xl leading-tight sm:text-2xl md:text-3xl',
  md: 'text-3xl leading-tight sm:text-5xl md:text-7xl',
  lg: 'text-5xl leading-tight sm:text-7xl md:text-9xl'
};

export default function DisplayPage() {
  const fixedRoomId = useRoomId();
  const [searchParams] = useSearchParams();
  const followMode = searchParams.get('follow') === '1';

  const [activeRoom, setActiveRoom] = useState(followMode ? null : fixedRoomId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const [state, setState] = useState({
    speakers: [],
    currentSpeaker: null,
    timeRemaining: 0,
    isRunning: false,
    displayConfig: defaultConfig
  });

  // Track fullscreen changes
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Keep screen awake on mobile/tablet when supported
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let wakeLockSentinel = null;

    const requestWakeLock = async () => {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        setWakeLockEnabled(true);

        wakeLockSentinel.addEventListener('release', () => {
          setWakeLockEnabled(false);
        });
      } catch {
        setWakeLockEnabled(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLockSentinel) {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockSentinel?.release();
      wakeLockSentinel = null;
      setWakeLockEnabled(false);
    };
  }, []);

  // Follow mode: track which room the admin is on
  useEffect(() => {
    if (!followMode) return;
    socket.emit('get_global_active_room');
    const onGlobalChanged = ({ roomId }) => setActiveRoom(roomId);
    const onConnect = () => socket.emit('get_global_active_room');
    socket.on('global_room_changed', onGlobalChanged);
    socket.on('connect', onConnect);
    return () => {
      socket.off('global_room_changed', onGlobalChanged);
      socket.off('connect', onConnect);
    };
  }, [followMode]);

  // Join the active room and sync state
  useEffect(() => {
    if (!activeRoom) return;
    socket.emit('join_room', { roomId: activeRoom });
    const onSync = (nextState) => setState(nextState);
    const onConnect = () => socket.emit('join_room', { roomId: activeRoom });
    socket.on('sync_state', onSync);
    socket.on('connect', onConnect);
    return () => {
      socket.off('sync_state', onSync);
      socket.off('connect', onConnect);
    };
  }, [activeRoom]);

  const cfg = state.displayConfig ?? defaultConfig;
  const currentSpeakerDuration = state.currentSpeaker?.durationSeconds || 0;
  const ratio = currentSpeakerDuration > 0 ? state.timeRemaining / currentSpeakerDuration : 0;

  const colorClass = useMemo(() => {
    const mode = cfg.timerColorMode ?? 'auto';
    if (mode !== 'auto') {
      return { white: 'text-white', cyan: 'text-cyan-400', amber: 'text-amber-400' }[mode] ?? 'text-green-400';
    }
    if (state.timeRemaining <= 30) return 'text-red-400';
    if (ratio < 0.5) return 'text-yellow-300';
    return 'text-green-400';
  }, [ratio, state.timeRemaining, cfg.timerColorMode]);

  const timeUp = state.timeRemaining === 0 && !!state.currentSpeaker;
  const timerColor = timeUp ? 'text-red-400' : colorClass;
  const sizeClass = timerSizeClass[cfg.timerSize] ?? timerSizeClass.lg;
  // When displaying text (not digits) use vmin so the label scales down
  // automatically in landscape without overflowing the viewport.
  const timeUpSizeClass = 'text-[clamp(1.5rem,8vmin,10rem)] leading-tight';

  // Alternates between name and "TIEMPO FINALIZADO" when time is up
  const [showNameFlash, setShowNameFlash] = useState(true);
  useEffect(() => {
    if (!timeUp) { setShowNameFlash(true); return; }
    const id = setInterval(() => setShowNameFlash((v) => !v), 1500);
    return () => clearInterval(id);
  }, [timeUp]);

  const nameEl = cfg.showName && !timeUp && (
    <h1 className={`w-full max-w-[90vw] break-words px-2 font-black ${nameSizeClass[cfg.nameSize ?? 'md']}`}>
      {state.currentSpeaker?.name || 'Esperando inicio'}
    </h1>
  );

  // When time is up: timer slot alternates between "TIEMPO FINALIZADO" and the speaker name
  const timerEl = cfg.showTimer && (
    <div className={`w-full max-w-[90vw] break-words text-center font-black tabular-nums ${timeUp ? timeUpSizeClass : sizeClass} ${timerColor}`}>
      {timeUp
        ? (showNameFlash
            ? 'TIEMPO FINALIZADO'
            : (cfg.showName ? state.currentSpeaker?.name : 'TIEMPO FINALIZADO'))
        : <TimerText totalSeconds={state.timeRemaining} />
      }
    </div>
  );

  return (
    <main className={`flex min-h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden p-4 text-center transition-colors duration-500 ${
      timeUp
        ? (alertEffectClass[cfg.alertEffect ?? 'pulse'] ?? alertEffectClass.pulse)
        : (bgColorClass[cfg.bgColor ?? 'black'] ?? 'bg-black')
    }`}>
      {!isFullscreen && (
        <p className="rounded-full border border-slate-700 px-4 py-1 text-sm text-slate-400">
          {followMode ? `📡 Libre · ${activeRoom || '...'}` : `Sala: ${activeRoom}`}
        </p>
      )}
      {!isFullscreen && wakeLockEnabled && (
        <p className="rounded-full border border-emerald-700 px-4 py-1 text-sm text-emerald-300">
          🔋 Pantalla activa (anti-bloqueo)
        </p>
      )}

      {cfg.namePosition === 'top'
        ? <>{nameEl}{timerEl}</>
        : <>{timerEl}{nameEl}</>}

      {!isFullscreen && (
        <button
          className="mt-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400"
          onClick={() => document.documentElement.requestFullscreen?.()}
        >
          Pantalla completa
        </button>
      )}
    </main>
  );
}

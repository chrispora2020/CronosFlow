import { useEffect, useMemo, useState } from 'react';
import { TimerText } from './components/TimerText';
import { useRoomId } from './hooks/useRoomId';
import { socket } from './socket';

const defaultConfig = {
  showName: true,
  showTimer: true,
  namePosition: 'top',
  timerSize: 'lg'
};

const timerSizeClass = {
  sm: 'text-6xl leading-none sm:text-7xl',
  md: 'text-7xl leading-none sm:text-8xl md:text-9xl',
  lg: 'text-8xl leading-none sm:text-9xl md:text-[12rem]'
};

export default function DisplayPage() {
  const roomId = useRoomId();
  const [state, setState] = useState({
    speakers: [],
    currentSpeaker: null,
    timeRemaining: 0,
    isRunning: false,
    displayConfig: defaultConfig
  });

  useEffect(() => {
    socket.emit('join_room', { roomId });
    const onSync = (nextState) => setState(nextState);
    socket.on('sync_state', onSync);
    return () => socket.off('sync_state', onSync);
  }, [roomId]);

  const cfg = state.displayConfig ?? defaultConfig;
  const currentSpeakerDuration = state.currentSpeaker?.durationSeconds || 0;
  const ratio = currentSpeakerDuration > 0 ? state.timeRemaining / currentSpeakerDuration : 0;

  const colorClass = useMemo(() => {
    if (state.timeRemaining <= 30) return 'text-red-400';
    if (ratio < 0.5) return 'text-yellow-300';
    return 'text-green-400';
  }, [ratio, state.timeRemaining]);

  const timeUp = state.timeRemaining === 0 && !!state.currentSpeaker;
  const timerColor = timeUp ? 'text-red-400' : colorClass;
  const sizeClass = timerSizeClass[cfg.timerSize] ?? timerSizeClass.lg;

  const nameEl = cfg.showName && (
    <h1 className="w-full max-w-[90vw] break-words px-2 text-3xl font-black leading-tight sm:text-5xl md:text-7xl">
      {state.currentSpeaker?.name || 'Esperando inicio'}
    </h1>
  );

  const timerEl = cfg.showTimer && (
    <div className={`font-black tabular-nums ${sizeClass} ${timerColor}`}>
      <TimerText totalSeconds={state.timeRemaining} />
    </div>
  );

  return (
    <main className={`flex min-h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden p-4 text-center transition-colors duration-500 ${
      timeUp ? 'animate-pulse bg-red-950' : 'bg-black'
    }`}>
      <p className="rounded-full border border-slate-700 px-4 py-1 text-sm text-slate-400">
        Sala: {roomId}
      </p>

      {cfg.namePosition === 'top' ? <>{nameEl}{timerEl}</> : <>{timerEl}{nameEl}</>}

      {timeUp && (
        <div className="rounded-xl bg-red-500/30 px-6 py-3 text-2xl font-black text-red-300 sm:text-4xl md:text-6xl">
          TIEMPO FINALIZADO
        </div>
      )}

      <button
        className="mt-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400"
        onClick={() => document.documentElement.requestFullscreen?.()}
      >
        Pantalla completa
      </button>
    </main>
  );
}


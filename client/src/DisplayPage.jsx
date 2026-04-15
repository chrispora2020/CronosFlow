import { useEffect, useMemo, useState } from 'react';
import { TimerText } from './components/TimerText';
import { useRoomId } from './hooks/useRoomId';
import { socket } from './socket';

const defaultState = {
  speakers: [],
  currentSpeaker: null,
  timeRemaining: 0,
  isRunning: false
};

export default function DisplayPage() {
  const roomId = useRoomId();
  const [state, setState] = useState(defaultState);

  useEffect(() => {
    socket.emit('join_room', { roomId });
    const onSync = (nextState) => setState(nextState);
    socket.on('sync_state', onSync);
    return () => socket.off('sync_state', onSync);
  }, [roomId]);

  const currentSpeakerDuration = state.currentSpeaker?.durationSeconds || 0;
  const ratio = currentSpeakerDuration > 0 ? state.timeRemaining / currentSpeakerDuration : 0;

  const colorClass = useMemo(() => {
    if (state.timeRemaining <= 30) return 'text-red-400';
    if (ratio < 0.5) return 'text-yellow-300';
    return 'text-green-400';
  }, [ratio, state.timeRemaining]);

  const timeUp = state.timeRemaining === 0 && !!state.currentSpeaker;

  return (
    <main className={`flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center transition-colors duration-500 ${
      timeUp ? 'bg-red-950 animate-pulse' : 'bg-black'
    }`}>
      <p className="rounded-full border border-slate-700 px-5 py-2 text-slate-300">Sala: {roomId}</p>
      <h1 className="text-5xl font-black md:text-8xl">{state.currentSpeaker?.name || 'Esperando inicio'}</h1>
      <div className={`text-7xl font-black md:text-[12rem] ${timeUp ? 'text-red-400' : colorClass}`}>
        <TimerText totalSeconds={state.timeRemaining} />
      </div>
      {timeUp && (
        <div className="rounded-xl bg-red-500/30 px-8 py-4 text-4xl font-black text-red-300 md:text-6xl">
          TIEMPO FINALIZADO
        </div>
      )}
      <button
        className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200"
        onClick={() => document.documentElement.requestFullscreen?.()}
      >
        Pantalla completa
      </button>
    </main>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { socket } from './socket';
import { TimerText } from './components/TimerText';
import { ProgressBar } from './components/ProgressBar';
import { useRoomId } from './hooks/useRoomId';

const defaultState = {
  speakers: [],
  currentSpeakerIndex: 0,
  timeRemaining: 0,
  isRunning: false,
  progress: 0,
  totalDuration: 0,
  currentSpeaker: null,
  autoAdvance: true
};

export default function AdminPage() {
  const roomId = useRoomId();
  const [state, setState] = useState(defaultState);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('3');
  const [seconds, setSeconds] = useState('0');

  useEffect(() => {
    socket.emit('join_room', { roomId });
    const onSync = (nextState) => setState(nextState);
    socket.on('sync_state', onSync);

    return () => {
      socket.off('sync_state', onSync);
    };
  }, [roomId]);

  const addSpeaker = () => {
    const totalSeconds = Number(minutes || 0) * 60 + Number(seconds || 0);
    if (!name.trim() || totalSeconds <= 0) return;

    const updated = [
      ...state.speakers,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        durationSeconds: totalSeconds,
        order: state.speakers.length + 1
      }
    ];

    socket.emit('set_speakers', { roomId, speakers: updated });
    setName('');
    setMinutes('3');
    setSeconds('0');
  };

  const deleteSpeaker = (id) => {
    const filtered = state.speakers
      .filter((speaker) => speaker.id !== id)
      .map((speaker, index) => ({ ...speaker, order: index + 1 }));

    socket.emit('set_speakers', { roomId, speakers: filtered });
  };

  const updateSpeaker = (id, patch) => {
    const updated = state.speakers.map((speaker) =>
      speaker.id === id ? { ...speaker, ...patch } : speaker
    );

    socket.emit('set_speakers', { roomId, speakers: updated });
  };

  const sortedSpeakers = useMemo(
    () => [...state.speakers].sort((a, b) => a.order - b.order),
    [state.speakers]
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-4 md:p-8">
      <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h1 className="text-3xl font-black tracking-wide">CronosFlow Admin</h1>
        <p className="text-slate-300">Sala: <strong>{roomId}</strong></p>
      </header>

      <section className="mb-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-4">
        <input
          className="rounded-xl bg-slate-800 p-3"
          placeholder="Nombre del discursante"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-xl bg-slate-800 p-3"
          type="number"
          min="0"
          placeholder="Min"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <input
          className="rounded-xl bg-slate-800 p-3"
          type="number"
          min="0"
          max="59"
          placeholder="Seg"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
        />
        <button className="rounded-xl bg-cyan-500 p-3 font-bold text-black" onClick={addSpeaker}>
          Agregar
        </button>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-4 text-2xl font-bold">Discursantes</h2>
        <div className="space-y-3">
          {sortedSpeakers.map((speaker, idx) => (
            <div key={speaker.id} className="grid items-center gap-2 rounded-xl bg-slate-800 p-3 md:grid-cols-[50px_1fr_120px_100px_90px]">
              <span className="text-lg font-bold">#{idx + 1}</span>
              <input
                className="rounded-lg bg-slate-700 p-2"
                value={speaker.name}
                onChange={(e) => updateSpeaker(speaker.id, { name: e.target.value })}
              />
              <input
                className="rounded-lg bg-slate-700 p-2"
                type="number"
                min="1"
                value={speaker.durationSeconds}
                onChange={(e) => updateSpeaker(speaker.id, { durationSeconds: Number(e.target.value) || 0 })}
              />
              <span className="text-sm text-slate-300">segundos</span>
              <button className="rounded-lg bg-red-500 px-3 py-2 font-semibold" onClick={() => deleteSpeaker(speaker.id)}>
                Eliminar
              </button>
            </div>
          ))}
          {!sortedSpeakers.length && <p className="text-slate-400">Sin discursantes todavía.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-2xl font-bold">Control en vivo</h2>
        <p className="mb-2 text-lg">Actual: <strong>{state.currentSpeaker?.name || '—'}</strong></p>
        <p className="mb-2 text-4xl font-black"><TimerText totalSeconds={state.timeRemaining} /></p>
        <ProgressBar value={state.progress} />
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          <button className="rounded-xl bg-green-500 p-3 font-black text-black" onClick={() => socket.emit('start_timer', { roomId })}>▶ Iniciar</button>
          <button className="rounded-xl bg-yellow-400 p-3 font-black text-black" onClick={() => socket.emit('pause_timer', { roomId })}>⏸ Pausar</button>
          <button className="rounded-xl bg-indigo-500 p-3 font-black" onClick={() => socket.emit('next_speaker', { roomId })}>⏭ Siguiente</button>
          <button className="rounded-xl bg-rose-500 p-3 font-black" onClick={() => socket.emit('reset_timer', { roomId })}>🔄 Reset</button>
          <button
            className="rounded-xl bg-slate-700 p-3 font-bold"
            onClick={() => socket.emit('set_auto_advance', { roomId, autoAdvance: !state.autoAdvance })}
          >
            Auto: {state.autoAdvance ? 'ON' : 'OFF'}
          </button>
        </div>
      </section>
    </main>
  );
}

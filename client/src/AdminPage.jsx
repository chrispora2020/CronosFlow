import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressBar } from './components/ProgressBar';
import { TimerText } from './components/TimerText';
import { useRoomId } from './hooks/useRoomId';
import { socket } from './socket';

const defaultState = {
  speakers: [],
  currentSpeakerIndex: 0,
  timeRemaining: 0,
  isRunning: false,
  progress: 0,
  totalDuration: 0,
  currentSpeaker: null,
  autoAdvance: true,
  displayConfig: {
    showName: true,
    showTimer: true,
    namePosition: 'top',
    timerSize: 'lg'
  }
};

export default function AdminPage() {
  const roomId = useRoomId();
  const navigate = useNavigate();
  const [state, setState] = useState(defaultState);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('3');
  const [editingSpeaker, setEditingSpeaker] = useState(null); // { id, name, minutes }
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoom, setEditingRoom] = useState(null); // { id, value }
  const [followMode, setFollowMode] = useState(false);
  const dragSrcIdx = useRef(null);

  useEffect(() => {
    socket.emit('join_room', { roomId });
    socket.emit('get_rooms');
    socket.emit('set_global_active_room', { roomId });
    const onSync = (nextState) => setState(nextState);
    const onRoomsList = (list) => setRooms(list);
    const onRoomDeleted = ({ roomId: deletedId }) => {
      if (deletedId === roomId) navigate('/admin');
    };
    const onRoomRenamed = ({ oldId, newId }) => {
      if (oldId === roomId) navigate(`/admin?room=${encodeURIComponent(newId)}`);
    };
    socket.on('sync_state', onSync);
    socket.on('rooms_list', onRoomsList);
    socket.on('room_deleted', onRoomDeleted);
    socket.on('room_renamed', onRoomRenamed);

    return () => {
      socket.off('sync_state', onSync);
      socket.off('rooms_list', onRoomsList);
      socket.off('room_deleted', onRoomDeleted);
      socket.off('room_renamed', onRoomRenamed);
    };
  }, [roomId, navigate]);

  const deleteRoom = (id) => {
    if (!window.confirm(`¿Eliminar la sesión "${id}"? Se perderán todos los discursantes.`)) return;
    socket.emit('delete_room', { roomId: id });
    if (id === roomId) navigate('/admin');
  };

  const startRename = (id) => setEditingRoom({ id, value: id });

  const confirmRename = () => {
    if (!editingRoom) return;
    const trimmed = editingRoom.value.trim();
    if (trimmed && trimmed !== editingRoom.id) {
      socket.emit('rename_room', { roomId: editingRoom.id, newName: trimmed });
    }
    setEditingRoom(null);
  };

  const createRoom = () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;
    navigate(`/admin?room=${encodeURIComponent(trimmed)}`);
    setNewRoomName('');
  };

  const switchRoom = (id) => {
    navigate(`/admin?room=${encodeURIComponent(id)}`);
  };

  const cfg = state.displayConfig ?? defaultState.displayConfig;

  const updateDisplayConfig = (patch) => {
    socket.emit('set_display_config', { roomId, config: patch });
  };

  const cfgBtn = (active) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
      active ? 'bg-cyan-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
    }`;

  const startEditSpeaker = (speaker) =>
    setEditingSpeaker({ id: speaker.id, name: speaker.name, minutes: String(Math.round(speaker.durationSeconds / 60)) });

  const commitEditSpeaker = () => {
    if (!editingSpeaker) return;
    const mins = Number(editingSpeaker.minutes);
    if (!editingSpeaker.name.trim() || mins <= 0) return;
    updateSpeaker(editingSpeaker.id, { name: editingSpeaker.name.trim(), durationSeconds: mins * 60 });
    setEditingSpeaker(null);
  };

  const reorderSpeakers = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const reordered = [...sortedSpeakers];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withOrder = reordered.map((s, i) => ({ ...s, order: i + 1 }));
    socket.emit('set_speakers', { roomId, speakers: withOrder });
  };

  const moveSpeaker = (idx, direction) => reorderSpeakers(idx, idx + direction);

  const addSpeaker = () => {
    const totalSeconds = Number(minutes || 0) * 60;
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
  };

  const deleteSpeaker = (id) => {
    const speaker = state.speakers.find((s) => s.id === id);
    if (!window.confirm(`¿Eliminar a "${speaker?.name ?? 'este discursante'}"?`)) return;
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
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div>
          <h1 className="text-3xl font-black tracking-wide">CronosFlow Admin</h1>
          <p className="text-slate-300">Sesión: <strong>{roomId}</strong></p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-black hover:bg-cyan-400 transition-colors"
            onClick={() => window.open(followMode ? '/display?follow=1' : `/display?room=${roomId}`, '_blank')}
          >
            📺 Abrir Display
          </button>
          <div className="flex items-center rounded-xl bg-slate-800 p-1 text-sm">
            <button
              onClick={() => setFollowMode(false)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                !followMode ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📌 Por sesión
            </button>
            <button
              onClick={() => setFollowMode(true)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                followMode ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📡 Modo libre
            </button>
          </div>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-xl font-bold">Sesiones</h2>
        <div className="mb-3 flex gap-2">
          <input
            className="flex-1 rounded-xl bg-slate-800 p-3"
            placeholder="Nueva sesión (ej: estaca1)"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createRoom()}
          />
          <button className="rounded-xl bg-cyan-600 px-5 py-2 font-bold" onClick={createRoom}>
            Crear
          </button>
        </div>
        {rooms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`flex items-center gap-1 rounded-xl text-sm font-semibold transition-colors ${
                  room.id === roomId ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-200'
                }`}
              >
                {editingRoom?.id === room.id ? (
                  <input
                    className="w-32 rounded-l-xl bg-slate-700 px-3 py-2 text-white outline-none"
                    autoFocus
                    value={editingRoom.value}
                    onChange={(e) => setEditingRoom({ ...editingRoom, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditingRoom(null); }}
                    onBlur={confirmRename}
                  />
                ) : (
                  <button className="flex items-center gap-2 px-3 py-2" onClick={() => switchRoom(room.id)}>
                    {room.id}
                    {room.isRunning && <span className="inline-block h-2 w-2 rounded-full bg-green-400" />}
                    <span className="text-xs opacity-60">{room.speakersCount} disc.</span>
                  </button>
                )}
                <button
                  className="px-2 py-2 opacity-60 hover:opacity-100"
                  title="Renombrar"
                  onClick={() => startRename(room.id)}
                >✏</button>
                <button
                  className="rounded-r-xl px-2 py-2 opacity-60 hover:text-red-400 hover:opacity-100"
                  title="Eliminar sesión"
                  onClick={() => deleteRoom(room.id)}
                >🗑</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-3">
        <input
          className="rounded-xl bg-slate-800 p-3"
          placeholder="Nombre del discursante"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-xl bg-slate-800 p-3"
          type="number"
          min="1"
          placeholder="Minutos"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <button className="rounded-xl bg-cyan-500 p-3 font-bold text-black" onClick={addSpeaker}>
          Agregar
        </button>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-4 text-2xl font-bold">Discursantes</h2>
        <div className="space-y-2">
          {sortedSpeakers.map((speaker, idx) => {
            const isEditing = editingSpeaker?.id === speaker.id;
            return (
              <div
                key={speaker.id}
                draggable={!isEditing}
                onDragStart={() => { if (!isEditing) dragSrcIdx.current = idx; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { reorderSpeakers(dragSrcIdx.current, idx); dragSrcIdx.current = null; }}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-800 p-3"
              >
                {/* orden / drag */}
                <span className="cursor-grab select-none text-slate-500 text-xl" title="Arrastrar">⠿</span>
                <button className="rounded bg-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-600 disabled:opacity-30" disabled={idx === 0} onClick={() => moveSpeaker(idx, -1)}>▲</button>
                <button className="rounded bg-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-600 disabled:opacity-30" disabled={idx === sortedSpeakers.length - 1} onClick={() => moveSpeaker(idx, 1)}>▼</button>

                {isEditing ? (
                  <>
                    <input
                      className="min-w-0 flex-1 rounded-lg bg-slate-700 p-2 outline-none ring-2 ring-cyan-500"
                      autoFocus
                      value={editingSpeaker.name}
                      onChange={(e) => setEditingSpeaker({ ...editingSpeaker, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEditSpeaker(); if (e.key === 'Escape') setEditingSpeaker(null); }}
                    />
                    <div className="flex items-center gap-1">
                      <input
                        className="w-20 rounded-lg bg-slate-700 p-2 outline-none ring-2 ring-cyan-500"
                        type="number"
                        min="1"
                        value={editingSpeaker.minutes}
                        onChange={(e) => setEditingSpeaker({ ...editingSpeaker, minutes: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEditSpeaker(); if (e.key === 'Escape') setEditingSpeaker(null); }}
                      />
                      <span className="text-sm text-slate-400">min</span>
                    </div>
                    <button className="rounded-lg bg-green-500 px-3 py-2 font-bold text-black" onClick={commitEditSpeaker} title="Guardar">✓</button>
                    <button className="rounded-lg bg-slate-600 px-3 py-2 font-bold" onClick={() => setEditingSpeaker(null)} title="Cancelar">✗</button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate font-semibold">{speaker.name}</span>
                    <span className="rounded-lg bg-slate-700 px-3 py-1 text-sm text-slate-300">{Math.round(speaker.durationSeconds / 60)} min</span>
                    <button className="rounded-lg bg-slate-600 px-3 py-2 text-slate-200 hover:bg-slate-500" onClick={() => startEditSpeaker(speaker)} title="Editar">✏</button>
                    <button className="rounded-lg bg-red-500/80 px-3 py-2 font-semibold hover:bg-red-500" onClick={() => deleteSpeaker(speaker.id)} title="Eliminar">🗑</button>
                  </>
                )}
              </div>
            );
          })}
          {!sortedSpeakers.length && <p className="text-slate-400">Sin discursantes todavía.</p>}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-4 text-xl font-bold">Configuración del Display</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-slate-400">Mostrar en pantalla</p>
            <div className="flex gap-2">
              <button className={cfgBtn(cfg.showName)} onClick={() => updateDisplayConfig({ showName: !cfg.showName })}>
                {cfg.showName ? '✓' : '✗'} Nombre
              </button>
              <button className={cfgBtn(cfg.showTimer)} onClick={() => updateDisplayConfig({ showTimer: !cfg.showTimer })}>
                {cfg.showTimer ? '✓' : '✗'} Tiempo
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-400">Posición del nombre</p>
            <div className="flex gap-2">
              <button className={cfgBtn(cfg.namePosition === 'top')} onClick={() => updateDisplayConfig({ namePosition: 'top' })}>↑ Arriba</button>
              <button className={cfgBtn(cfg.namePosition === 'bottom')} onClick={() => updateDisplayConfig({ namePosition: 'bottom' })}>↓ Abajo</button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-400">Tamaño del timer</p>
            <div className="flex gap-2">
              {['sm', 'md', 'lg', 'xl'].map((size) => (
                <button key={size} className={cfgBtn(cfg.timerSize === size)} onClick={() => updateDisplayConfig({ timerSize: size })}>
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-400">Tamaño del nombre</p>
            <div className="flex gap-2">
              {[['sm', 'Pequeño'], ['md', 'Mediano'], ['lg', 'Grande']].map(([size, label]) => (
                <button key={size} className={cfgBtn((cfg.nameSize ?? 'md') === size)} onClick={() => updateDisplayConfig({ nameSize: size })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-2xl font-bold">Control en vivo</h2>
        <p className="mb-2 text-lg">Actual: <strong>{state.currentSpeaker?.name || '—'}</strong></p>
        <p className="mb-2 text-4xl font-black"><TimerText totalSeconds={state.timeRemaining} /></p>
        <ProgressBar value={state.progress} />
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <button className="rounded-xl bg-green-500 p-3 font-black text-black" onClick={() => socket.emit('start_timer', { roomId })}>▶ Iniciar</button>
          <button className="rounded-xl bg-yellow-400 p-3 font-black text-black" onClick={() => socket.emit('pause_timer', { roomId })}>⏸ Pausar</button>
          <button className="rounded-xl bg-orange-500 p-3 font-black text-black" onClick={() => socket.emit('force_end_speaker', { roomId })}>⏱ Terminar tiempo</button>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
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

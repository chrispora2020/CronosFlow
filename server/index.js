import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = http.createServer(app);

const clientUrl = process.env.CLIENT_URL?.split(',').map((v) => v.trim()) ?? '*';
const io = new Server(server, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT) || 4000;
const TICK_INTERVAL_MS = 1000;

app.use(cors({ origin: clientUrl }));
app.use(express.json());

const rooms = new Map();

function getInitialState() {
  return {
    speakers: [],
    currentSpeakerIndex: 0,
    timeRemaining: 0,
    isRunning: false,
    autoAdvance: true,
    displayConfig: {
      showName: true,
      showTimer: true,
      namePosition: 'top',
      timerSize: 'lg'
    },
    updatedAt: Date.now(),
    version: 1
  };
}

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      state: getInitialState(),
      intervalId: null
    });
  }

  return rooms.get(roomId);
}

function sanitizeSpeakers(rawSpeakers = []) {
  return rawSpeakers
    .map((speaker, index) => {
      const name = String(speaker.name ?? '').trim();
      const durationSeconds = Math.max(0, Number(speaker.durationSeconds) || 0);
      const order = Number.isFinite(Number(speaker.order)) ? Number(speaker.order) : index + 1;

      if (!name || durationSeconds <= 0) {
        return null;
      }

      return {
        id: speaker.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        durationSeconds,
        order
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((speaker, index) => ({
      ...speaker,
      order: index + 1
    }));
}

function totalDuration(speakers) {
  return speakers.reduce((sum, s) => sum + s.durationSeconds, 0);
}

function consumedDuration(state) {
  const completed = state.speakers
    .slice(0, state.currentSpeakerIndex)
    .reduce((sum, s) => sum + s.durationSeconds, 0);

  const currentSpeaker = state.speakers[state.currentSpeakerIndex];
  const currentConsumed = currentSpeaker ? currentSpeaker.durationSeconds - state.timeRemaining : 0;

  return Math.max(0, completed + Math.max(0, currentConsumed));
}

function emitState(roomId) {
  const room = ensureRoom(roomId);
  const state = room.state;
  const total = totalDuration(state.speakers);
  const elapsed = consumedDuration(state);
  const currentSpeaker = state.speakers[state.currentSpeakerIndex] || null;

  io.to(roomId).emit('sync_state', {
    ...state,
    totalDuration: total,
    elapsedDuration: elapsed,
    progress: total > 0 ? Math.min(1, elapsed / total) : 0,
    currentSpeaker
  });
}

function stopTimer(roomId) {
  const room = ensureRoom(roomId);
  if (room.intervalId) {
    clearInterval(room.intervalId);
    room.intervalId = null;
  }
  room.state.isRunning = false;
}

function moveToNextSpeaker(roomId) {
  const room = ensureRoom(roomId);
  const { state } = room;

  if (state.currentSpeakerIndex + 1 < state.speakers.length) {
    state.currentSpeakerIndex += 1;
    state.timeRemaining = state.speakers[state.currentSpeakerIndex].durationSeconds;
  } else {
    stopTimer(roomId);
    state.timeRemaining = 0;
  }

  state.updatedAt = Date.now();
}

function startTimer(roomId) {
  const room = ensureRoom(roomId);
  const { state } = room;
  if (room.intervalId || !state.speakers.length) return;

  room.intervalId = setInterval(() => {
    if (!state.isRunning) return;

    state.timeRemaining = Math.max(0, state.timeRemaining - 1);

    if (state.timeRemaining === 0) {
      if (state.autoAdvance) {
        moveToNextSpeaker(roomId);
      } else {
        stopTimer(roomId);
      }
    }

    state.updatedAt = Date.now();
    emitState(roomId);
  }, TICK_INTERVAL_MS);
}

function getRoomsList() {
  return Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    speakersCount: room.state.speakers.length,
    isRunning: room.state.isRunning
  }));
}

function broadcastRoomsList() {
  io.emit('rooms_list', getRoomsList());
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

io.on('connection', (socket) => {
  socket.on('join_room', ({ roomId = 'default' } = {}) => {
    socket.join(roomId);
    ensureRoom(roomId);
    emitState(roomId);
    broadcastRoomsList();
  });

  socket.on('get_rooms', () => {
    socket.emit('rooms_list', getRoomsList());
  });

  socket.on('set_speakers', ({ roomId = 'default', speakers = [] } = {}) => {
    const room = ensureRoom(roomId);
    const nextSpeakers = sanitizeSpeakers(speakers);

    room.state.speakers = nextSpeakers;
    room.state.currentSpeakerIndex = 0;
    room.state.timeRemaining = nextSpeakers[0]?.durationSeconds || 0;
    room.state.isRunning = false;
    room.state.updatedAt = Date.now();
    emitState(roomId);
    broadcastRoomsList();
  });

  socket.on('start_timer', ({ roomId = 'default' } = {}) => {
    const room = ensureRoom(roomId);
    if (!room.state.speakers.length) return;

    if (room.state.timeRemaining <= 0) {
      room.state.timeRemaining = room.state.speakers[room.state.currentSpeakerIndex]?.durationSeconds || 0;
    }

    room.state.isRunning = true;
    room.state.updatedAt = Date.now();
    startTimer(roomId);
    emitState(roomId);
  });

  socket.on('pause_timer', ({ roomId = 'default' } = {}) => {
    const room = ensureRoom(roomId);
    room.state.isRunning = false;
    room.state.updatedAt = Date.now();
    emitState(roomId);
  });

  socket.on('next_speaker', ({ roomId = 'default' } = {}) => {
    const room = ensureRoom(roomId);
    moveToNextSpeaker(roomId);
    emitState(roomId);
  });

  socket.on('reset_timer', ({ roomId = 'default' } = {}) => {
    const room = ensureRoom(roomId);
    stopTimer(roomId);
    room.state.currentSpeakerIndex = 0;
    room.state.timeRemaining = room.state.speakers[0]?.durationSeconds || 0;
    room.state.updatedAt = Date.now();
    emitState(roomId);
  });

  socket.on('force_end_speaker', ({ roomId = 'default' } = {}) => {
    const room = ensureRoom(roomId);
    stopTimer(roomId);
    room.state.timeRemaining = 0;
    room.state.updatedAt = Date.now();
    emitState(roomId);
  });

  socket.on('set_display_config', ({ roomId = 'default', config = {} } = {}) => {
    const room = ensureRoom(roomId);
    room.state.displayConfig = { ...room.state.displayConfig, ...config };
    room.state.updatedAt = Date.now();
    emitState(roomId);
  });

  socket.on('set_auto_advance', ({ roomId = 'default', autoAdvance = true } = {}) => {
    const room = ensureRoom(roomId);
    room.state.autoAdvance = Boolean(autoAdvance);
    room.state.updatedAt = Date.now();
    emitState(roomId);
  });

  socket.on('disconnect', () => {
    // no-op
  });
});

server.listen(PORT, () => {
  console.log(`CronosFlow server running on :${PORT}`);

  // Self-ping para mantener activo el free tier de Render
  const selfPingUrl = process.env.SELF_PING_URL;
  if (selfPingUrl) {
    setInterval(() => {
      fetch(selfPingUrl).catch(() => {});
    }, 10 * 60 * 1000); // cada 10 minutos
    console.log(`Self-ping activo → ${selfPingUrl}`);
  }
});

import { io } from 'socket.io-client';

const baseUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export const socket = io(baseUrl, {
  autoConnect: true,
  reconnection: true,
  transports: ['websocket', 'polling']
});

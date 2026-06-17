import { io } from 'socket.io-client';

let SOCKET = null;
let reconnectCallbacks = [];

export const connectSocket = () => {
  if (SOCKET) return SOCKET;

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  SOCKET = io({
    auth: { token },
    autoConnect: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 5000
  });

  SOCKET.on('connect', () => {
    reconnectCallbacks.forEach(cb => cb());
  });

  return SOCKET;
};

export const onReconnect = (cb) => {
  reconnectCallbacks.push(cb);
  return () => {
    reconnectCallbacks = reconnectCallbacks.filter(fn => fn !== cb);
  };
};

export const disconnectSocket = () => {
  if (SOCKET) {
    SOCKET.removeAllListeners();
    SOCKET.disconnect();
    SOCKET = null;
  }
};

export const getSocket = () => SOCKET;

export default getSocket;

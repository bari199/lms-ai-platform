import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./tokenStorage";

let socket: Socket | null = null;

export const connectSocket = (): Socket => {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Access token is not available");
  }

  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: {
        token,
      },
    });
  }

  socket.auth = { token };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

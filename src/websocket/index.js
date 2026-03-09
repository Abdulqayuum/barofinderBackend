import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

export function setupWebSocket(server) {
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN, credentials: true }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || '');
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);

    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('typing', (payload) => {
      // payload = { conversation_id, user_id }
      socket.to(`conversation:${payload.conversation_id}`).emit('typing', payload);
    });
  });

  return io;
}

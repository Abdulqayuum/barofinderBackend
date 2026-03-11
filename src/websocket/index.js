import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { getJwtSecret } from '../config/security.js';

async function isConversationParticipant(conversationId, userId) {
  if (typeof conversationId !== 'string' || !conversationId.trim()) return false;

  const [rows] = await db.query(
    `SELECT id
     FROM conversations
     WHERE id = ?
       AND (student_id = ? OR tutor_id = ?)
     LIMIT 1`,
    [conversationId, userId, userId]
  );

  return rows.length > 0;
}

export function setupWebSocket(server) {
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN, credentials: true }
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, getJwtSecret());
      if (payload.type !== 'access') {
        return next(new Error('Invalid token'));
      }

      const [profiles] = await db.query('SELECT status FROM profiles WHERE user_id = ? LIMIT 1', [payload.sub]);
      if (profiles[0]?.status === 'suspended') {
        return next(new Error('Account suspended'));
      }

      socket.data.userId = payload.sub;
      socket.data.joinedConversations = new Set();
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);

    socket.on('join-conversation', async (conversationId, callback) => {
      try {
        const authorized = await isConversationParticipant(conversationId, userId);
        if (!authorized) {
          if (typeof callback === 'function') callback({ ok: false, error: 'Forbidden' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        socket.data.joinedConversations.add(conversationId);
        if (typeof callback === 'function') callback({ ok: true });
      } catch {
        if (typeof callback === 'function') callback({ ok: false, error: 'Could not join conversation' });
      }
    });

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      socket.data.joinedConversations.delete(conversationId);
    });

    socket.on('typing', async (payload) => {
      const conversationId = typeof payload?.conversation_id === 'string' ? payload.conversation_id : '';
      if (!conversationId) return;

      try {
        if (!socket.data.joinedConversations.has(conversationId)) {
          const authorized = await isConversationParticipant(conversationId, userId);
          if (!authorized) return;
          socket.join(`conversation:${conversationId}`);
          socket.data.joinedConversations.add(conversationId);
        }

        socket.to(`conversation:${conversationId}`).emit('typing', {
          conversation_id: conversationId,
          user_id: userId,
        });
      } catch {
        // Ignore transient websocket authorization failures.
      }
    });
  });

  return io;
}

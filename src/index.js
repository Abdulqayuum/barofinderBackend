import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';
import { setupWebSocket } from './websocket/index.js';
import { apiRateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';

import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profiles.routes.js';
import tutorRoutes from './routes/tutors.routes.js';
import courseRoutes from './routes/courses.routes.js';
import enrollmentRoutes from './routes/enrollments.routes.js';
import lessonRoutes from './routes/lessons.routes.js';
import quizRoutes from './routes/quizzes.routes.js';
import subscriptionRoutes from './routes/subscriptions.routes.js';
import conversationRoutes from './routes/conversations.routes.js';
import reviewRoutes from './routes/reviews.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import lookupRoutes from './routes/lookups.routes.js';
import adminRoutes from './routes/admin.routes.js';
import uploadRoutes from './routes/upload.routes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8080')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (no Origin header) and configured browser origins.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimiter);
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', enrollmentRoutes);
app.use('/api', lessonRoutes);
app.use('/api', quizRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', lookupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

app.use(errorHandler);

setupWebSocket(server);

const PORT = process.env.PORT || 3000;

async function start() {
  await testConnection();
  server.listen(PORT, () => {
    console.log(`BaroFinder API running on port ${PORT}`);
  });
}

start();

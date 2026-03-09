# BaroFinder Backend (Node.js + MySQL)

Standalone backend for BaroFinder. You can build, run, test, and document the API without opening the frontend.

## 1) Stack

- Node.js (Express)
- MySQL 8+
- JWT auth
- Socket.io realtime
- Multer file uploads

## 2) Project Layout

- `src/index.js`: server entry
- `src/config/database.js`: MySQL pool + JSON casting
- `src/routes/*`: API route modules
- `src/middleware/*`: auth, validation, rate-limit, error handler
- `src/websocket/*`: realtime server
- `uploads/`: local uploaded files

## 3) Database Setup (full schema + essential seed data)

Run the master schema:

```bash
mysql -u root -p < ../docs/MYSQL_SCHEMA.sql
```

That file already includes:
- all tables
- constraints/indexes/triggers/functions
- core reference data (`cities`, `subjects`, `levels`, `languages`, `payment_methods`, `subscription_plans`, `app_settings`)

Optional: add full demo users/tutors/courses/messages/reviews:

```bash
mysql -u root -p barofinder < ./scripts/SEED_DEMO.sql
```

## 4) Environment

```bash
cp .env.example .env
```

Key variables:
- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`
- `CORS_ORIGIN` (comma-separated allowed origins)
- `EMAIL_VERIFICATION_REQUIRED` (`false` for local dev)

## 5) Run

```bash
npm install
npm run dev
```

Server:
- `http://localhost:3000`
- API base: `http://localhost:3000/api`

## 6) API Coverage

Implemented route groups:
- Auth: `/api/auth/*`
- Profiles: `/api/profiles/*`
- Tutors: `/api/tutors/*`
- Courses: `/api/courses/*`
- Enrollments/Lessons/Quizzes/Subs/Reviews/Lookups
- Conversations/Messages
- Notifications
- Admin
- Upload

Primary API documentation:
- `../docs/NODEJS_API_GUIDE.md`
- `../docs/Macalin_API.postman_collection.json`

## 7) Quick API Smoke Test (no frontend)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barofinder.local","password":"admin123"}'
```

```bash
curl http://localhost:3000/api/tutors
```

## 8) Build Backend from Docs Only

If someone is implementing backend from scratch, they only need:
- `../docs/MYSQL_SCHEMA.sql`
- `../docs/NODEJS_API_GUIDE.md`
- this `backend/README.md`
- optional `./scripts/SEED_DEMO.sql` for test data

# CodeShelf

CodeShelf is a personal coding memory and revision platform.

**Tagline:** Never forget what you already learned.

It stores structured coding knowledge, generates revision cards, schedules spaced repetition, supports walk/travel revision, tracks streaks based on completed reviews, and can send reminder emails.

## Stack

- Frontend: React + Vite
- Backend: FastAPI
- Database: Neon PostgreSQL via SQLAlchemy
- Migrations: Alembic
- Auth: JWT
- Email: Resend API, with local console fallback
- AI: Hugging Face BART for summaries, Gemini-ready fallback endpoints for cards/explanations

## Local Setup

```bash
cp .env.example .env
cp backend-py/.env.example backend-py/.env
npm install
npm run migrate
npm run dev:api
npm run dev
```

Frontend: `http://127.0.0.1:5173`

API: `http://127.0.0.1:8000/api`

Health: `http://127.0.0.1:8000/api/health`

If `DATABASE_URL` is not set, the backend uses a local SQLite development database. For Neon, set:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require
```

Then run:

```bash
npm run migrate
```

## MVP Modules

- Knowledge Library: concept, problem, mistake, command, interview, and quick recall notes
- Problem Tracker: status, pattern, approach, code, mistake, complexity, next review date
- Mistake Book: wrong logic, correct logic, reason, prevention tip, repeated count
- Revision Engine: due cards, spaced repetition ratings, review logs
- Today Revision: show answer, forgot/hard/good/easy ratings, streak progress
- Walk Mode: large text and browser text-to-speech
- Travel Mode: localStorage offline pack and progress sync
- Email Reminders: preferences, preview, test/daily send through Resend or local print
- AI endpoints: summary, card generation fallback, email preview, walk explanations

## Deployment

Frontend on Vercel:

- Set `VITE_API_BASE_URL=https://your-render-api.onrender.com/api`

Backend on Render:

- Use `backend-py/render.yaml`
- Set Neon `DATABASE_URL`
- Set `JWT_SECRET`, `FRONTEND_URL`, and optional `RESEND_API_KEY`, `GEMINI_API_KEY`, `HF_API_KEY`
- Render build runs Alembic migrations before starting FastAPI

Daily reminder emails can be triggered with a Render Cron Job calling `/api/email/send-daily` for the intended user/session flow, or extended later with a service-token batch endpoint.

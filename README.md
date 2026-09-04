<div align="center">

# ⟨/⟩ CodeShelf

### Your Personal Coding Memory Vault

**Never forget what you already learned.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Neon](https://img.shields.io/badge/Neon-PostgreSQL-00e5a0?logo=postgresql&logoColor=white)](https://neon.tech)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)

---

</div>

## ✦ What is CodeShelf?

CodeShelf is a **spaced-repetition revision platform** built for developers who refuse to forget what they've learned. It transforms raw notes, solved problems, and coding mistakes into an intelligent recall system — with AI-generated flashcards, walk-mode audio revision, offline travel packs, and verified email reminders.

> _Think of it as Anki meets Notion, built specifically for DSA, SQL, System Design, DevOps, and interview prep._

---

## ⚡ Core Features

| Module | Description |
|---|---|
| **📚 Knowledge Library** | Concept, problem, mistake, command, interview, and quick recall notes with topic/difficulty filters |
| **🧠 Revision Engine** | SM-2 spaced repetition with forgot / hard / good / easy ratings and streak tracking |
| **🎧 Walk Mode** | Audio-first revision — learn by listening with text-to-speech while walking |
| **✈️ Travel Mode** | Download an offline pack to localStorage, review without internet, sync when back online |
| **🐛 Mistake Book** | Capture wrong approaches, correct logic, prevention tips — turn errors into memory |
| **💻 Problem Tracker** | LeetCode/practice tracker with pattern, approach, code, and optional GitHub commit pipeline |
| **📬 Email Studio** | Verified Gmail reminders with customizable style, timing, topic filters, and preview |
| **🤖 AI Integration** | HuggingFace BART summaries, Gemini-ready card generation, and LLM JSON import |
| **🔌 Browser Extension** | Chrome extension for one-click LeetCode problem capture |
| **🔥 Streaks** | Daily review streaks with minimum card thresholds and progress tracking |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Vite + React 19)        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Dashboard │ │ Library  │ │Walk Mode │ │ Email  │ │
│  │(CMD UI)  │ │ Explorer │ │ (Audio)  │ │ Studio │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       └─────────────┴───────────┴────────────┘      │
│                         │ JWT Auth                   │
├─────────────────────────┼───────────────────────────┤
│                    Backend (FastAPI)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Notes   │ │ Revision │ │ Problems │ │ Email  │ │
│  │  CRUD    │ │  Engine  │ │ + GitHub │ │ Sender │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       └─────────────┴───────────┴────────────┘      │
│                         │ SQLAlchemy                  │
├─────────────────────────┼───────────────────────────┤
│              Neon PostgreSQL (Serverless)             │
└─────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7, CodeMirror 6, Lucide Icons |
| **Backend** | FastAPI, SQLAlchemy (async), Alembic migrations |
| **Database** | Neon PostgreSQL (serverless) — falls back to SQLite locally |
| **Auth** | Email/password (bcrypt) → JWT tokens |
| **Email** | Resend API with HTML templates — console fallback for dev |
| **AI** | HuggingFace Inference (BART), Gemini API (flash), LLM JSON import |
| **GitHub** | OAuth → repo selection → automated solution commits |
| **Design** | Space-hacker nebula theme, custom cursor, dual theme (dark/light) |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **PostgreSQL** (or use Neon free tier)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/codeshelf.git
cd codeshelf
npm install
pip install -r backend-py/requirements.txt
```

### 2. Environment Setup

```bash
cp .env.example .env
cp backend-py/.env.example backend-py/.env
```

Configure in `backend-py/.env`:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
```

Optional keys for full feature set:

```env
RESEND_API_KEY=re_...          # Email reminders
GEMINI_API_KEY=...             # AI card generation
HF_API_KEY=hf_...              # Summaries
GITHUB_CLIENT_ID=...           # GitHub integration
GITHUB_CLIENT_SECRET=...
```

### 3. Run

```bash
# Terminal 1 — Backend API
npm run dev:api

# Terminal 2 — Frontend
npm run dev
```

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| API | `http://localhost:8000/api` |
| Health | `http://localhost:8000/api/health` |

---

## 📂 Project Structure

```
codeshelf/
├── src/                    # React frontend
│   ├── pages/              # Route pages (Home, WalkMode, Problems, etc.)
│   ├── components/         # Layout, NebulaParticles, CursorGlow
│   ├── context/            # AuthContext (email/password + JWT)
│   ├── api/                # API client with token management
│   └── index.css           # Complete design system
├── backend-py/             # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI app with CORS
│   │   ├── routers/        # notes, revision, problems, email, github
│   │   ├── models/         # SQLAlchemy models
│   │   └── services/       # AI, email, GitHub services
│   └── alembic/            # Database migrations
├── extensions/             # Chrome & VS Code extensions
├── public/                 # Static assets & favicon
└── index.html              # Entry point
```

---

## 🎨 Design System

CodeShelf uses a custom **Space Command Center** aesthetic:

- **Nebula particles** — animated canvas star field with constellation lines
- **Custom cursor** — dot + ring with magnetic snapping on interactive elements
- **Glassmorphism** — frosted glass cards with `backdrop-filter: blur()`
- **Dual theme** — Obsidian Dark (default) + Pearl Light
- **Spring animations** — physics-based cubic-bezier transitions
- **JetBrains Mono** — monospace font for terminal/code aesthetic
- **Inter** — primary UI font for readability

---

## 🌐 Deployment

### Frontend → Vercel

```bash
# Set environment variable:
VITE_API_BASE_URL=https://your-api.onrender.com/api
```

### Backend → Render

- Use `backend-py/render.yaml`
- Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
- Build command runs Alembic migrations automatically

### Daily Emails → Render Cron

Schedule `/api/email/send-daily` via Render Cron Job for daily reminders.

---

## 📜 License

This project is private and not currently open-sourced.

---

<div align="center">

**Built with obsession for learning retention.**

*CodeShelf — because forgetting is not an option.*

</div>

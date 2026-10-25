# NexTwin Hackathon Baseline Audit Report

**Date:** October 25, 2026  
**Repository:** `FL4K1/Nextwin_v1`  
**Current Branch:** `main` (commit `fd45fa0`)  
**Remote URL:** `https://github.com/FL4K1/Nextwin_v1.git`  
**Working Tree Status:** Clean (no untracked code modifications)  
**Audit Purpose:** Establish verified current state and dependency readiness prior to Cloudinary integration.

---

## 1. Repository & Environment Overview

### 1.1 Architecture & Directory Layout
The repository is a multi-tier digital twin healthcare application consisting of:
- **Backend (`backend/`):** Django 5.0 REST framework + Django Channels 4 (ASGI) signaling service. Dual settings modules exist: legacy `medgenie/` and renamed `nexttwin/`.
- **AI Engine (`ai_engine/`):** FastAPI application intended for digital twin prediction, causal simulation, behavioral analytics, anomaly detection, and federated learning.
- **Frontend (`frontend/`):** Next.js 16.4.1 (React 19) App Router web app with Tailwind CSS, Lucide icons, Framer Motion, and Wagmi/Viem Web3 integration.
- **Blockchain (`blockchain/`):** Solidity smart contracts (`MedGenieAccess.sol`, `NexTwinAccess.sol`) with ABIs exported to frontend.
- **Deployment (`deploy/`, `docker-compose.yml`, `render.yaml`):** Container definitions for Backend, AI Engine, and Frontend, along with a Render blueprint.

### 1.2 Host Environment Versions
- **Operating System:** Windows 11
- **System Python:** Python 3.14.7 (Active path `python.exe`)
- **Backend Virtual Environment (`backend/venv`):** Python 3.13.14 (originally created at `C:\Users\Mudit Joshi\Desktop\Digital_Twin-Evolet-main\...\backend\venv`)
- **Node.js:** v24.14.1
- **npm:** 11.11.0

---

## 2. Startup Commands for Each Service

| Service | Documented (README.md) | Docker Compose (`docker-compose.yml`) | Cloud Deployment (`render.yaml`) | Verified Local Command |
|---|---|---|---|---|
| **Backend (Django)** | `cd backend`<br>`python manage.py runserver` (Port 8000) | `daphne -b 0.0.0.0 -p 8000 medgenie.asgi:application` | `gunicorn backend.wsgi:application` *(Fails: gunicorn not installed, module missing)* | `& "backend\venv\Scripts\python.exe" backend\manage.py runserver 8000` or `daphne -b 127.0.0.1 -p 8000 medgenie.asgi:application` |
| **AI Engine (FastAPI)** | `cd ai_engine`<br>`python server.py` (Port 8100) | `python server.py` (Port 8100) | `uvicorn ai_engine.main:app --host 0.0.0.0 --port 10000` *(Fails: `main.py` does not exist)* | `python ai_engine\server.py` (Loads on port 8100; prediction requires PyTorch) |
| **Frontend (Next.js)** | `cd frontend`<br>`npm install`<br>`npm run dev` (Port 3000) | `npm run dev` (Port 3000) | *Not defined in render.yaml* | `cd frontend; npm run dev` (Port 3000) |
| **Redis** | Documented prerequisite for Channels | `redis:7-alpine` (Port 6379) | *Not defined in render.yaml* | Standalone Redis server on port 6379 (Settings currently fallback to `InMemoryChannelLayer`) |

---

## 3. Checks Actually Run & Verified Results

### 3.1 Git & Tracking Checks
- **Remote Verification:** Verified remote `origin` is strictly `https://github.com/FL4K1/Nextwin_v1.git`.
- **Working Tree:** Verified clean (`git status -u` reports nothing to commit).
- **Tracked Artifacts / Sensitive Exposures:**
  - **Local Claude Config Tracked:** `.claude/settings.local.json` is tracked in git and contains local file system paths (`/t/AMTZ_DigitalTwin/frontend/...`).
  - **Lint Report Tracked:** `frontend/eslint-report.json` (184 KB) from an earlier local build is tracked in git.
  - **Binary PPTX Tracked:** `Medtech hackathon PPT Template 2026.pptx` (975 KB) is tracked in root.
  - **Compiled Assets Tracked:** Compiled service worker bundles (`frontend/public/worker-*.js`, `workbox-*.js`) are tracked in git.
- **Git Ignored Files Present Locally:**
  - `backend/db.sqlite3`: Local SQLite database present on disk (ignored by git). Contained 4 dev/test users (`mudit`, `testuser`, `TestUser`, `Test`) with synthetic emails and 1 digital twin state row. No real patient data or PII was identified.
  - `frontend/.env.local`: Present on disk (ignored by git). Contains placeholder URLs and dummy keys (`https://example.supabase.co`, `anon-key`).
  - `backend/venv/`: Existing virtual environment containing Django dependencies.

### 3.2 Django Backend Verification
- **Settings Module:** `medgenie.settings` is the active module called by `backend/manage.py`. A parallel duplicate package `backend/nexttwin/settings.py` exists with identical configuration.
- **Django System Check:** Executed `backend\manage.py check` with `backend\venv\Scripts\python.exe`. Result: **Passed** (`System check identified no issues (0 silenced)`).
- **Migration Status:** Executed `backend\manage.py showmigrations`. Result: **All 35 migrations are applied**. `makemigrations --dry-run` reported **No changes detected**.
- **ASGI & WSGI Entry Points:**
  - Loaded `medgenie.asgi:application`: `<class 'channels.routing.ProtocolTypeRouter'>` (Verified OK).
  - Loaded `medgenie.wsgi:application`: `<class 'django.core.handlers.wsgi.WSGIHandler'>` (Verified OK).
  - Loaded `nexttwin.asgi:application` and `nexttwin.wsgi:application` (Both verified OK).
- **Database Configuration:** Hardcoded to `sqlite3` at `BASE_DIR / 'db.sqlite3'`. It does **not** read `DATABASE_URL`.
- **Channel Layer:** Configured to `InMemoryChannelLayer` in settings; does not connect to external Redis unless modified.
- **Health Check Endpoint:** **None exists** on Django backend (`/` returns 404).

### 3.3 FastAPI AI Engine Verification
- **Entry Point:** `ai_engine/server.py` (`uvicorn.run("server:app", host="0.0.0.0", port=settings.PORT)`).
- **Port:** Defaults to `8100` (read from `AI_ENGINE_PORT` in `ai_engine/config.py`).
- **Health Check Endpoint:** `@app.get("/")` returning `{"status": "healthy", "version": "1.1.0"}`.
  - Verified via `TestClient`: `GET /` -> **HTTP 200 OK**.
- **Endpoint Test Battery:**
  - `GET /model-info` -> **200 OK**
  - `GET /federated/model` -> **200 OK**
  - `GET /federated/status` -> **200 OK**
  - `POST /detect-anomalies` -> **200 OK**
  - `POST /risk-score` -> **200 OK**
  - `POST /patient-similarity` -> **200 OK**
  - `POST /behavioral-analysis` -> **200 OK**
  - `POST /geospatial` -> **200 OK**
  - `POST /scribe` -> **200 OK**
  - `POST /voice-log` -> **200 OK**
  - `POST /predict` -> **HTTP 500 Internal Server Error** (`No module named 'torch'`)
  - `POST /simulate` -> **HTTP 500 Internal Server Error** (`No module named 'torch'`)

### 3.4 Frontend Verification
- **TypeScript Check:** Executed `npx tsc --noEmit` from `frontend/`. Result: **Passed (0 errors)**.
- **Production Build:** Executed `npm run build` (`next build` with Next 16 Turbopack). Result: **Compiled successfully in 7.6s**, static routes generated:
  - `/` (Dashboard / Landing)
  - `/_not-found` (404)
  - `/login`
  - `/register`
- **Lint Script Check:** Executed `npm run lint`. Result: **Verified Failure**. In `next@16.4.1`, `next lint` was removed from the Next.js CLI. The command treats `lint` as a directory argument and outputs `Invalid project directory provided, no such directory: ...\frontend\lint`.
- **API URL Configuration:**
  - `frontend/src/lib/api.ts` defines `API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"`
  - `frontend/src/lib/api.ts` defines `AI_BASE = process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8001"` (Mismatch with FastAPI 8100)
  - `frontend/src/lib/api.ts` defines `WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws"`

---

## 4. Confirmed Blockers, Suspected Issues & Missing Credentials

### 4.1 Confirmed Blockers (Verified Failures)
1. **PyTorch Missing in AI Engine:**
   - `torch>=2.2`, `torch-geometric>=2.5`, and `transformers>=4.38` are required by `ai_engine/requirements.txt` but not installed in the active environment.
   - Calling `/predict` or `/simulate` throws `HTTP 500: No module named 'torch'`.
2. **Broken Package Script (`npm run lint`):**
   - Running `npm run lint` fails immediately under Next.js 16 (`next lint` is no longer a CLI command).
3. **Render Deployment Configuration (`render.yaml`) Is Non-Functional:**
   - `medgenie-api` start command is `gunicorn backend.wsgi:application`, but `gunicorn` is not in `backend/requirements.txt`, and `backend.wsgi` does not exist as an import path from `backend/`.
   - `medgenie-api` build command runs `pip install -r requirements.txt`, but root has no `requirements.txt` (only `backend/requirements.txt`).
   - `medgenie-ai-engine` start command is `uvicorn ai_engine.main:app`, but the file is `server.py` (`ai_engine.main` does not exist).
4. **Virtual Environment Portability Issue:**
   - `backend/venv/pyvenv.cfg` points to an absolute path from an external machine/folder (`C:\Users\Mudit Joshi\Desktop\Digital_Twin-Evolet-main\...`). Direct script invocations like `backend\venv\Scripts\pip.exe` fail due to broken shebang paths, requiring `python -m pip` style calls.

### 4.2 Suspected Configuration Inconsistencies
1. **Port & Path Discrepancy for AI Engine:**
   - FastAPI defaults to port `8100` (`ai_engine/config.py`).
   - Frontend `frontend/src/lib/api.ts` and `frontend/.env.local` default `NEXT_PUBLIC_AI_URL` to `http://localhost:8001`. Frontend AI requests will fail with connection refused unless `NEXT_PUBLIC_AI_URL` is set to port 8100.
2. **Missing `/api` and `/ws` in `.env.example`:**
   - `.env.example` provides:
     - `NEXT_PUBLIC_API_URL=http://localhost:8000` (missing `/api`)
     - `NEXT_PUBLIC_WS_URL=ws://localhost:8000` (missing `/ws`)
   - Using `.env.example` values directly causes frontend API calls (`${API_URL}/auth/login/`) to 404, and WebSocket subscriptions (`${WS_BASE}/vitals/...`) to reject.
3. **Dual Package Naming (`medgenie` vs `nexttwin`):**
   - Both `backend/medgenie` and `backend/nexttwin` exist with identical code. `manage.py` and Dockerfile point to `medgenie`, but smart contracts, badges, and repo name use `NexTwin`.
4. **Database Configuration Mismatch:**
   - `render.yaml` provisions a Postgres database (`medgenie-db`), and `.env.example` specifies `DATABASE_URL`. However, Django `settings.py` hardcodes `sqlite3` and does not parse `DATABASE_URL`. `psycopg2` is not installed or listed in `requirements.txt`.
5. **Medical Record File Upload Handler:**
   - `RecordsView.tsx` currently displays static `mockRecords` and the "Select Files" button lacks an input handler.
   - `frontend/src/lib/api.ts` `recordsAPI.upload` passes a `FormData` object with headers defaulting to `"Content-Type": "application/json"`, which will break multipart form boundary generation.

### 4.3 Missing External Credentials & Services
The following external services are referenced in configuration but are unconfigured (set to placeholder strings or empty):
- **Cloudinary:** Not yet configured (No SDK in backend `requirements.txt`, no environment variables, no Next.js image domain).
- **Pinecone:** `PINECONE_API_KEY` (AI Engine vector similarity).
- **LiveKit:** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` (P2P video streaming fallback).
- **Twilio:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (Emergency SMS alerts).
- **Google Fit:** `GOOGLE_FIT_CLIENT_ID`, `GOOGLE_FIT_CLIENT_SECRET` (OAuth vitals ingestion).
- **Polygon / Web3:** `POLYGON_RPC_URL`, `PRIVATE_KEY` (Blockchain consent & vault contracts).

---

## 5. Security Risks for a Public Hackathon Demo

1. **Default Fallback Secret Key in Django:**
   - `backend/medgenie/settings.py` provides `'medgenie-dev-secret-key-change-in-production'` as a hardcoded default. If deployed publicly without `DJANGO_SECRET_KEY`, session and JWT signatures are forgeable.
2. **CORS Allow All in Debug Mode:**
   - `CORS_ALLOW_ALL_ORIGINS = DEBUG` is active when `DJANGO_DEBUG=True`. In a shared network demo, arbitrary origins can make cross-site requests to local APIs.
3. **Local Machine Paths in Git:**
   - `.claude/settings.local.json` exposes absolute local file system structure and user workspace paths in git history.
4. **In-Memory Channel Layer:**
   - Django Channels uses `InMemoryChannelLayer`. In production or multi-worker deployments (e.g., Gunicorn/Uvicorn with >1 worker), WebSocket signaling and alerts will not route across workers without Redis.
5. **Pre-existing Local Database (`db.sqlite3`):**
   - A local SQLite database exists on disk with 4 test user credentials and password hashes. Although ignored by git and containing dummy data, it should be sanitized or recreated cleanly before any public demonstration.

---

## 6. Smallest Recommended Next Steps

1. **Pre-Cloudinary Cleanup & Alignment:**
   - Add Cloudinary environment variable placeholders (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL`) to `.env.example`.
   - Update `.env.example` with correct frontend URL patterns (`NEXT_PUBLIC_API_URL=http://localhost:8000/api`, `NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws`, `NEXT_PUBLIC_AI_URL=http://localhost:8100`).
2. **Fix `frontend/package.json` Lint Script:**
   - Replace `"lint": "next lint"` with `"lint": "eslint src"` (or `"lint": "eslint . --ext .js,.jsx,.ts,.tsx"`).
3. **Add Cloudinary to Backend:**
   - Add `cloudinary>=1.39.0` to `backend/requirements.txt`.
   - Configure Cloudinary storage or helper utility in `backend/` for medical record attachments (imaging, prescriptions, lab reports).
4. **Update Frontend Image Domain:**
   - Add `res.cloudinary.com` to `remotePatterns` in `frontend/next.config.mjs` to support Cloudinary hosted assets.
5. **Connect `RecordsView.tsx` Upload UI:**
   - Wire up the file input element in `RecordsView.tsx` to call `recordsAPI.upload`, ensuring `Content-Type` is omitted so the browser sets the correct `multipart/form-data` boundary.

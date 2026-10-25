# NexTwin — ₹0 Production Deployment Guide

This guide describes how to deploy NexTwin across free hosting tiers without incurring any costs or activating forced 30-day database expiries.

---

## Architecture Overview (Target Cost: ₹0 / month)

| Tier | Component | Free Provider | Configuration / Limits |
|---|---|---|---|
| **Frontend** | Next.js 16 (React 19) | **Vercel** (Hobby) | Unlimited previews, fast global edge, Turbopack build |
| **Backend API** | Django 5.0 + Daphne ASGI | **Render** (Free Web Service) | 512 MB RAM, 0.1 vCPU, auto-sleep after 15m inactivity |
| **Database** | PostgreSQL 16 | **Neon** (Free Serverless) | 500 MB storage, **NO 30-day deletion**, scales to 0 when idle |
| **Media Storage** | Cloudinary | **Cloudinary** (Free Tier) | 25 monthly credits (~25 GB storage & bandwidth), signed downloads |
| **AI Engine** | FastAPI (Lightweight ML) | **Render** (Free Web Service) | Server-to-server token protection (`X-Internal-Token`) |

---

## 1. Database Provisioning (Neon Serverless PostgreSQL)

1. Sign up for a free account at [neon.tech](https://neon.tech).
2. Create a new project named `nexttwin`.
3. In the project dashboard, copy the **Pooled connection string**:
   ```
   postgresql://<user>:<password>@<endpoint>-pooler.neon.tech/neondb?sslmode=require
   ```
4. *Benefits over Render Free Postgres:* Render deletes databases automatically after 30 days. Neon provides **perpetual free storage** with zero-compute idle scaling.

---

## 2. Media Storage Setup (Cloudinary)

1. Sign up for free at [cloudinary.com](https://cloudinary.com).
2. From the dashboard, retrieve:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. All medical documents are stored under `type: authenticated` with signed time-limited access and backend streaming proxy (`/api/records/<id>/content/`).

---

## 3. Backend & AI Engine Deployment (Render Blueprint)

1. Push your repository branch `deploy/nextwin-free-hosting` to GitHub.
2. Sign in to [render.com](https://render.com).
3. Click **New +** -> **Blueprint**.
4. Connect the repository `FL4K1/Nextwin_v1` and select branch `deploy/nextwin-free-hosting`.
5. Render detects [`render.yaml`](render.yaml) and creates:
   - `nexttwin-api` (Django Web Service)
   - `nexttwin-ai-engine` (FastAPI Web Service)
6. Configure the prompted environment variables on Render for `nexttwin-api`:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string from Step 1.
   - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name.
   - `CLOUDINARY_API_KEY`: Your Cloudinary API key.
   - `CLOUDINARY_API_SECRET`: Your Cloudinary API secret.
7. Click **Apply**.
8. Render will automatically:
   - Install dependencies.
   - Apply Django migrations to your Neon database.
   - Launch Daphne ASGI server on `nexttwin-api`.
   - Launch Uvicorn server on `nexttwin-ai-engine`.

---

## 4. Frontend Deployment (Vercel)

1. Sign in to [vercel.com](https://vercel.com).
2. Click **Add New Project** and import `FL4K1/Nextwin_v1`.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, configure:
   - `NEXT_PUBLIC_API_URL`: `https://nexttwin-api.onrender.com/api`
   - `NEXT_PUBLIC_WS_URL`: `wss://nexttwin-api.onrender.com/ws`
   - `NEXT_PUBLIC_AI_URL`: `https://nexttwin-api.onrender.com/api`
5. Click **Deploy**.

---

## 5. Post-Deployment Verification Checklist

- [ ] **API Health Check:** Visit `https://nexttwin-api.onrender.com/health/` -> Expect `{"status": "healthy", "service": "nexttwin-api"}`.
- [ ] **AI Engine Health:** Visit `https://nexttwin-ai-engine.onrender.com/` -> Expect `{"status": "healthy", "version": "1.1.0"}`.
- [ ] **User Registration & Login:** Create a new account on your Vercel deployment URL (`https://your-app.vercel.app/register`).
- [ ] **JWT Refresh Flow:** Confirm token persistence across tab reloads.
- [ ] **Records Upload & Preview:** Upload a PDF test record and verify authenticated preview/download.
- [ ] **Digital Twin Simulation:** Run scenario simulation in Treatment Simulator.

---

## 6. Free-Tier Limitations & Operational Notes

1. **Cold Starts:** Free Render services spin down after 15 minutes of inactivity. The first request after sleep takes ~30–50 seconds while the container initializes.
2. **Ephemeral Disk:** Render containers have ephemeral storage. All patient records and profile avatars are stored in Cloudinary, ensuring zero data loss on restart.
3. **AI Inference:** The AI engine uses physiological baseline heuristics and scikit-learn models on free tier to stay strictly within 512 MB RAM limits.

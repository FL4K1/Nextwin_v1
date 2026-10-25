# NexTwin — Local Development Guide

This guide describes how to run and test the complete NexTwin multi-tier system locally on your development machine.

---

## 1. System Architecture & Port Allocation

| Component | Technology | Default Port | Entry Point |
|---|---|---|---|
| **Frontend** | Next.js 16 (React 19) | `3000` | `frontend/` (`npm run dev`) |
| **Backend API** | Django 5.0 REST Framework | `8000` | `backend/manage.py runserver 8000` |
| **AI Engine** | FastAPI (Python) | `8100` | `ai_engine/server.py` |
| **Database** | SQLite (dev default) | Local file | `backend/db.sqlite3` |
| **Media Storage** | Cloudinary | Cloud | Authenticated private delivery |

---

## 2. Prerequisites

- **Python 3.10 – 3.13** (System Python or virtual environment)
- **Node.js 18+** (v20+ recommended)
- **npm 9+**
- **Git**

---

## 3. Environment Configuration

Copy the example environment file:
```bash
cp .env.example backend/.env
```

Ensure `backend/.env` contains the required keys:
```env
DJANGO_SECRET_KEY=dev-local-secret-key-for-development-only
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DATABASE_URL=sqlite:///db.sqlite3

JWT_SECRET_KEY=dev-jwt-secret-key
JWT_ACCESS_TOKEN_LIFETIME=60
JWT_REFRESH_TOKEN_LIFETIME=1440

AI_ENGINE_URL=http://localhost:8100

# Cloudinary (Required for live record attachments & avatars)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_AI_URL=http://localhost:8100
```

---

## 4. Backend Setup (Django)

1. **Activate virtual environment:**
   ```powershell
   # Windows PowerShell:
   & "backend\venv\Scripts\Activate.ps1"
   # Linux/macOS:
   source backend/venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Apply database migrations:**
   ```bash
   python backend/manage.py migrate
   ```

4. **Run system checks & tests:**
   ```bash
   python backend/manage.py check
   python backend/manage.py test accounts records communication
   ```

5. **Start Django development server:**
   ```bash
   python backend/manage.py runserver 8000
   ```

---

## 5. AI Engine Setup (FastAPI)

1. **Install dependencies:**
   ```bash
   pip install -r ai_engine/requirements.txt
   ```

2. **Start the AI service:**
   ```bash
   python ai_engine/server.py
   ```
   The service listens on `http://localhost:8100`.

3. **Verify AI Engine health:**
   ```bash
   curl http://localhost:8100/
   # Returns: {"status": "healthy", "version": "1.1.0"}
   ```

---

## 6. Frontend Setup (Next.js)

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Create local environment file (`frontend/.env.local`):**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
   NEXT_PUBLIC_AI_URL=http://localhost:8100
   ```

3. **Type check & Build check:**
   ```bash
   npx tsc --noEmit
   npm run build
   ```

4. **Start Next.js dev server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 7. Testing Checklist

- **User Registration & Login:** Visit `http://localhost:3000/login` or `http://localhost:3000/register`.
- **Medical Records:** Navigate to the Medical Records view, upload a PDF/image, preview the asset, and download it.
- **AI Analytics:** Digital twin health state and simulated trajectory view.
- **Backend Test Suite:**
  ```bash
  python backend/manage.py test accounts records communication
  ```

---

## 8. Common Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `Given token not valid for any token type` | Stale or unauthenticated JWT | Log in through `/login` to obtain fresh JWT tokens |
| `deny or ACL failure` (Cloudinary) | Direct CDN access on authenticated assets | URL must be generated via `private_download_url` or fetched via `/api/records/<id>/content/` proxy |
| `No module named 'torch'` | PyTorch not installed in AI env | Baseline heuristic models operate without neural weights; install full PyTorch stack if neural inference is required |
| Port conflict on 8000 or 8100 | Background process holding port | Find PID with `netstat -ano \| findstr :8000` and terminate it |

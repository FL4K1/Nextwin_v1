# 🧬 NexTwin: Next-Gen Digital Twin Healthcare System

[!\[Version](https://img.shields.io/badge/version-2.1.0--prod-blueviolet)](https://github.com/martian3062/Digital\_Twin-Evolet)
[!\[Tech Stack](https://img.shields.io/badge/stack-Django%252520%25257C%252520Next.js%252520%25257C%252520FastAPI%252520%25257C%252520Web3-brightgreen)](https://github.com/martian3062/Digital\_Twin-Evolet)
[!\[License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> A state-of-the-art, privacy-centric healthcare platform that utilizes \\\\\\\*\\\\\\\*AI Digital Twins\\\\\\\*\\\\\\\*, \\\\\\\*\\\\\\\*WebRTC Signaling\\\\\\\*\\\\\\\*, and \\\\\\\*\\\\\\\*Blockchain Verification\\\\\\\*\\\\\\\* to provide secure, real-time medical consultation and predictive health modeling.

\---

## 🌟 Core Features

### 🧠 AI Digital Twin Engine

* **Predictive Modeling**: Temporal Transformers and GNNs analyze your vital history to simulate future health states.
* **Anomaly Detection**: Real-time monitoring of biometrics with smart alerts for heart rate, SpO2, and sleep patterns.
* **AI Scribe**: Automatic voice-to-text medical transcription during consultations using Whisper AI.

### 🎥 Secure P2P Consultations

* **Stateless JWT Audio/Video**: Hardened WebRTC signaling gateway with identity-locked room access.
* **Consultation Authorization**: Strict backend verification ensuring only the assigned Doctor and Patient can join a session.
* **Encrypted Data Stream**: Peer-to-peer communication reducing server overhead and maximizing privacy.

### 🔐 Decentralized Security (Phase 3 Ready)

* **NexTwin Vault**: Blockchain-backed medical record access control on Polygon/Ceramic.
* **DID Identity**: Decentralized Identifiers (DIDs) for patient-owned health data.
* **Offline-First Resilience**: Full PWA support with IndexedDB background sync for low-connectivity environments.

\---

## 🏗️ System Architecture

```mermaid
graph TD
    User((Patient/Doctor)) -->|Next.js 14| Frontend\\\\\\\[MediBook UI - PWA]
    
    subgraph "Core Backend"
    Frontend <-->|JWT / Websockets| Django\\\\\\\[Django API \\\\\\\& Signaling]
    Django <-->|ORM| DB\\\\\\\[(PostgreSQL/Supabase)]
    Django <-->|Redis Channel Layer| Signaling\\\\\\\[LiveKit/Signaling Gateway]
    end
    
    subgraph "AI \\\\\\\& Analytic Services"
    Django <-->|REST| Fast\\\\\\\[FastAPI AI Engine]
    Fast <-->|Embeddings| Pinecone\\\\\\\[(Vector DB)]
    Fast <-->|Inference| Transformers\\\\\\\[PyTorch / GNN]
    end
    
    subgraph "Distributed Data"
    Frontend <-->|Web3.js| Polygon\\\\\\\[Polygon Health Records]
    Frontend <-->|IndexedDB| Offline\\\\\\\[(Local Sync Buffer)]
    end
```

\---

## 🚀 Getting Started

### 📋 Prerequisites

* **Python 3.10+** (for Backend \& AI)
* **Node.js 18+** (for Frontend)
* **Redis** (for Channels/WebSockets)
* **Git**

### 1\. Backend API (Django)

```bash
cd backend
python -m venv venv \\\\\\\&\\\\\\\& source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver  # Runs on Port 8000
```

### 2\. AI Engine (FastAPI)

```bash
cd ai\\\\\\\_engine
pip install -r requirements.txt
python server.py  # Runs on Port 8100
```

### 3\. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev  # Runs on Port 3000
```

\---

## 🛡️ Security Hardening

NexTwin utilizes a multi-layer security approach:

* **JWT-over-WS**: WebSocket connections are authenticated via stateless JWT tokens passed in query strings.
* **Consultation Locking**: Room IDs are tied to database-backed Consultation objects. Unassigned users are automatically disconnected with a `4003 Unauthorized` close code.
* **Environment Isolation**: Sensitive keys for Google Fit, Twilio, and Polygon are strictly isolated in `.env`.

> \\\\\\\[!IMPORTANT]
> To verify signaling security, you can run the internal test suite:
> `python scripts/verify\\\\\\\_signaling.py`

\---

## 📄 License

Distributed under the MIT License. Built for the **AMTZ Digital Twin Initiative**.


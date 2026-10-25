"""MedGenie AI Engine — FastAPI server for Digital Twin intelligence.
IDF-aligned: GNN, Transformer, Causal AI, Behavioral, Geospatial, Federated Learning, Similarity.
"""

import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn

from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("medgenie-ai")

app = FastAPI(
    title="MedGenie AI Engine",
    description="Digital Twin AI Engine — GNN + Transformer + Causal + Behavioral + Geo + Federated",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERNAL_SECRET = os.getenv("AI_ENGINE_SECRET_KEY", "")

@app.middleware("http")
async def verify_internal_secret(request: Request, call_next):
    # Allow health checks and OpenAPI docs without token
    if request.url.path in ["/", "/health", "/docs", "/openapi.json"]:
        return await call_next(request)
    if INTERNAL_SECRET:
        token = request.headers.get("X-Internal-Token")
        if token != INTERNAL_SECRET:
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized: Invalid or missing X-Internal-Token"}
            )
    return await call_next(request)


# === Request Models ===

class PredictionRequest(BaseModel):
    patient_id: Optional[str] = "default-patient"
    data: Optional[dict] = None
    vitals: Optional[List[dict]] = None
    transcript: Optional[str] = None
    text: Optional[str] = None

class RiskScoreRequest(BaseModel):
    patient_id: Optional[str] = "default-patient"

class SimulationRequest(BaseModel):
    patient_id: Optional[str] = "default-patient"
    scenario: Optional[dict] = None
    parameter: Optional[str] = None
    change: Optional[float] = None
    duration_days: Optional[int] = None

class AnomalyRequest(BaseModel):
    patient_id: Optional[str] = "default-patient"
    data: Optional[dict] = None
    vitals: Optional[List[dict]] = None

class SimilarityRequest(BaseModel):
    patient_id: str
    vitals: Optional[List[dict]] = None
    top_k: Optional[int] = 3

class BehavioralRequest(BaseModel):
    patient_id: str
    vitals: Optional[List[dict]] = None
    voice_text: Optional[str] = ""
    sleep_hours: Optional[float] = 7.0
    activity_minutes: Optional[float] = 30.0

class GeospatialRequest(BaseModel):
    patient_id: str
    lat: float
    lng: float
    risk_scores: Optional[dict] = None

class FederatedUpdateRequest(BaseModel):
    device_id: str
    local_gradients: List[float]
    data_size: int

class HealthResponse(BaseModel):
    status: str
    version: str


# === Core Digital Twin Endpoints ===

@app.get("/", response_model=HealthResponse)
async def health():
    return {"status": "healthy", "version": "1.1.0"}


@app.post("/predict")
async def predict(request: PredictionRequest):
    """Full neural prediction pipeline — GNN + Transformer ensemble."""
    from models.digital_twin import DigitalTwin
    try:
        pid = request.patient_id or "default-patient"
        twin = DigitalTwin(pid)
        vitals = request.vitals or (request.data.get('vitals', []) if request.data else [])
        state = twin.update(vitals)
        return {
            'patient_id': request.patient_id,
            'predictions': state.get('predicted_events', []),
            'risk_scores': state.get('risk_scores', {}),
            'anomaly_index': state.get('anomaly_index', 0.0),
            'status': 'success',
            'model_version': 'v1.1.0-neural'
        }
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/risk-score/{patient_id}")
async def risk_score_get(patient_id: str):
    """Multi-dimensional risk scoring via GET."""
    from pipelines.risk_scoring import calculate_risk_scores
    try:
        return calculate_risk_scores(patient_id)
    except Exception as e:
        logger.error(f"Risk score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/risk-score")
async def risk_score(request: RiskScoreRequest):
    """Multi-dimensional risk scoring via Digital Twin state."""
    from pipelines.risk_scoring import calculate_risk_scores
    try:
        pid = request.patient_id or "default-patient"
        result = calculate_risk_scores(pid)
        return result
    except Exception as e:
        logger.error(f"Risk score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulate")
async def simulate_scenario(request: SimulationRequest):
    """What-If causal simulation — IDF Step 6."""
    from pipelines.simulation import run_simulation
    try:
        pid = request.patient_id or "default-patient"
        scenario = request.scenario or {}
        if not scenario and request.parameter:
            scenario = {
                'parameter': request.parameter,
                'change': request.change or 0.0,
                'duration_days': request.duration_days or 30
            }
        result = run_simulation(pid, scenario)
        return result
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === IDF Step 17: Anomaly Detection ===

@app.post("/detect-anomalies")
async def detect_anomalies(request: AnomalyRequest):
    """Real-time anomaly detection across vital signs."""
    from pipelines.anomaly_detection import detect_anomalies as _detect
    try:
        result = _detect(request.patient_id, request.data)
        return result
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === IDF Step 10 & 11: Voice & AI Scribe ===

@app.post("/scribe")
async def scribe(request: PredictionRequest):
    """AI clinical scribe — consultation transcript → structured summary."""
    from pipelines.scribe import generate_clinical_summary
    try:
        transcript = request.transcript or (request.data or {}).get("transcript", "")
        return generate_clinical_summary(transcript)
    except Exception as e:
        logger.error(f"Scribe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/voice-log")
async def voice_log(request: PredictionRequest):
    """Real-time voice symptom extraction."""
    from pipelines.scribe import extract_voice_symptoms
    try:
        text = request.text or (request.data or {}).get("text", "")
        return extract_voice_symptoms(text)
    except Exception as e:
        logger.error(f"Voice log error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === IDF Step 16: Patient Similarity Engine ===

@app.post("/patient-similarity")
async def patient_similarity(request: SimilarityRequest):
    """Anonymized patient cohort matching for treatment recommendations."""
    from pipelines.similarity import compute_patient_similarity
    try:
        return compute_patient_similarity(
            request.patient_id,
            request.vitals or [],
            request.top_k or 3,
        )
    except Exception as e:
        logger.error(f"Similarity error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === IDF Step 15: Behavioral & Emotional AI ===

@app.post("/behavioral-analysis")
async def behavioral_analysis(request: BehavioralRequest):
    """Stress index, mood, activity readiness from wearable + voice data."""
    from pipelines.behavioral import analyze_behavioral_state
    try:
        data = {
            "vitals": request.vitals or [],
            "voice_text": request.voice_text or "",
            "sleep_hours": request.sleep_hours or 7.0,
            "activity_minutes": request.activity_minutes or 30.0,
        }
        return analyze_behavioral_state(request.patient_id, data)
    except Exception as e:
        logger.error(f"Behavioral analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === IDF Step 12: Geospatial Health Intelligence ===

@app.post("/geospatial")
async def geospatial(request: GeospatialRequest):
    """Environmental risk, nearby facility mapping, emergency routing."""
    from pipelines.geospatial import analyze_geospatial_context
    try:
        return analyze_geospatial_context(
            request.patient_id,
            request.lat,
            request.lng,
            request.risk_scores or {},
        )
    except Exception as e:
        logger.error(f"Geospatial error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === IDF Step 8: Federated Learning ===

@app.post("/federated/update")
async def federated_update(request: FederatedUpdateRequest):
    """Receive local model update from edge device (FedAvg aggregation)."""
    from pipelines.federated import submit_local_update
    try:
        return submit_local_update(request.device_id, request.local_gradients, request.data_size)
    except Exception as e:
        logger.error(f"Federated update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/federated/model")
async def federated_model():
    """Return current global model for redistribution to edge devices."""
    from pipelines.federated import get_global_model
    return get_global_model()


@app.get("/federated/status")
async def federated_status():
    """Federation round status and accuracy metrics."""
    from pipelines.federated import get_federation_status
    return get_federation_status()


# === Model Info ===

@app.get("/model-info")
async def model_info():
    return {
        "models": {
            "gnn": {"name": "HealthGNN", "version": "v0.1", "status": "active"},
            "transformer": {"name": "TemporalHealthTransformer", "version": "v0.1", "status": "active"},
            "causal": {"name": "CausalInferenceEngine", "version": "v0.1", "status": "active"},
            "behavioral": {"name": "BehavioralStateAnalyzer", "version": "v1.0", "status": "active"},
            "similarity": {"name": "PatientSimilarityEngine", "version": "v1.0", "status": "active"},
            "geospatial": {"name": "GeoHealthIntelligence", "version": "v1.0", "status": "active"},
            "federated": {"name": "FedAvgAggregator", "version": "v1.0", "status": "active"},
        },
        "idf_compliance": "MedGenie IDF v1.0 — 18-step pipeline aligned",
    }


if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
    )

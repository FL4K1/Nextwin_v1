// API Configuration and Fetch Helpers
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8001";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

// ─── Auth Token Management ─────────────────────────────────
let accessToken: string | null = null;

export function setToken(token: string) {
  accessToken = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("medgenie_token", token);
  }
}

export function getToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem("medgenie_token");
  }
  return null;
}

export function clearToken() {
  accessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("medgenie_token");
  }
}

// ─── Fetch Wrapper ──────────────────────────────────────────
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  base = API_BASE
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData.detail || errorData.message || response.statusText, errorData);
  }

  return response.json();
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

// ─── Auth API ───────────────────────────────────────────────
export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "patient" | "doctor" | "admin";
  did_identifier?: string;
  wallet_address?: string;
}

export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    apiFetch<LoginResponse>("/auth/login/", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  register: (data: { username: string; email: string; password: string; role?: string }) =>
    apiFetch<UserProfile>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getProfile: () => apiFetch<UserProfile>("/auth/me/"),

  refreshToken: (refresh: string) =>
    apiFetch<{ access: string }>("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }),
};

// ─── Vitals API ─────────────────────────────────────────────
export interface VitalReading {
  id: string;
  metric_type: string;
  value: number;
  unit: string;
  data_source: string;
  recorded_at: string;
  is_anomaly: boolean;
  metadata: Record<string, unknown>;
}

export interface VitalsListResponse {
  count: number;
  results: VitalReading[];
  next: string | null;
  previous: string | null;
}

export interface DigitalTwinState {
  id: string;
  risk_scores: Record<string, number>;
  active_conditions: string[];
  predicted_events: Array<{
    event: string;
    probability: number;
    timeframe: string;
  }>;
  last_updated: string;
  model_version: string;
}

export const vitalsAPI = {
  list: (params?: { metric_type?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.metric_type) searchParams.set("metric_type", params.metric_type);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    return apiFetch<VitalsListResponse>(`/patients/vitals/${query ? `?${query}` : ""}`);
  },

  create: (data: { metric_type: string; value: number; unit: string; recorded_at: string }) =>
    apiFetch<VitalReading>("/patients/vitals/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createSymptom: (data: { text: string; recorded_at: string }) =>
    apiFetch<Record<string, unknown>>("/voice-log/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getLatest: () => apiFetch<VitalReading[]>("/patients/vitals/latest/"),

  getTwinState: () => apiFetch<DigitalTwinState>("/patients/twin/"),

  syncGoogleFit: () =>
    apiFetch<{ synced: number; anomalies: number }>("/googlefit/sync/", {
      method: "POST",
    }),

  getTimelineData: (hours = 24) =>
    apiFetch<VitalReading[]>(`/patients/vitals/timeline/?hours=${hours}`),
};

// ─── Records API ────────────────────────────────────────────
export interface MedicalRecord {
  id: string;
  title: string;
  record_type: string;
  description: string;
  file_url: string;
  ipfs_cid: string;
  created_at: string;
  provider: string;
  is_encrypted: boolean;
}

export interface Consultation {
  id: string;
  doctor: { id: string; first_name: string; last_name: string; specialization: string };
  patient: { id: string; first_name: string; last_name: string };
  scheduled_at: string;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";
  room_id: string;
  notes: string;
}

export const recordsAPI = {
  list: () => apiFetch<{ results: MedicalRecord[] }>("/patients/records/"),
  get: (id: string) => apiFetch<MedicalRecord>(`/records/${id}/`),
  upload: (formData: FormData) =>
    apiFetch<MedicalRecord>("/patients/records/", {
      method: "POST",
      body: formData,
      headers: {},
    }),
};

export const consultationAPI = {
  list: () => apiFetch<{ results: Consultation[] }>("/consultations/"),
  create: (data: { doctor_id: string; scheduled_at: string; notes?: string }) =>
    apiFetch<Consultation>("/consultations/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  join: (id: string) => apiFetch<{ room_url: string; token: string }>(`/consultations/${id}/room/`),
};

// ─── Communication API (Signaling) ──────────────────────────
export const communicationAPI = {
  sendSignal: (data: { room_id: string; sender_type: string; signal_data: unknown }) =>
    apiFetch<{ status: string }>("/comm/signal/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSignals: (room_id: string) =>
    apiFetch<unknown[]>(`/comm/signal/${room_id}/`),

  clearSignals: (room_id: string) =>
    apiFetch<{ status: string }>(`/comm/clear/${room_id}/`, {
      method: "DELETE",
    }),
};

// ─── Alerts API ─────────────────────────────────────────────
export interface Alert {
  id: string;
  alert_type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metric_type: string;
  metric_value: number;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export interface SimulationResponse {
  original_risks: Record<string, number>;
  adjusted_risks: Record<string, number>;
  metric_deltas: Record<string, number>;
  clinical_summary: string[];
  scenario: Record<string, boolean>;
  model_version?: string;
}

export const alertsAPI = {
  list: (params?: { acknowledged?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.acknowledged !== undefined)
      searchParams.set("acknowledged", String(params.acknowledged));
    const query = searchParams.toString();
    return apiFetch<{ results: Alert[] }>(`/alerts/${query ? `?${query}` : ""}`);
  },
  acknowledge: (id: string) =>
    apiFetch<Alert>(`/alerts/${id}/acknowledge/`, { method: "POST" }),
};

// ─── AI Engine API ──────────────────────────────────────────
export interface PredictionResult {
  risk_scores: Record<string, number>;
  predictions: Array<{ event: string; probability: number; timeframe: string }>;
  anomalies: Array<{ metric: string; value: number; expected_range: [number, number] }>;
  confidence: number;
  model_version: string;
}

export interface SimulationResult {
  scenario: string;
  projected_outcomes: Record<string, number>;
  recommendations: string[];
  risk_delta: Record<string, number>;
}

export const aiAPI = {
  predict: (vitalsData: Record<string, number>[]) =>
    apiFetch<PredictionResult>("/predict", { method: "POST", body: JSON.stringify({ vitals: vitalsData }) }, AI_BASE),

  riskScore: (patientId: string) =>
    apiFetch<{ risk_scores: Record<string, number> }>(`/risk-score/${patientId}`, {}, AI_BASE),

  simulate: (scenario: { parameter: string; change: number; duration_days: number }) =>
    apiFetch<SimulationResult>("/simulate", { method: "POST", body: JSON.stringify(scenario) }, AI_BASE),

  detectAnomalies: (vitals: Record<string, number>[]) =>
    apiFetch<{ anomalies: Array<{ metric: string; severity: string }> }>(
      "/detect-anomalies",
      { method: "POST", body: JSON.stringify({ vitals }) },
      AI_BASE
    ),
};

// ─── WebSocket Manager ──────────────────────────────────────
type MessageHandler = (data: Record<string, unknown>) => void;

export class VitalsWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(patientId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const token = getToken();
    const url = `${WS_BASE}/vitals/${patientId}/${token ? `?token=${token}` : ""}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[WS] Connected to vitals stream");
      this.reconnectAttempts = 0;
      this.emit("connection", { status: "connected" });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type || "vital_update", data);
        this.emit("message", data);
      } catch {
        console.error("[WS] Failed to parse message");
      }
    };

    this.ws.onclose = (event) => {
      console.log("[WS] Disconnected:", event.code);
      this.emit("connection", { status: "disconnected" });

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectAttempts++;
          this.connect(patientId);
        }, delay);
      }
    };

    this.ws.onerror = () => {
      this.emit("connection", { status: "error" });
    };
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: Record<string, unknown>) {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export const vitalsSocket = new VitalsWebSocket();

export const simulationAPI = {
  run: (patientId: string, scenario: Record<string, boolean>) =>
    apiFetch<SimulationResponse>(`/patients/twin/simulate/`, {
      method: "POST",
      body: JSON.stringify(scenario),
    }),
};

// ─── Geospatial API (IDF Step 12) ───────────────────────────
export interface GeospatialResponse {
  location: { lat: number; lng: number };
  nearby_facilities: Array<{
    name: string; type: string; distance_km: number;
    eta_minutes: number; services: string[];
  }>;
  environmental_risk: {
    aqi: number; aqi_category: string; heat_index: number;
    humidity_pct: number; pollen_level: string; risk_level: string;
  };
  emergency_route: {
    priority: string; recommended_facility: string;
    distance_km: number; eta_minutes: number; ambulance_recommended: boolean;
  };
  spatial_insights: string[];
}

export const geospatialAPI = {
  analyze: (lat: number, lng: number, risk_scores?: Record<string, number>) =>
    apiFetch<GeospatialResponse>("/geospatial/", {
      method: "POST",
      body: JSON.stringify({ lat, lng, risk_scores }),
    }),
};

// ─── Behavioral AI API (IDF Step 15) ────────────────────────
export interface BehavioralResponse {
  stress_index: number;
  mood: { label: string; valence: number; arousal: number };
  activity_readiness: number;
  sleep_quality: number;
  behavioral_risk_modifiers: Record<string, number>;
  insights: string[];
}

export const behavioralAPI = {
  analyze: (data: {
    vitals?: unknown[]; voice_text?: string;
    sleep_hours?: number; activity_minutes?: number;
  }) =>
    apiFetch<BehavioralResponse>("/behavioral/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ─── Patient Similarity API (IDF Step 16) ───────────────────
export interface SimilarityResponse {
  similar_patients: Array<{
    cohort_id: string; similarity_score: number;
    shared_conditions: string[]; treatment_outcomes: string[];
  }>;
  aggregated_recommendations: string[];
}

export const similarityAPI = {
  findSimilar: (vitals: unknown[], top_k = 3) =>
    apiFetch<SimilarityResponse>("/similarity/", {
      method: "POST",
      body: JSON.stringify({ vitals, top_k }),
    }),
};

// ─── Federated Learning API (IDF Step 8) ────────────────────
export const federatedAPI = {
  status: () => apiFetch<Record<string, unknown>>("/federated/status/"),
};

export const api = {
  get: <T>(url: string, base = AI_BASE) => apiFetch<T>(url, { method: "GET" }, base),
  post: <T>(url: string, body: unknown, base = AI_BASE) =>
    apiFetch<T>(url, { method: "POST", body: JSON.stringify(body) }, base),
  put: <T>(url: string, body: unknown, base = AI_BASE) =>
    apiFetch<T>(url, { method: "PUT", body: JSON.stringify(body) }, base),
  delete: <T>(url: string, base = AI_BASE) => apiFetch<T>(url, { method: "DELETE" }, base),
};

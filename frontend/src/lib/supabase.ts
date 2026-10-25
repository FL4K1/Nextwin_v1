import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "nexttwin_session",
  },
  db: { schema: "nexttwin" },
});

// ─── Auth helpers ────────────────────────────────────────────
export const sbAuth = {
  signUp: async (email: string, password: string, meta: { username: string; first_name?: string; last_name?: string; role?: string }) =>
    supabase.auth.signUp({ email, password, options: { data: meta } }),

  signIn: async (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signOut: () => supabase.auth.signOut(),

  getSession: () => supabase.auth.getSession(),

  getUser: () => supabase.auth.getUser(),

  onAuthStateChange: (cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
    supabase.auth.onAuthStateChange(cb),
};

// ─── Profile ─────────────────────────────────────────────────
export const sbProfiles = {
  get: async (userId: string) =>
    supabase.from("profiles").select("*").eq("id", userId).single(),

  update: async (userId: string, data: Record<string, unknown>) =>
    supabase.from("profiles").update(data).eq("id", userId),
};

// ─── Vitals ──────────────────────────────────────────────────
export const sbVitals = {
  list: async (patientId: string, metricType?: string, limit = 50) => {
    let q = supabase
      .from("vital_readings")
      .select("*")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(limit);
    if (metricType) q = q.eq("metric_type", metricType);
    return q;
  },

  insert: async (data: {
    patient_id: string; metric_type: string; value: number;
    unit: string; data_source?: string; recorded_at: string; metadata?: Record<string, unknown>;
  }) => supabase.from("vital_readings").insert(data).select().single(),

  latest: async (patientId: string) =>
    supabase.rpc("medgenie_latest_vitals", { p_patient_id: patientId }).select("*"),
};

// ─── Digital Twin State ──────────────────────────────────────
export const sbTwin = {
  get: async (patientId: string) =>
    supabase.from("digital_twin_states").select("*").eq("patient_id", patientId).single(),

  upsert: async (patientId: string, state: {
    risk_scores: Record<string, number>;
    active_conditions: string[];
    predicted_events: unknown[];
    model_version?: string;
  }) =>
    supabase.from("digital_twin_states").upsert({
      patient_id: patientId, ...state, last_updated: new Date().toISOString(),
    }, { onConflict: "patient_id" }).select().single(),
};

// ─── Medical Records ─────────────────────────────────────────
export const sbRecords = {
  list: async (patientId: string) =>
    supabase.from("medical_records").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),

  insert: async (data: {
    patient_id: string; title: string; record_type: string;
    description?: string; file_url?: string; ipfs_cid?: string;
    provider?: string; is_encrypted?: boolean;
  }) => supabase.from("medical_records").insert(data).select().single(),
};

// ─── Alerts ──────────────────────────────────────────────────
export const sbAlerts = {
  list: async (patientId: string, acknowledged?: boolean) => {
    let q = supabase.from("alerts").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
    if (acknowledged !== undefined) q = q.eq("acknowledged", acknowledged);
    return q;
  },

  acknowledge: async (alertId: string) =>
    supabase.from("alerts").update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq("id", alertId),

  insert: async (data: {
    patient_id: string; alert_type: string; severity: string;
    message: string; metric_type?: string; metric_value?: number;
  }) => supabase.from("alerts").insert(data).select().single(),
};

// ─── Consultations ───────────────────────────────────────────
export const sbConsultations = {
  list: async (userId: string) =>
    supabase.from("consultations").select(`
      *,
      patient:profiles!consultations_patient_id_fkey(id, first_name, last_name),
      doctor:profiles!consultations_doctor_id_fkey(id, first_name, last_name)
    `).or(`patient_id.eq.${userId},doctor_id.eq.${userId}`).order("scheduled_at", { ascending: false }),

  create: async (data: { patient_id: string; doctor_id: string; scheduled_at: string; notes?: string }) =>
    supabase.from("consultations").insert({ ...data, room_id: crypto.randomUUID() }).select().single(),
};

// ─── Geospatial ──────────────────────────────────────────────
export const sbGeospatial = {
  save: async (patientId: string, snapshot: Record<string, unknown>) =>
    supabase.from("geospatial_snapshots").insert({ patient_id: patientId, ...snapshot }).select().single(),

  latest: async (patientId: string) =>
    supabase.from("geospatial_snapshots").select("*").eq("patient_id", patientId)
      .order("captured_at", { ascending: false }).limit(1).single(),
};

// ─── Behavioral ──────────────────────────────────────────────
export const sbBehavioral = {
  save: async (patientId: string, snapshot: Record<string, unknown>) =>
    supabase.from("behavioral_snapshots").insert({ patient_id: patientId, ...snapshot }).select().single(),

  latest: async (patientId: string) =>
    supabase.from("behavioral_snapshots").select("*").eq("patient_id", patientId)
      .order("captured_at", { ascending: false }).limit(1).single(),
};

// ─── Similarity ──────────────────────────────────────────────
export const sbSimilarity = {
  save: async (patientId: string, snapshot: Record<string, unknown>) =>
    supabase.from("similarity_snapshots").insert({ patient_id: patientId, ...snapshot }).select().single(),

  latest: async (patientId: string) =>
    supabase.from("similarity_snapshots").select("*").eq("patient_id", patientId)
      .order("captured_at", { ascending: false }).limit(1).single(),
};

// ─── Voice Logs ──────────────────────────────────────────────
export const sbVoiceLogs = {
  insert: async (patientId: string, text: string, recordedAt: string) =>
    supabase.from("voice_logs").insert({ patient_id: patientId, text, recorded_at: recordedAt }).select().single(),

  list: async (patientId: string, limit = 20) =>
    supabase.from("voice_logs").select("*").eq("patient_id", patientId)
      .order("recorded_at", { ascending: false }).limit(limit),
};

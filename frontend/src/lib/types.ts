export interface VoiceInsight {
  insights: Array<{
    mention?: string;
    metric: string;
    value: string | number;
    confidence: number;
  }>;
}

export interface AISummary {
  summary: string;
  metadata?: {
    clinical_urgency: 'High' | 'Moderate' | 'Low';
  };
  symptoms?: string[];
  recommendations?: string[];
}

export interface VitalReading {
  id: string;
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  is_anomaly: boolean;
  data_source?: string;
  metadata?: Record<string, unknown>;
  synced?: boolean;
}

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

export interface AnomalyAlert {
  metric: string;
  value: number;
  expected_range: [number, number];
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: string;
}

"use client";

import { motion } from "framer-motion";
import { ShieldCheck, TrendingDown, TrendingUp, Cpu } from "lucide-react";
import { useRealtime } from "@/lib/realtime";
import { useEffect, useState } from "react";

function getRiskColor(value: number) {
  if (value < 0.15) return "#10b981";
  if (value < 0.3) return "#f59e0b";
  if (value < 0.5) return "#f97316";
  return "#f43f5e";
}

function getRiskLabel(value: number) {
  if (value < 0.15) return "Low";
  if (value < 0.3) return "Moderate";
  if (value < 0.5) return "Elevated";
  return "High";
}

export default function RiskScorePanel() {
  const { twinState, isSimulated } = useRealtime();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fallback data if twinState is null
  const riskScoresData = twinState?.risk_scores || {
    Cardiac: 0.12,
    Diabetes: 0.23,
    Respiratory: 0.08,
    Hypertension: 0.31,
    Stroke: 0.05,
  };

  const riskScores = Object.entries(riskScoresData).map(([label, value], index) => ({
    label,
    value: value as number,
    // Use deterministic trend to avoid hydration mismatch
    trend: mounted ? (Math.random() - 0.5) * 0.1 : 0,
  }));

  const overallHealth = 1 - (Object.values(riskScoresData).reduce((a, b) => a + (b as number), 0) / Object.keys(riskScoresData).length);

  return (
    <div className="glass-card p-5 h-full flex flex-col relative overflow-hidden group">
      {/* Background Animated Decor */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
        <Cpu size={120} />
      </div>

      <div className="flex items-center justify-between mb-5 relative z-10">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            AI Risk Assessment
            {isSimulated && (
              <span className="text-[9px] bg-white/5 px-1 py-0.5 rounded text-slate-500 uppercase tracking-widest font-bold">Mock</span>
            )}
          </h3>
          <p className="text-[11px] text-slate-600 mt-0.5">
            GNN + Transformer Analysis
          </p>
        </div>
        <ShieldCheck size={18} className="text-emerald-400 animate-pulse" />
      </div>

      {/* Overall Health Score */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10 relative z-10 backdrop-blur-sm">
        <div className="flex items-end gap-3 mb-2">
          <span className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400">
            {Math.round(overallHealth * 100)}
          </span>
          <span className="text-sm text-slate-500 mb-1 font-mono">/ 100</span>
        </div>
        <p className="text-[11px] text-slate-400 uppercase tracking-widest font-black">Overall Vitality Index</p>
        <div className="mt-3 risk-bar h-1.5 overflow-hidden">
          <motion.div
            className="risk-bar-fill h-full"
            style={{
              background: `linear-gradient(90deg, #10b981, #00f0ff, #3b82f6)`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${overallHealth * 100}%` }}
            transition={{ delay: 0.3, duration: 1.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Individual Risk Scores */}
      <div className="space-y-4 flex-1 relative z-10 overflow-y-auto pr-2 custom-scrollbar">
        {riskScores.map((risk, i) => (
          <motion.div
            key={risk.label}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="group/item"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 group-hover/item:text-slate-200 transition-colors">{risk.label}</span>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded"
                  style={{
                    color: getRiskColor(risk.value),
                    background: `${getRiskColor(risk.value)}15`,
                    border: `1px solid ${getRiskColor(risk.value)}30`
                  }}
                >
                  {getRiskLabel(risk.value)}
                </span>
                <span className="text-xs font-mono text-slate-500 font-bold">
                  {(risk.value * 100).toFixed(0)}%
                </span>
                {mounted && risk.trend > 0 ? (
                  <TrendingUp size={12} className="text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                ) : mounted && risk.trend < 0 ? (
                  <TrendingDown size={12} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                ) : null}
              </div>
            </div>
            <div className="risk-bar h-1 bg-white/[0.03] rounded-full overflow-hidden">
              <motion.div
                className="risk-bar-fill h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${getRiskColor(risk.value)}80, ${getRiskColor(risk.value)})`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${risk.value * 100}%` }}
                transition={{ delay: 0.4 + i * 0.1, duration: 1, ease: "circOut" }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.04] relative z-10">
        <p className="text-[10px] text-slate-600 text-center font-mono">
          Engine: {twinState?.model_version || "Simulated GNN v2"}
        </p>
      </div>
    </div>
  );
}

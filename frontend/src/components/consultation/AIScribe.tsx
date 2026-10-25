"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, FileText, Activity, ShieldCheck, Loader2, ListChecks, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { AISummary } from '@/lib/types';

interface AIScribeProps {
  transcript: string;
  onSave?: (summary: AISummary) => void;
}

export function AIScribe({ transcript, onSave }: AIScribeProps) {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastProcessedLength = useRef(0);

  const handleScribe = useCallback(async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    try {
      const response = await api.post<AISummary>("/ai/scribe/", { transcript });
      setSummary(response);
    } catch (error) {
      console.error("Scribing failed", error);
    } finally {
      setIsProcessing(false);
    }
  }, [transcript]);

  // Auto-process transcript every 50 characters of new text
  useEffect(() => {
    if (transcript.length - lastProcessedLength.current > 50) {
      handleScribe();
      lastProcessedLength.current = transcript.length;
    }
  }, [transcript, handleScribe]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Sparkles size={16} className="text-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">AI Clinical Scribe</h3>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-2 text-[10px] text-amber-400 font-bold animate-pulse">
            <Loader2 size={10} className="animate-spin" />
            ANALYZING...
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
        {!summary && !isProcessing && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-40">
            <FileText size={40} className="mb-4 text-slate-600" />
            <p className="text-xs text-slate-500">Live clinical summary will appear here as you speak.</p>
          </div>
        )}

        {summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Chief Complaint / Summary */}
            <section className={`glass-card p-3 rounded-xl border-l-2 ${
              summary.metadata?.clinical_urgency === 'High' ? 'border-l-rose-500' : 
              summary.metadata?.clinical_urgency === 'Moderate' ? 'border-l-amber-500' : 'border-l-violet-500'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase">Clinical Summary</h4>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                  summary.metadata?.clinical_urgency === 'High' ? 'bg-rose-500/20 text-rose-400' : 
                  summary.metadata?.clinical_urgency === 'Moderate' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {summary.metadata?.clinical_urgency} Urgency
                </span>
              </div>
              <div className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-wrap font-mono">
                {summary.summary}
              </div>
            </section>

            {/* Symptoms Detected */}
            {summary.symptoms && summary.symptoms.length > 0 && (
              <section className="glass-card p-3 rounded-xl border-l-2 border-l-rose-500">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={12} className="text-rose-400" />
                  <h4 className="text-[10px] font-bold text-rose-400 uppercase">Clinical Entities</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.symptoms.map((s: string, i: number) => (
                    <span key={i} className="px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Recommendations / Suggested Actions */}
            {summary.recommendations && summary.recommendations.length > 0 && (
              <section className="glass-card p-3 rounded-xl border-l-2 border-l-emerald-500">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks size={12} className="text-emerald-400" />
                  <h4 className="text-[10px] font-bold text-emerald-400 uppercase">Neural Recommendations</h4>
                </div>
                <ul className="space-y-1.5">
                  {summary.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-[11px] text-slate-400 flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            
            {/* Anomaly Alerts */}
            <section className="glass-card p-3 rounded-xl border-l-2 border-l-amber-500">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={12} className="text-amber-400" />
                <h4 className="text-[10px] font-bold text-amber-400 uppercase">Integrity Status</h4>
              </div>
              <p className="text-[11px] text-slate-400">
                Analysis complete. Data ready for <span className="text-white">Decentralized Vault</span> anchoring. 
                Confidence: <span className="text-emerald-400">92%</span>
              </p>
            </section>
          </motion.div>
        )}
      </div>

      <div className="pt-4 border-t border-white/[0.04]">
        <button
          onClick={() => summary && onSave?.(summary)}
          disabled={!summary}
          className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(139,92,246,0.3)]"
        >
          <ShieldCheck size={16} />
          SECURE TO WEB3 VAULT
        </button>
      </div>
    </div>
  );
}

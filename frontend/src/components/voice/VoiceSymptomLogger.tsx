"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Brain, Loader2, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { saveLogOffline } from '@/lib/db';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { toast } from 'sonner';
import { VoiceInsight } from '@/lib/types';


interface VoiceSymptomLoggerProps {
  onInsightLogged?: (insight: VoiceInsight) => void;
}

export function VoiceSymptomLogger({ onInsightLogged }: VoiceSymptomLoggerProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastInsight, setLastInsight] = useState<VoiceInsight | null>(null);
  const { isOnline } = useOfflineSync();
  const onInsightLoggedRef = React.useRef(onInsightLogged);
  useEffect(() => { onInsightLoggedRef.current = onInsightLogged; }, [onInsightLogged]);

  const handleAnalyze = useCallback(async (text: string) => {
    setIsAnalyzing(true);
    
    if (!isOnline) {
      const offlineLog = {
        id: crypto.randomUUID(),
        type: 'symptom' as const,
        data: { text, source: 'voice' },
        timestamp: new Date().toISOString(),
        synced: false
      };
      await saveLogOffline(offlineLog);
      toast.info("Offline Sync Queued", {
        description: "Clinical insight captured locally. Secure sync scheduled.",
      });
      setIsAnalyzing(false);
      setTranscript("");
      return;
    }

    try {
      const response = await api.post<VoiceInsight>("/voice-log/", { text });
      setLastInsight(response);
      if (onInsightLoggedRef.current) onInsightLoggedRef.current(response);
      
      setTimeout(() => {
        setTranscript("");
        setLastInsight(null);
      }, 5000);
    } catch (error) {
      console.error("AI Analysis failed", error);
      const fallbackLog = {
        id: crypto.randomUUID(),
        type: 'symptom' as const,
        data: { text, source: 'voice' },
        timestamp: new Date().toISOString(),
        synced: false
      };
      await saveLogOffline(fallbackLog);
      toast.error("Network Error", {
        description: "Fallback to local clinical vault successful.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [isOnline]);

  // Web Speech API Setup
  const startRecognition = useCallback(() => {
    const GlobalWindow = window as unknown as { 
      SpeechRecognition: unknown; 
      webkitSpeechRecognition: unknown; 
    };
    const SpeechRecognition = (GlobalWindow.SpeechRecognition || GlobalWindow.webkitSpeechRecognition) as {
      new(): {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: () => void;
        onend: () => void;
        onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } }; length: number; isFinal?: boolean } }) => void;
        start: () => void;
      };
    };
    
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: { 
      results: { 
        [key: number]: { [key: number]: { transcript: string } }; 
        length: number; 
        isFinal?: boolean; 
      } 
    }) => {
      const current = event.results[event.results.length - 1][0].transcript;
      setTranscript(current);
      if (event.results.isFinal) {
        handleAnalyze(current);
      }
    };

    recognition.start();
  }, [handleAnalyze]);

  return (
    <div className="relative">
      <div className="flex flex-col items-center gap-4">
        <motion.button
          onClick={startRecognition}
          disabled={isListening || isAnalyzing}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isListening 
              ? "bg-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)]" 
              : "bg-violet-600 hover:bg-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isListening && (
            <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
          )}
          
          {isAnalyzing ? (
            <Loader2 className="animate-spin text-white" size={24} />
          ) : isListening ? (
            <MicOff className="text-white" size={24} />
          ) : (
            <Mic className="text-white" size={24} />
          )}
        </motion.button>

        <AnimatePresence>
          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md"
            >
              <p className="text-xs text-slate-400 italic">“{transcript}”</p>
            </motion.div>
          )}

          {lastInsight && lastInsight.insights && lastInsight.insights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-[-80px] w-[200px] p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-lg"
            >
              <div className="flex items-center gap-2 mb-1">
                <Brain size={12} className="text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">AI Captured</span>
              </div>
              <p className="text-[10px] text-slate-300">
                Updating <span className="text-white font-medium">{lastInsight.insights[0].metric?.replace('_', ' ')}</span> state...
              </p>
              <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-emerald-500/10" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            {isListening ? "Listening..." : isAnalyzing ? "Analyzing..." : "Tap to Speak Symptom"}
          </p>
          {!isOnline && (
            <div className="flex items-center gap-1 text-[9px] text-amber-500/70 font-mono">
              <Shield size={10} />
              OFFLINE — LOCAL VAULT ACTIVE
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

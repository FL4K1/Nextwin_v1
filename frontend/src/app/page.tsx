"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/common/Sidebar";
import Header from "@/components/common/Header";
import DigitalTwinViewer from "@/components/twin/DigitalTwinViewer";
import VitalsGrid from "@/components/dashboard/VitalsGrid";
import RiskScorePanel from "@/components/dashboard/RiskScorePanel";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import TimelineChart from "@/components/dashboard/TimelineChart";
import PredictionPanel from "@/components/dashboard/PredictionPanel";
import QuickActions from "@/components/dashboard/QuickActions";
import VitalsDetailView from "@/components/views/VitalsDetailView";
import RecordsView from "@/components/views/RecordsView";
import ConsultationView from "@/components/views/ConsultationView";
import AlertsDetailView from "@/components/views/AlertsDetailView";
import MediBookView from "@/components/views/MediBookView";
import Web3VaultView from "@/components/views/Web3VaultView";
import GeospatialView from "@/components/views/GeospatialView";
import BehavioralView from "@/components/views/BehavioralView";
import SimilarityView from "@/components/views/SimilarityView";
import NotificationManager from "@/components/dashboard/NotificationManager";
import { TreatmentSimulator } from "@/components/twin/TreatmentSimulator";
import { SimulationResponse } from "@/lib/api";

function SimulatorView({ patientId }: { patientId: string }) {
  const [simResults, setSimResults] = useState<SimulationResponse | null>(null);

  return (
    <div className="space-y-6 max-h-[calc(100vh-140px)] overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="status-dot simulation animate-pulse" />
          <span className="text-blue-400 font-medium">Predictive Simulation Mode</span>
        </div>
        <div className="text-xs text-slate-500">
          Powered by GNN + Temporal Transformer v1.2
        </div>
      </div>
      
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 h-[500px] glass-card p-0 overflow-hidden relative">
          <DigitalTwinViewer simulatedRisks={simResults?.adjusted_risks} />
          <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/5 pointer-events-none">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Visual Projection</p>
            <p className="text-xs text-white/80">
              {simResults 
                ? "Showing predicted physiological state after interventions" 
                : "Awaiting intervention parameters..."}
            </p>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-7">
          <TreatmentSimulator 
            patientId={patientId} 
            onSimulationUpdate={setSimResults} 
          />
        </div>
      </div>
    </div>
  );
}

function OverviewDashboard() {
  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="status-dot online" />
          <span className="text-emerald-400">System Online</span>
        </div>

        <div className="w-px h-4 bg-white/10" />
        <span className="text-violet-400">Digital Twin v0.1.0</span>
      </div>

      {/* 3D Twin + Risk Scores */}
      <div className="grid grid-cols-12 gap-6">
        <motion.div className="col-span-12 lg:col-span-7 glass-card p-0 overflow-hidden" style={{ height: "420px" }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.6 }}>
          <div className="relative h-full">
            <div className="absolute top-4 left-5 z-10">
              <h2 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-violet-400">Digital Twin Model</h2>
              <p className="text-xs text-slate-500 mt-1">Real-time health state visualization</p>
            </div>
            <DigitalTwinViewer />
          </div>
        </motion.div>
        <motion.div className="col-span-12 lg:col-span-5" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
          <RiskScorePanel />
        </motion.div>
      </div>

      {/* Vitals Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <VitalsGrid />
      </motion.div>

      {/* Timeline + Alerts + Predictions */}
      <div className="grid grid-cols-12 gap-6">
        <motion.div className="col-span-12 lg:col-span-7 h-[400px]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <TimelineChart />
        </motion.div>
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
            <AlertsPanel />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
            <PredictionPanel />
          </motion.div>
        </div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <QuickActions />
      </motion.div>
    </div>
  );
}

const viewComponents: Record<string, React.ComponentType> = {
  overview: OverviewDashboard,
  vitals: VitalsDetailView,
  records: RecordsView,
  consultation: ConsultationView,
  alerts: AlertsDetailView,
  medibook: MediBookView,
  web3: Web3VaultView,
  simulator: () => <SimulatorView patientId="me" />,
  geospatial: GeospatialView,
  behavioral: BehavioralView,
  similarity: SimilarityView,
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const ActiveView = viewComponents[activeTab] || OverviewDashboard;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a1a] grid-bg">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <NotificationManager />
      <main className="flex-1 overflow-y-auto">
        <Header />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="p-6"
          >
            <ActiveView />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

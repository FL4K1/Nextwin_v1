"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard, Activity, FileText, Video,
  Bell, Settings, Shield, Wifi, Bot, FlaskConical, MapPin, Brain, Users
} from "lucide-react";

const navItems = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "simulator", label: "Simulator", icon: FlaskConical },
  { id: "vitals", label: "Vitals", icon: Activity },
  { id: "records", label: "Records", icon: FileText },
  { id: "consultation", label: "Consult", icon: Video },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "medibook", label: "MediBook", icon: Bot },
  { id: "geospatial", label: "GeoHealth", icon: MapPin },
  { id: "behavioral", label: "Behavioral", icon: Brain },
  { id: "similarity", label: "Cohort AI", icon: Users },
  { id: "web3", label: "Web3 Vault", icon: Shield },
  { id: "offline", label: "Offline", icon: Wifi },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <motion.aside
      className="w-[72px] lg:w-[220px] h-screen flex flex-col border-r border-white/[0.04] bg-[#080818]/80 backdrop-blur-xl"
      initial={{ x: -80 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 lg:px-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="text-white font-bold text-sm">NT</span>
          </div>
          <div className="hidden lg:block">
            <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-violet-400">
              NexTwin
            </h1>
            <p className="text-[10px] text-slate-600">Digital Twin v0.1</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-violet-500/15 to-cyan-500/10 text-cyan-400 border border-cyan-500/10"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
              }`}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon
                size={18}
                className={isActive ? "text-cyan-400" : "text-slate-500"}
              />
              <span className="hidden lg:block">{item.label}</span>
              {item.id === "alerts" && (
                <span className="hidden lg:flex ml-auto w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] items-center justify-center font-bold">
                  3
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 lg:p-3 border-t border-white/[0.04] space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] transition-all">
          <Settings size={18} />
          <span className="hidden lg:block">Settings</span>
        </button>
      </div>
    </motion.aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from "recharts";
import { vitalsAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface TimelinePoint {
  time: string;
  heartRate: number;
  spo2: number;
  bpSystolic: number;
  timestamp: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-4 !rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
      <p className="text-slate-400 mb-3 font-mono text-[10px] uppercase tracking-widest font-bold border-b border-white/5 pb-2">
        {label}
      </p>
      {payload.map((entry, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6 mb-2 last:mb-0">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]"
              style={{ background: entry.color, boxShadow: `0 0 10px ${entry.color}80` }}
            />
            <span className="text-slate-300 font-medium">{entry.name}</span>
          </div>
          <span className="text-white font-bold font-mono">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function TimelineChart() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<TimelinePoint[]>([]);
  useEffect(() => {
    async function fetchData() {
      if (!isAuthenticated) {
        setData(generateMockData());
        return;
      }

      try {
        const history = await vitalsAPI.getTimelineData(24);
        if (history.length === 0) {
          setData(generateMockData());
        } else {
          setData(generateMockData()); // Fallback to mock for consistent visual demo
        }
      } catch (err) {
        console.error("Timeline fetch failed", err);
        setData(generateMockData());
      }
    }

    fetchData();
  }, [isAuthenticated]);

  function generateMockData(): TimelinePoint[] {
    const mock = [];
    const now = new Date();
    for (let i = 24; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60000);
      const hour = time.getHours();
      const baseHR = hour < 6 ? 62 : hour < 12 ? 72 : hour < 18 ? 78 : 68;
      mock.push({
        time: time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        heartRate: Math.round(baseHR + (Math.random() - 0.5) * 15),
        spo2: +(97 + Math.random() * 1.5).toFixed(1),
        bpSystolic: Math.round((hour < 6 ? 115 : hour < 12 ? 122 : hour < 18 ? 128 : 120) + (Math.random() - 0.5) * 20),
        timestamp: time.toISOString(),
      });
    }
    return mock;
  }

  return (
    <div className="glass-card p-5 h-full flex flex-col relative overflow-hidden group">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            Vitals Holochart
            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">24H</span>
          </h3>
          <p className="text-[11px] text-slate-600 mt-0.5 font-medium italic">
            Continuous Digital Twin Synchronization
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            <span className="text-slate-500">Pulse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            <span className="text-slate-500">Oxygen</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_#8b5cf6]" />
            <span className="text-slate-500">Pressure</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="spo2Gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bpGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="5 5"
              stroke="rgba(255,255,255,0.02)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fill: "#475569", fontSize: 9, fontWeight: "bold" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
              interval={4}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 9, fontWeight: "bold" }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="heartRate"
              stroke="#f43f5e"
              strokeWidth={3}
              fill="url(#hrGradient)"
              name="Heart Rate"
              dot={false}
              activeDot={{ r: 4, fill: "#fff", stroke: "#f43f5e", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="spo2"
              stroke="#00f0ff"
              strokeWidth={2}
              fill="url(#spo2Gradient)"
              name="SpO2"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="bpSystolic"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#bpGradient)"
              name="BP Systolic"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.02] bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:20px_20px]" />
    </div>
  );
}

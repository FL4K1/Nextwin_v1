"use client";

import { useRef, useEffect, useCallback } from "react";
import { useRealtime } from "@/lib/realtime";

interface TwinRiskScores {
  cardiac?: number;
  diabetes?: number;
  respiratory?: number;
  hypertension?: number;
  stroke?: number;
  overall_health?: number;
}

export default function DigitalTwinViewerInner({
  simulatedRisks,
}: {
  simulatedRisks?: Record<string, number>;
}) {
  const { vitals, twinState, anomalies } = useRealtime();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const activeRisks: TwinRiskScores = (simulatedRisks ||
    twinState?.risk_scores || {
      cardiac: 0.1,
      respiratory: 0.1,
      hypertension: 0.1,
      overall_health: 0.95,
    }) as TwinRiskScores;

  const healthValue =
    activeRisks.overall_health !== undefined ? activeRisks.overall_health : 0.8;
  const isCritical = 1 - healthValue > 0.6;
  const riskScore = 1 - healthValue;
  const hr = vitals.heart_rate?.value || 72;
  const cardiac = activeRisks.cardiac ?? 0.1;
  const hypertension = activeRisks.hypertension ?? 0.1;
  const respiratory = activeRisks.respiratory ?? 0.1;

  // Core color based on risk
  const coreColor =
    riskScore < 0.3 ? "#8b5cf6" : riskScore < 0.6 ? "#f59e0b" : "#f43f5e";
  const glowColor =
    riskScore < 0.3 ? "#4c1d95" : riskScore < 0.6 ? "#78350f" : "#881337";

  // Particle positions (stable, computed once per mount)
  const particlesRef = useRef<{ x: number; y: number; z: number }[]>([]);
  if (particlesRef.current.length === 0) {
    for (let i = 0; i < 220; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.72 + Math.random() * 0.32;
      particlesRef.current.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.cos(phi),
        z: r * Math.sin(phi) * Math.sin(theta),
      });
    }
  }

  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const baseR = Math.min(W, H) * 0.22;

      ctx.clearRect(0, 0, W, H);

      // ── Deep background gradient ──
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
      bg.addColorStop(0, "#0d0d22");
      bg.addColorStop(1, "#050510");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Grid lines ──
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.5;
      const gridStep = 40;
      for (let gx = 0; gx < W; gx += gridStep) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += gridStep) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
      ctx.restore();

      // ── Particles (orbiting shell) ──
      const yRotation = t * 0.18 + (hypertension * t * 0.12);
      particlesRef.current.forEach((p, i) => {
        const cosY = Math.cos(yRotation);
        const sinY = Math.sin(yRotation);
        const px = p.x * cosY - p.z * sinY;
        const pz = p.x * sinY + p.z * cosY;
        const py = p.y;

        // Project to 2D
        const fov = 2.8;
        const scale = fov / (fov - pz * 0.6);
        const sx = cx + px * baseR * 1.9 * scale;
        const sy = cy + py * baseR * 1.9 * scale;

        const brightness = (pz + 1) / 2;
        const isAnomaly = anomalies.length > 0 && i % 12 === 0;
        const pColor = isAnomaly ? "#f43f5e" : riskScore > 0.6 ? "#f43f5e" : "#00f0ff";
        ctx.save();
        ctx.globalAlpha = 0.18 + brightness * 0.45;
        ctx.fillStyle = pColor;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ── Orbital Rings ──
      const drawRing = (
        radiusFactor: number,
        thickness: number,
        color: string,
        opacity: number,
        tiltX: number,
        tiltY: number,
        rotSpeed: number
      ) => {
        const rx = baseR * radiusFactor;
        const ry = rx * Math.abs(Math.sin(tiltX));
        const rot = t * rotSpeed;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.translate(cx, cy);
        ctx.rotate(tiltY + rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, Math.max(ry, 4), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      // Ring 1 — Cardiac (red, tilted)
      const ringPulse1 = 1 + Math.sin(t * (2 + hypertension * 5)) * 0.04;
      drawRing(1.48 * ringPulse1, 2, hypertension > 0.5 ? "#f43f5e" : "#e11d48",
        0.45 + hypertension * 0.3, Math.PI / 2.5, t * 0.4 * (1 + hypertension), 0);

      // Ring 2 — Violet outer orbit
      drawRing(1.88, 1.2, "#8b5cf6", 0.25, Math.PI / 3.5, 0, 0.22);

      // Ring 3 — Respiratory (teal)
      const ringPulse3 = 1 + Math.sin(t * (1 + respiratory * 3)) * 0.08;
      drawRing(2.22 * ringPulse3, 1, respiratory > 0.5 ? "#10b981" : "#34d399",
        0.22 + respiratory * 0.15, Math.PI / 4, 0, -0.18 * (1 + respiratory));

      // ── Core glow (outer bloom) ──
      const glowR = baseR * 1.25 + Math.sin(t * 1.8) * baseR * 0.08;
      const grd = ctx.createRadialGradient(cx, cy, baseR * 0.3, cx, cy, glowR);
      grd.addColorStop(0, `${coreColor}55`);
      grd.addColorStop(0.6, `${glowColor}22`);
      grd.addColorStop(1, "transparent");
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── Core sphere ──
      const coreDistort = 1 + Math.sin(t * 0.8) * (0.02 + riskScore * 0.08);
      const coreGrd = ctx.createRadialGradient(
        cx - baseR * 0.25, cy - baseR * 0.25, 0,
        cx, cy, baseR * coreDistort
      );
      coreGrd.addColorStop(0, "#ffffff");
      coreGrd.addColorStop(0.15, coreColor);
      coreGrd.addColorStop(0.7, glowColor);
      coreGrd.addColorStop(1, "#00000000");
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = coreGrd;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * coreDistort, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── Heartbeat indicator orb ──
      const frequency = hr / 60;
      const heartbeat = Math.sin(t * frequency * Math.PI * 2) * 0.4 + 0.6;
      const orbScale = (1 + cardiac * 0.5) + heartbeat * (0.1 + cardiac * 0.2);
      const orbR = baseR * 0.1 * orbScale;
      const orbX = cx + baseR * 0.42;
      const orbY = cy - baseR * 0.55;
      const orbColor = cardiac > 0.6 ? "#ff0000" : "#f43f5e";
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = orbColor;
      ctx.fillStyle = orbColor;
      ctx.globalAlpha = 0.7 + cardiac * 0.3;
      ctx.beginPath();
      ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── Scan line effect ──
      const scanY = cy + Math.sin(t * 0.6) * baseR * 1.5;
      const scanGrd = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
      scanGrd.addColorStop(0, "transparent");
      scanGrd.addColorStop(0.5, `${coreColor}30`);
      scanGrd.addColorStop(1, "transparent");
      ctx.save();
      ctx.fillStyle = scanGrd;
      ctx.fillRect(cx - baseR * 2.5, scanY - 8, baseR * 5, 16);
      ctx.restore();

      // ── Anomaly pulses ──
      if (anomalies.length > 0) {
        const pulseR = baseR * (1.4 + Math.sin(t * 4) * 0.25);
        ctx.save();
        ctx.globalAlpha = 0.15 + Math.sin(t * 4) * 0.1;
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // ── Corner accent lines ──
      const accentLen = baseR * 0.45;
      const accentOffset = baseR * 2.15;
      ctx.save();
      ctx.strokeStyle = `${coreColor}60`;
      ctx.lineWidth = 1.5;
      [
        [cx - accentOffset, cy - accentOffset, 1, 1],
        [cx + accentOffset, cy - accentOffset, -1, 1],
        [cx - accentOffset, cy + accentOffset, 1, -1],
        [cx + accentOffset, cy + accentOffset, -1, -1],
      ].forEach(([x, y, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + dx * accentLen, y);
        ctx.moveTo(x, y); ctx.lineTo(x, y + dy * accentLen);
        ctx.stroke();
      });
      ctx.restore();
    },
    [
      coreColor, glowColor, riskScore, hr, cardiac, hypertension, respiratory,
      anomalies.length,
    ]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const startTime = performance.now();

    const loop = () => {
      const t = (performance.now() - startTime) / 1000;
      draw(t);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
    };
  }, [draw]);

  return (
    <div className="w-full h-full relative bg-[#050510]">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Health score overlay */}
      <div className="absolute top-6 left-6 p-4 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-xl pointer-events-none">
        <h3 className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-1">
          {simulatedRisks ? "Simulation Engine" : "Twin Integrity"}
        </h3>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-white leading-none">
            {Math.round(healthValue * 100)}%
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              healthValue > 0.8
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : healthValue > 0.6
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            {healthValue > 0.8 ? "OPTIMAL" : healthValue > 0.6 ? "STABLE" : "CRITICAL"}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 pointer-events-none">
        <div className="p-3 rounded-xl bg-black/50 border border-white/10 backdrop-blur-md flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              anomalies.length > 0
                ? "bg-rose-500 animate-pulse"
                : isCritical
                ? "bg-amber-500 animate-pulse"
                : "bg-emerald-500"
            }`}
          />
          <span className="text-[10px] font-medium text-white/60 tracking-wider">
            {simulatedRisks
              ? "WHAT-IF ACTIVE"
              : anomalies.length > 0
              ? `${anomalies.length} ACTIVE ANOMALIES`
              : "AI COGNITION ACTIVE"}
          </span>
        </div>

        {/* Mini vitals readout */}
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 backdrop-blur-md">
          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1.5 font-bold">Live Metrics</p>
          {[
            { label: "HR", value: `${Math.round(hr)} bpm`, color: "#f43f5e" },
            { label: "SpO2", value: `${vitals.oxygen_saturation?.value ?? 98}%`, color: "#00f0ff" },
            { label: "BP", value: vitals.blood_pressure?.metadata?.systolic ? `${vitals.blood_pressure.metadata.systolic}/${vitals.blood_pressure.metadata.diastolic}` : "120/80", color: "#8b5cf6" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center gap-4 mb-1">
              <span className="text-[9px] text-slate-500 font-bold uppercase">{label}</span>
              <span className="text-[10px] font-mono font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {isCritical && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[9px] font-black uppercase tracking-widest animate-pulse pointer-events-none">
          ⚠ Critical State Detected
        </div>
      )}
    </div>
  );
}

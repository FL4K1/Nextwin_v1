"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, Lock, Key, Globe, 
  ExternalLink, CheckCircle, 
  X, ShieldCheck, Zap
} from "lucide-react";
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt 
} from 'wagmi';
import WalletConnectButton from "@/components/common/WalletConnectButton";
import { NEXTWIN_ACCESS_ADDRESS, NexTwinABI } from "@/lib/web3";

const ipfsRecords = [
  { hash: "QmX7d...8Kf2", type: "CBC Report", encrypted: true, size: "2.4 KB", date: "Mar 28" },
  { hash: "QmRk2...9Lm7", type: "Chest X-Ray", encrypted: true, size: "14.7 KB", date: "Mar 20" },
  { hash: "QmFz9...3Np1", type: "Prescription", encrypted: true, size: "1.1 KB", date: "Mar 15" },
];

export default function Web3VaultView() {
  const { address, isConnected } = useAccount();
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [granteeAddress, setGranteeAddress] = useState("");
  
  // Write Contract Hooks
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleGrantAccess = () => {
    if (!granteeAddress) return;
    
    writeContract({
      address: NEXTWIN_ACCESS_ADDRESS as `0x${string}`,
      abi: NexTwinABI,
      functionName: 'grantAccess',
      args: [
        granteeAddress as `0x${string}`, 
        '0x0000000000000000000000000000000000000000000000000000000000000000', // Default scope
        BigInt(3600 * 24 * 30) // 30 days
      ],
    });
  };

  const handleRevoke = (grantee: string) => {
    writeContract({
      address: NEXTWIN_ACCESS_ADDRESS as `0x${string}`,
      abi: NexTwinABI,
      functionName: 'revokeAccess',
      args: [grantee as `0x${string}`],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Web3 Data Vault</h2>
          <p className="text-xs text-slate-500 mt-0.5">Decentralized health data ownership on Polygon Amoy</p>
        </div>
        {!isConnected ? (
          <WalletConnectButton />
        ) : (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-emerald-400">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "IPFS Records", value: "3", icon: Globe, color: "#00f0ff" },
          { label: "Active Grants", value: "2", icon: Key, color: "#10b981" },
          { label: "Storage Node", value: "Active", icon: Zap, color: "#f59e0b" },
          { label: "Integrity", value: "100%", icon: ShieldCheck, color: "#8b5cf6" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} className="glass-card p-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Icon size={18} style={{ color: stat.color }} className="mb-2" />
              <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Access Control Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Grants */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Key size={16} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Physician Access Grants</h3>
            </div>
            <button 
              onClick={() => setIsGrantModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all shadow-lg shadow-violet-600/20"
            >
              + New Grant
            </button>
          </div>

          <div className="space-y-3">
            {[
              { id: "1", grantee: "0x8920...248E", name: "Dr. Ananya Sharma", scope: "Vitals + Lab Reports", expires: "Jun 2026", status: "active" },
              { id: "2", grantee: "0x31b2...9a12", name: "Apollo Diagnostics", scope: "Lab Reports Only", expires: "Apr 2026", status: "active" },
            ].map((grant) => (
              <motion.div key={grant.id} className="group flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-violet-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-500 group-hover:text-violet-400 transition-colors">
                    <Shield size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{grant.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{grant.grantee} • {grant.scope}</p>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-tighter italic">Expires {grant.expires}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-400/5 px-2 py-1 rounded-md">
                    <CheckCircle size={10} /> Active
                  </span>
                  <button 
                    disabled={isPending}
                    onClick={() => handleRevoke(grant.grantee.replace('...', ''))} // Simplified for demo
                    className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* IPFS Meta */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Globe size={16} className="text-cyan-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">IPFS Data Registry</h3>
          </div>
          <div className="space-y-4">
            {ipfsRecords.map((record) => (
              <div key={record.hash} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-cyan-400/70">{record.hash}</span>
                  <Lock size={12} className="text-violet-500/50" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-300 font-medium">{record.type}</p>
                  <p className="text-[10px] text-slate-500">{record.date}</p>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Network Status</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" /> Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Status Overlay */}
      <AnimatePresence>
        {(isPending || isConfirming || isConfirmed) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-12 right-12 z-50 p-4 rounded-2xl glass-card border-violet-500/50 shadow-2xl shadow-violet-500/20 max-w-sm"
          >
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-xl scale-110 ${isConfirmed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-400'}`}>
                {isConfirmed ? <CheckCircle size={20} /> : <Zap size={20} className="animate-pulse" />}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">
                  {isConfirmed ? "Transaction Confirmed" : isConfirming ? "Confirming Box..." : "Transaction Pending"}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {isConfirmed 
                    ? "Access rights successfully updated on Polygon Amoy. Records are now visible to the physician." 
                    : "Please approve the transaction in your wallet to update the healthcare access registry."}
                </p>
                {hash && (
                  <a 
                    href={`https://amoy.polygonscan.com/tx/${hash}`} 
                    target="_blank" 
                    className="inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 mt-2 font-mono"
                  >
                    View on Explorer <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grant Access Modal */}
      <AnimatePresence>
        {isGrantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#050510]/80 backdrop-blur-sm"
              onClick={() => setIsGrantModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md glass-card p-8 border-violet-500/30 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button onClick={() => setIsGrantModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400">
                  <Key size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Grant Access</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-1">Smart Grant Registry</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-2 block">Physician Wallet Address</label>
                  <input 
                    type="text" 
                    value={granteeAddress}
                    onChange={(e) => setGranteeAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all font-mono"
                  />
                </div>

                <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} className="text-violet-400" />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      This action will emit a cryptographic event on Polygon. Only the specified address will be able to decrypt your Digital Twin record hash.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    handleGrantAccess();
                    setIsGrantModalOpen(false);
                  }}
                  disabled={isPending || !granteeAddress}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm shadow-xl shadow-violet-600/20 hover:shadow-violet-600/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {isPending ? "Waiting for Wallet..." : "Authorize Grant"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

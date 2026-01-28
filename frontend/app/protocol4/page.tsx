"use client";
import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  User, 
  Smartphone,
  Scan,
  Lock,
  Unlock,
  ArrowRight,
  Loader2
} from "lucide-react";

export default function Protocol4Page() {
  // --- STATE ---
  // We need the Connection ID to know WHICH phone to buzz
  const [connectionId, setConnectionId] = useState(""); 
  const [claimType, setClaimType] = useState("DeFi Trading License");
  
  const [loading, setLoading] = useState(false);
  const [proofState, setProofState] = useState("idle"); // idle, sent, verifying, success, failed
  const [presExId, setPresExId] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // --- ACTION 1: SEND REQUEST ---
  const requestProof = async () => {
    if (!connectionId) return alert("Enter the Connection ID from Protocol 1");
    
    setLoading(true);
    setProofState("sent");
    setLogs([]);
    addLog(`🚀 Sending Proof Request to Connection: ${connectionId.slice(0, 8)}...`);

    try {
      const response = await fetch("http://127.0.0.1:8002/protocol4/request-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // We reuse the 'verkey' field for connection_id to match backend model
        body: JSON.stringify({ 
           verkey: connectionId, 
           challenge: claimType,
           presentation_json: {} // Not needed for request
        }),
      });

      const data = await response.json();
      if (data.status === "sent") {
        setPresExId(data.presentation_exchange_id);
        addLog("✅ Notification Sent! Waiting for user to tap 'Share' on phone...");
        setProofState("verifying"); // Start Polling
      } else {
        throw new Error(data.detail || "Request Failed");
      }
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
      setProofState("failed");
      setLoading(false);
    }
  };

  // --- ACTION 2: POLL FOR STATUS ---
 useEffect(() => {
    let interval: NodeJS.Timeout;

    if (proofState === "verifying" && presExId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8002/protocol4/check-proof/${presExId}`);
          const data = await res.json();
          
          // SUCCESS CASE
          if (data.verified === true) {
            addLog("🎉 SUCCESS: Proof Received & Cryptographically Verified!");
            setProofState("success");
            setLoading(false);
            clearInterval(interval);
          } 
          
          // FAILURE CASE (Updated to catch Blockchain Revocation)
          // We check for 'verified === false' OR 'status === failed'
          else if (data.verified === false || data.status === "failed") {
             addLog(`⛔ FAILURE: ${data.details || "Proof Rejected."}`);
             setProofState("failed"); // This triggers the Red Screen
             setLoading(false);
             clearInterval(interval);
          } 
          
          // PENDING CASE
          else {
             // Still waiting... do nothing
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => clearInterval(interval);
  }, [proofState, presExId]);


  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-green-500/30">
      
      {/* HEADER */}
      <header className="max-w-5xl mx-auto mb-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-green-500 tracking-widest uppercase">Protocol 4</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Zero-Knowledge Verification</h2>
        <p className="text-slate-400 mt-2 text-lg">
          Server requests proof. Phone calculates Zero-Knowledge Proof. Server verifies.
        </p>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT COLUMN: CONTROLS */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-green-400 uppercase mb-4 flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> 1. Initiate Request
            </h3>
            
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Target Connection ID</label>
                    <input 
                        type="text" 
                        placeholder="e.g. 55544330-..." 
                        value={connectionId} 
                        onChange={e => setConnectionId(e.target.value)} 
                        className="w-full bg-black/50 border border-slate-700 text-white rounded px-3 py-3 text-xs font-mono focus:border-green-500 outline-none"
                    />
                </div>

                <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">License to Verify</label>
                    <select 
                      value={claimType}
                      onChange={e => setClaimType(e.target.value)}
                      className="w-full bg-black/50 border border-slate-700 text-white rounded px-3 py-3 text-xs outline-none"
                    >
                      <option>DeFi Trading License</option>
                      <option>Personal Assistant ID</option>
                      <option>Medical Proxy Auth</option>
                    </select>
                </div>
            </div>

            <button 
                onClick={requestProof} 
                disabled={loading || !connectionId}
                className={`w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all mb-6
                    ${loading ? "bg-slate-800 text-slate-500 cursor-wait" : "bg-green-700 hover:bg-green-600 text-white shadow-lg shadow-green-900/20"}
                `}
            >
                {loading ? "WAITING FOR PHONE..." : "REQUEST PROOF"} <ArrowRight className="w-3 h-3"/>
            </button>

             {/* LOGS DRAWER */}
            <div className="bg-black border border-slate-800 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] text-green-500/80">
                {logs.length === 0 && <span className="text-slate-600 italic">System Ready.</span>}
                {logs.map((l,i) => <div key={i} className="mb-1 border-b border-white/5 pb-0.5">{l}</div>)}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STATUS VISUALIZER */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-8 relative overflow-hidden h-full flex flex-col items-center justify-center text-center">
             
             {/* BACKGROUND ICON */}
             <div className="absolute opacity-5">
                <ShieldCheck className="w-64 h-64 text-white" />
             </div>

             {/* STATUS STATES */}
             {proofState === "idle" && (
               <div className="relative z-10 text-slate-500">
                  <Scan className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-bold">Ready to Verify</h3>
                  <p className="text-xs mt-2">Enter ID and Request Proof</p>
               </div>
             )}

             {proofState === "verifying" && (
               <div className="relative z-10">
                  <div className="w-20 h-20 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-6"></div>
                  <h3 className="text-xl font-bold text-white animate-pulse">Check Your Phone</h3>
                  <p className="text-sm text-green-400 mt-2">Waiting for User Approval...</p>
                  <p className="text-xs text-slate-500 mt-4 max-w-xs mx-auto">
                    The Agent is calculating a Zero-Knowledge Proof. No private keys will be revealed.
                  </p>
               </div>
             )}

             {proofState === "success" && (
               <div className="relative z-10 animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                     <Unlock className="w-10 h-10 text-black" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">ACCESS GRANTED</h3>
                  <div className="bg-green-900/20 border border-green-500/30 rounded px-4 py-2 mt-4 inline-flex items-center gap-2">
                     <CheckCircle2 className="w-4 h-4 text-green-500" />
                     <span className="text-xs text-green-400 font-mono">Proof Verified</span>
                  </div>
               </div>
             )}

             {proofState === "failed" && (
               <div className="relative z-10 animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                     <Lock className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">ACCESS DENIED</h3>
                  <div className="bg-red-900/20 border border-red-500/30 rounded px-4 py-2 mt-4 inline-flex items-center gap-2">
                     <XCircle className="w-4 h-4 text-red-500" />
                     <span className="text-xs text-red-400 font-mono">Verification Failed</span>
                  </div>
               </div>
             )}

          </div>
        </div>

      </div>
    </main>
  );
}
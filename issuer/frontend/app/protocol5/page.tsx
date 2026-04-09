"use client";
import { useState } from "react";
import { 
  ShieldAlert, 
  Search, 
  Ban, 
  Siren,
  FileWarning,
  Flame
} from "lucide-react";

export default function Protocol5Page() {
  // We use the unique License ID (e.g., LIC-123456) to anchor and revoke the credential
  const [licenseId, setLicenseId] = useState("");
  
  const [revoking, setRevoking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev]);

  const revokeCredential = async () => {
    if (!licenseId) return alert("Please enter the Target License ID");
    
    // UI CONFIRMATION
    if(!confirm("⚠️ GOVERNANCE WARNING ⚠️\n\nAre you sure you want to PERMANENTLY REVOKE this credential?\n\nThis writes a 'Revoked' status to the Blockchain. The Agent will immediately lose access.")) {
        return;
    }

    setRevoking(true);
    setResult(null);
    setLogs([]);
    addLog(`🚨 INITIATING REVOCATION PROTOCOL...`);
    addLog(`🎯 Target License: ${licenseId}`);

    try {
      await new Promise(r => setTimeout(r, 800)); // Visual tension
      addLog("Calculating Anchor ID...");

      const response = await fetch("http://127.0.0.1:8002/protocol5/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holder_did: licenseId, 
          claim_type: "DeFiTradingLicense" // Passed to satisfy the Pydantic model, but the backend now uses the ID
        })
      });
      const data = await response.json();

      if (data.status === "success") {
        addLog(`✅ BLOCKCHAIN CONFIRMED: Revocation Mined.`);
        setResult(data);
      } else {
        throw new Error(data.detail || "Revocation Failed");
      }
    } catch (e: any) {
      addLog(`❌ ERROR: ${e.message}`);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-red-500/30">
      
      {/* HEADER */}
      <header className="max-w-5xl mx-auto mb-10 border-b border-red-900/30 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-red-600 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-red-500 tracking-widest uppercase">Protocol 5</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-600" />
            Governance & Revocation
        </h2>
        <p className="text-slate-400 mt-2 text-lg">
          Emergency "Kill Switch". Revokes the Blockchain Anchor, invalidating the credential instantly.
        </p>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* LEFT: TARGET FORM */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-red-900/30 rounded-xl p-6 shadow-2xl relative overflow-hidden">
             
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
               <Siren className="w-40 h-40 text-red-500" />
             </div>

             <h3 className="text-white font-bold mb-6 flex items-center gap-2 relative z-10">
               <Search className="w-5 h-5 text-red-400" /> Target Identification
             </h3>
             
             <div className="space-y-4 relative z-10">
                <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Target License ID</label>
                    <input 
                      type="text" value={licenseId} onChange={e => setLicenseId(e.target.value)}
                      placeholder="e.g. LIC-123456"
                      className="w-full bg-black/50 border border-slate-700 text-slate-200 font-mono text-xs rounded p-3 focus:border-red-500 outline-none transition-colors"
                    />
                    <p className="text-[9px] text-slate-600 mt-1">Paste the unique License ID generated during Protocol 3.</p>
                </div>

                <div className="pt-4">
                    <button 
                      onClick={revokeCredential}
                      disabled={revoking || !licenseId}
                      className={`w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all shadow-lg
                        ${revoking 
                           ? "bg-slate-800 text-slate-500 cursor-wait" 
                           : "bg-red-700 hover:bg-red-600 text-white shadow-red-900/20 hover:shadow-red-900/40"
                        }`}
                    >
                       {revoking ? "BROADCASTING TO NETWORK..." : <><Flame className="w-4 h-4" /> PERMANENTLY REVOKE</>}
                    </button>
                </div>
             </div>
          </div>

          {/* LOGS */}
          <div className="bg-black border border-slate-800 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[10px] text-red-400/80 scrollbar-thin scrollbar-thumb-slate-700">
              {logs.length===0 && <span className="text-slate-700 italic">System Secure. No active alerts.</span>}
              {logs.map((l,i) => <div key={i} className="mb-1 border-b border-white/5 pb-0.5">{l}</div>)}
          </div>
        </div>

        {/* RIGHT: STATUS MONITOR */}
        <div className="space-y-6">
           {result ? (
               <div className="bg-red-950/20 border border-red-500/50 rounded-xl p-8 text-center animate-in zoom-in duration-300 relative overflow-hidden h-full">
                  <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-pulse">
                     <Ban className="w-12 h-12 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">REVOCATION COMPLETE</h3>
                  <p className="text-sm text-red-300 mb-8 max-w-xs mx-auto">
                    The Smart Contract has updated the status. This credential is now mathematically invalid.
                  </p>
                  
                  <div className="bg-black/40 p-5 rounded-lg border border-red-900/50 text-left space-y-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                         <span className="text-[10px] text-slate-500 uppercase font-bold">New Status</span>
                         <span className="text-xs text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded">REVOKED</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                         <span className="text-[10px] text-slate-500 uppercase font-bold">Target ID</span>
                         <span className="text-[10px] text-slate-300 font-mono truncate w-32 text-right">{licenseId}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] text-slate-500 uppercase font-bold">Tx Hash</span>
                         <span className="text-[10px] text-blue-400 font-mono truncate w-32 text-right hover:text-blue-300 cursor-pointer" title={result.tx_hash}>{result.tx_hash}</span>
                      </div>
                   </div>
                </div>
           ) : (
               <div className="h-full border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-12 text-slate-600 group hover:border-slate-700 transition-colors">
                  <FileWarning className="w-16 h-16 mb-4 opacity-20 group-hover:opacity-30 transition-opacity" />
                  <p className="text-sm font-medium">Governance Console</p>
                  <p className="text-xs mt-1 text-center max-w-[200px]">Select a target to enforce policy on the ledger.</p>
               </div>
           )}
        </div>

      </div>
    </main>
  );
}
"use client";
import { useState } from "react";
import { 
  ShieldAlert, 
  Search, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  Siren,
  FileWarning
} from "lucide-react";

export default function Protocol5Page() {
  const [holderDid, setHolderDid] = useState("");
  const [credType, setCredType] = useState("DeFi Trading License");
  
  const [revoking, setRevoking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev]);

  const revokeCredential = async () => {
    if (!holderDid) return alert("Enter Target DID");
    
    // UI CONFIRMATION
    if(!confirm("⚠️ CRITICAL ACTION ⚠️\n\nAre you sure you want to PERMANENTLY revoke this credential on the Blockchain? This cannot be undone.")) {
        return;
    }

    setRevoking(true);
    setResult(null);
    addLog(`Initiating Revocation Protocol for ${holderDid}...`);

    try {
      await new Promise(r => setTimeout(r, 800)); // Visual tension
      addLog("Constructing Revocation Transaction...");

      const response = await fetch("http://127.0.0.1:8002/protocol5/revoke-credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holder_did: holderDid,
          claim_type: credType // Matches the dropdown from Protocol 3
        })
      });
      const data = await response.json();

      await new Promise(r => setTimeout(r, 800)); 

      if (data.status === "success") {
        setResult(data);
        addLog(`✅ SUCCESS: Credential Revoked.`);
        addLog(`🔗 TX: ${data.tx_hash}`);
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
      
      <header className="max-w-4xl mx-auto mb-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-red-500 tracking-widest uppercase">Protocol 5</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Governance & Revocation</h2>
        <p className="text-slate-400 mt-2 text-lg">
          Emergency Kill-Switch to invalidate Credentials on the Immutable Ledger.
        </p>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT: TARGET FORM */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-red-900/30 rounded-xl p-6 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Siren className="w-40 h-40 text-red-500" />
             </div>

             <h3 className="text-white font-bold mb-6 flex items-center gap-2 relative z-10">
               <Search className="w-5 h-5 text-red-400" /> Target Identification
             </h3>
             
             <div className="space-y-4 relative z-10">
                <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Target DID</label>
                    <input 
                      type="text" value={holderDid} onChange={e => setHolderDid(e.target.value)}
                      placeholder="did:sov:agent:..."
                      className="w-full bg-black/50 border border-slate-700 text-slate-200 font-mono text-xs rounded p-3 focus:border-red-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Credential Type</label>
                    <select 
                      value={credType} onChange={e => setCredType(e.target.value)}
                      className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none"
                    >
                      <option>DeFi Trading License</option>
                      <option>Medical Proxy Access</option>
                      <option>Legal Power of Attorney</option>
                    </select>
                </div>

                <div className="pt-4">
                    <button 
                      onClick={revokeCredential}
                      disabled={revoking || !holderDid}
                      className={`w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all
                        ${revoking 
                           ? "bg-slate-800 text-slate-500" 
                           : "bg-red-700 hover:bg-red-600 text-white shadow-[0_0_20px_-5px_rgba(220,38,38,0.5)]"
                        }`}
                    >
                       {revoking ? "BROADCASTING TO NETWORK..." : <><Ban className="w-4 h-4" /> REVOKE ACCESS</>}
                    </button>
                </div>
             </div>
          </div>

          <div className="bg-black border border-slate-800 rounded-lg p-3 h-40 overflow-y-auto font-mono text-[10px] text-red-400/80">
              {logs.length===0 && <span>System Secure. No active alerts.</span>}
              {logs.map((l,i) => <div key={i} className="mb-1">{l}</div>)}
          </div>
        </div>

        {/* RIGHT: STATUS MONITOR */}
        <div className="space-y-6">
           {result ? (
               <div className="bg-red-950/20 border border-red-500 rounded-xl p-8 text-center animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500">
                     <ShieldAlert className="w-10 h-10 text-red-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">REVOCATION COMPLETE</h3>
                  <p className="text-sm text-red-400 mb-6">The credential has been permanently marked as REVOKED on the Ledger.</p>
                  
                  <div className="bg-black/40 p-4 rounded border border-red-900/50 text-left space-y-2">
                     <div className="flex justify-between">
                        <span className="text-[10px] text-slate-500 uppercase">Status</span>
                        <span className="text-[10px] text-red-500 font-bold">INACTIVE</span>
                     </div>
                     <div className="flex justify-between">
                        <span className="text-[10px] text-slate-500 uppercase">Target</span>
                        <span className="text-[10px] text-slate-300 font-mono truncate w-32 text-right">{holderDid}</span>
                     </div>
                     <div className="flex justify-between">
                        <span className="text-[10px] text-slate-500 uppercase">Tx Hash</span>
                        <span className="text-[10px] text-slate-300 font-mono truncate w-32 text-right">{result.tx_hash}</span>
                     </div>
                  </div>
               </div>
           ) : (
               <div className="h-full border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-12 text-slate-600">
                  <FileWarning className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm">Governance Console</p>
                  <p className="text-xs mt-1">Select a target to enforce policy.</p>
               </div>
           )}
        </div>

      </div>
    </main>
  );
}
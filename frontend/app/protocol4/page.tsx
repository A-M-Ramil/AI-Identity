"use client";
import { useState } from "react";
import { 
  Scan, 
  ShieldCheck, 
  FileCode, 
  Activity, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  XCircle, 
  User, 
  Key, 
  FileJson, 
  ArrowRight 
} from "lucide-react";

export default function Protocol4Page() {
  // --- STATE (UNCHANGED LOGIC) ---
  const [holderDID, setHolderDID] = useState("");
  const [verkey, setVerkey] = useState(""); 
  const [ipfsCID, setIpfsCID] = useState("");
  
  const [vp, setVp] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); // UI state for button spinners

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // --- 1. HOLDER: GENERATE VP ---
  const generatePresentation = async () => {
    if (!holderDID || !verkey || !ipfsCID) return alert("Fill all Holder fields!");
    
    setLoading(true);
    setLogs([]); // Clear previous logs
    addLog("🚀 Holder: Generating Privacy-Preserving Proof...");
    
    const challenge = "challenge_" + Math.random().toString(36).substring(7);
    addLog(`🎲 Challenge Received: ${challenge}`);

    try {
      // Simulation delay for visual effect
      await new Promise(r => setTimeout(r, 600));

      const response = await fetch("http://127.0.0.1:8002/protocol4/create-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            holder_did: holderDID,
            verkey: verkey, 
            credential_id: "auto",
            ipfs_cid: ipfsCID,
            challenge: challenge
        }),
      });

      const data = await response.json();
      if (data.status === "success") {
        setVp(data.vp);
        addLog("✅ VP Created & Signed by ACA-Py!");
      } else {
        addLog(`❌ Error: ${data.detail}`);
      }
    } catch (err: any) {
      addLog(`❌ Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. VERIFIER: VERIFY VP ---
  const verifyPresentation = async () => {
    if (!vp) return alert("No VP to verify!");
    if (!verkey) return alert("Verifier needs the Public Key (Verkey)!");

    setLoading(true);
    setVerificationResult(null); // Reset previous result
    addLog("🕵️ Verifier: Checking Proof & Blockchain Status...");

    try {
      // Simulation delay
      await new Promise(r => setTimeout(r, 800));

      const response = await fetch("http://127.0.0.1:8002/protocol4/verify-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            presentation_json: vp,
            challenge: vp.proof?.challenge || "unknown", // Safe access
            verkey: verkey 
        }),
      });

      const data = await response.json();
      setVerificationResult(data);
      
      if (data.verified) {
        addLog("✅ VERIFICATION SUCCESSFUL!");
        addLog(`   Holder: ${data.holder}`);
        addLog("   Blockchain Status: Active");
      } else {
        addLog(`⛔ VERIFICATION FAILED: ${data.reason}`);
      }

    } catch (err: any) {
      addLog(`❌ Verification Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-green-500/30">
      
      {/* HEADER */}
      <header className="max-w-6xl mx-auto mb-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-green-500 tracking-widest uppercase">Protocol 4</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Zero-Trust Verification</h2>
        <p className="text-slate-400 mt-2 text-lg">
          Validate Agent Credentials using Explicit Keys (Off-Chain) and Ledger Status (On-Chain).
        </p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT COLUMN: HOLDER ACTIONS */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-purple-400 uppercase mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> 1. Holder: Generate Proof
            </h3>
            
            <div className="space-y-4 mb-6">
                <div className="group">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Holder DID</label>
                    <div className="flex items-center gap-2 bg-black/50 border border-slate-700 rounded px-3 py-2 focus-within:border-purple-500 transition-colors">
                        <User className="w-3 h-3 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="did:sov:..." 
                            value={holderDID} 
                            onChange={e => setHolderDID(e.target.value)} 
                            className="bg-transparent w-full text-xs font-mono text-slate-300 outline-none placeholder:text-slate-700"
                        />
                    </div>
                </div>

                <div className="group">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Holder Verkey</label>
                    <div className="flex items-center gap-2 bg-black/50 border border-slate-700 rounded px-3 py-2 focus-within:border-purple-500 transition-colors">
                        <Key className="w-3 h-3 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Public Key from Protocol 1..." 
                            value={verkey} 
                            onChange={e => setVerkey(e.target.value)} 
                            className="bg-transparent w-full text-xs font-mono text-purple-300 outline-none placeholder:text-slate-700"
                        />
                    </div>
                </div>

                <div className="group">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">IPFS CID</label>
                    <div className="flex items-center gap-2 bg-black/50 border border-slate-700 rounded px-3 py-2 focus-within:border-purple-500 transition-colors">
                        <FileCode className="w-3 h-3 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Qm..." 
                            value={ipfsCID} 
                            onChange={e => setIpfsCID(e.target.value)} 
                            className="bg-transparent w-full text-xs font-mono text-slate-300 outline-none placeholder:text-slate-700"
                        />
                    </div>
                </div>
            </div>

            <button 
                onClick={generatePresentation} 
                disabled={loading || !holderDID || !verkey || !ipfsCID}
                className={`w-full py-3 rounded font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all mb-6
                    ${loading ? "bg-slate-800 text-slate-500" : "bg-purple-700 hover:bg-purple-600 text-white shadow-lg shadow-purple-900/20"}
                `}
            >
                {loading && !vp ? "Signing..." : "Sign & Generate VP"} <ArrowRight className="w-3 h-3"/>
            </button>

            {/* EDITABLE VP TERMINAL */}
            {vp && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-[#09090b] px-4 py-2 flex items-center justify-between border-b border-slate-800 rounded-t-lg">
                       <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                         <FileJson className="w-3 h-3" /> VERIFIABLE_PRESENTATION.json
                       </div>
                    </div>
                    <textarea 
                        className="w-full h-48 bg-black/80 text-green-400 font-mono text-[10px] p-4 resize-none outline-none rounded-b-lg border border-t-0 border-slate-800 focus:border-purple-500/50 transition-colors"
                        value={JSON.stringify(vp, null, 2)}
                        onChange={(e) => {
                            try { setVp(JSON.parse(e.target.value)); } catch (err) { /* ignore parse errors while typing */ }
                        }}
                    />
                </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: VERIFIER */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-8 relative overflow-hidden h-full flex flex-col">
             
             <div className="absolute top-0 right-0 p-6 opacity-5">
                <ShieldCheck className="w-48 h-48 text-white" />
             </div>

             <div className="flex justify-between items-center mb-8 relative z-10">
               <h3 className="text-white font-bold flex items-center gap-2">
                 <Activity className="w-5 h-5 text-green-400" /> Security Gate
               </h3>
               {loading && vp && <span className="text-xs font-mono text-green-500 animate-pulse">SCANNING...</span>}
             </div>

             <div className="space-y-6 relative z-10 flex-grow">
                {/* Step 1 */}
                <div className={`flex items-center gap-4 transition-all duration-500 ${verificationResult ? "opacity-100" : "opacity-50"}`}>
                   <div className={`p-2 rounded-full border ${verificationResult ? "bg-green-500/20 border-green-500 text-green-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                      <FileCode className="w-5 h-5" />
                   </div>
                   <div>
                      <div className="text-sm font-bold text-slate-200">Syntax Check</div>
                      <div className="text-xs text-slate-500">JSON-LD Structure & Challenge</div>
                   </div>
                   {verificationResult && <CheckCircle2 className="ml-auto w-4 h-4 text-green-500" />}
                </div>

                {/* Step 2 */}
                <div className={`flex items-center gap-4 transition-all duration-500 ${verificationResult ? "opacity-100" : "opacity-50"}`}>
                   <div className={`p-2 rounded-full border ${verificationResult ? "bg-green-500/20 border-green-500 text-green-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                      <ShieldCheck className="w-5 h-5" />
                   </div>
                   <div>
                      <div className="text-sm font-bold text-slate-200">Crypto Verification</div>
                      <div className="text-xs text-slate-500">ACA-Py Signature Validation</div>
                   </div>
                   {verificationResult && <CheckCircle2 className="ml-auto w-4 h-4 text-green-500" />}
                </div>

                {/* Step 3 */}
                <div className={`flex items-center gap-4 transition-all duration-500 ${verificationResult ? "opacity-100" : "opacity-50"}`}>
                   <div className={`p-2 rounded-full border ${verificationResult ? "bg-green-500/20 border-green-500 text-green-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                      <Scan className="w-5 h-5" />
                   </div>
                   <div>
                      <div className="text-sm font-bold text-slate-200">Ledger Status</div>
                      <div className="text-xs text-slate-500">Revocation Registry Check</div>
                   </div>
                   {verificationResult && (verificationResult.verified ? <CheckCircle2 className="ml-auto w-4 h-4 text-green-500" /> : <XCircle className="ml-auto w-4 h-4 text-red-500" />)}
                </div>
             </div>

             <div className="mt-8 relative z-10">
                <button 
                   onClick={verifyPresentation}
                   disabled={loading || !vp}
                   className={`w-full py-4 rounded-lg font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all
                     ${!vp 
                       ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                       : loading 
                         ? "bg-slate-800 text-slate-500 cursor-wait" 
                         : "bg-green-700 hover:bg-green-600 text-white shadow-[0_0_20px_-5px_rgba(21,128,61,0.5)]"
                     }
                   `}
                 >
                   {loading && vp ? "Running Diagnostics..." : <><Scan className="w-4 h-4" /> Verify Access</>}
                 </button>
             </div>

             {/* RESULT BADGE */}
             {verificationResult && !loading && (
                 <div className="mt-6 animate-in slide-in-from-bottom-2 duration-300">
                   {verificationResult.verified ? (
                      <div className="bg-green-900/10 border border-green-500/50 rounded-xl p-4 flex items-center gap-4 shadow-[0_0_15px_-3px_rgba(34,197,94,0.2)]">
                         <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-black font-bold">
                            <Unlock className="w-6 h-6" />
                         </div>
                         <div>
                             <h4 className="text-lg font-bold text-white leading-none">ACCESS GRANTED</h4>
                             <span className="text-xs text-green-400 font-mono">License Active & Verified</span>
                         </div>
                      </div>
                   ) : (
                      <div className="bg-red-900/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-4 shadow-[0_0_15px_-3px_rgba(220,38,38,0.2)]">
                         <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white font-bold">
                            <Lock className="w-6 h-6" />
                         </div>
                         <div>
                             <h4 className="text-lg font-bold text-white leading-none">ACCESS DENIED</h4>
                             <span className="text-xs text-red-400 font-mono">{verificationResult.reason}</span>
                         </div>
                      </div>
                   )}
                 </div>
             )}

             {/* SCANLINE ANIMATION */}
             {loading && vp && (
               <div className="absolute top-0 left-0 w-full h-[2px] bg-green-500 shadow-[0_0_20px_rgba(34,197,94,1)] animate-scan" style={{animationDuration: '2s', animationIterationCount: 'infinite'}} />
             )}
          </div>
        </div>

      </div>
      
      {/* LOGS DRAWER */}
      <div className="max-w-6xl mx-auto mt-8 bg-black border border-slate-800 rounded-lg p-3 h-32 overflow-y-auto font-mono text-[10px] text-slate-400 scrollbar-thin scrollbar-thumb-slate-700">
         {logs.length === 0 && <span className="text-slate-600 italic">System Ready. Waiting for inputs...</span>}
         {logs.map((l,i) => <div key={i} className="mb-1 border-b border-white/5 pb-0.5">{l}</div>)}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation-name: scan;
          animation-timing-function: linear;
        }
      `}</style>
    </main>
  );
}
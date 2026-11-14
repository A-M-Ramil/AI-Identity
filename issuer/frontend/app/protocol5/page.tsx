
// "use client";
// import { useState } from "react";
// import { 
//   ShieldAlert, 
//   Search, 
//   Ban, 
//   Siren,
//   FileWarning,
//   Flame
// } from "lucide-react";

// export default function Protocol5Page() {
//   // We use the unique License ID (e.g., LIC-123456) to anchor and revoke the credential
//   const [licenseId, setLicenseId] = useState("");
  
//   const [revoking, setRevoking] = useState(false);
//   const [result, setResult] = useState<any>(null);
//   const [logs, setLogs] = useState<string[]>([]);

//   const addLog = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev]);

//   const revokeCredential = async () => {
//     if (!licenseId) return alert("Please enter the Target License ID");
    
//     // UI CONFIRMATION
//     if(!confirm("⚠️ GOVERNANCE WARNING ⚠️\n\nAre you sure you want to PERMANENTLY REVOKE this credential?\n\nThis writes a 'Revoked' status to the Blockchain. The Agent will immediately lose access.")) {
//         return;
//     }

//     setRevoking(true);
//     setResult(null);
//     setLogs([]);
//     addLog(`🚨 INITIATING REVOCATION PROTOCOL...`);
//     addLog(`🎯 Target License: ${licenseId}`);

//     try {
//       await new Promise(r => setTimeout(r, 800)); // Visual tension
//       addLog("Calculating Anchor ID...");

//       const response = await fetch("http://127.0.0.1:8002/protocol5/revoke", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           holder_did: licenseId, 
//           claim_type: "DeFiTradingLicense" // Passed to satisfy the Pydantic model, but the backend now uses the ID
//         })
//       });
//       const data = await response.json();

//       if (data.status === "success") {
//         addLog(`✅ BLOCKCHAIN CONFIRMED: Revocation Mined.`);
//         setResult(data);
//       } else {
//         throw new Error(data.detail || "Revocation Failed");
//       }
//     } catch (e: any) {
//       addLog(`❌ ERROR: ${e.message}`);
//     } finally {
//       setRevoking(false);
//     }
//   };

//   return (
//     <main className="min-h-screen bg-[#fafafa] text-slate-800 p-8 font-sans selection:bg-red-200 selection:text-red-900">
      
//       {/* HEADER */}
//       <header className="max-w-5xl mx-auto mb-10 border-b border-slate-300 pb-6 mt-8">
//         <div className="flex items-center gap-3 mb-3">
//           <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"/>
//           <h2 className="text-4xl font-mono text-red-600 font-bold tracking-widest uppercase">Protocol 5</h2>
//         </div>
//         <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
//             <ShieldAlert className="w-9 h-9 text-red-600" />
//             Governance & Revocation
//         </h2>
//         <p className="text-slate-600 mt-2 text-lg font-medium">
//           Emergency "Kill Switch". Revokes the Blockchain Anchor, invalidating the credential instantly.
//         </p>
//       </header>

//       <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        
//         {/* LEFT: TARGET FORM */}
//         <div className="space-y-6">
//           <div className="bg-white border border-slate-300 rounded-2xl p-8 shadow-md relative overflow-hidden">
             
//              {/* Background Decoration */}
//              <div className="absolute top-0 right-0 p-4 opacity-[0.04] pointer-events-none transform translate-x-4 -translate-y-4">
//                <Siren className="w-48 h-48 text-red-900" />
//              </div>

//              <h3 className="text-slate-900 font-bold mb-6 flex items-center gap-2.5 text-lg relative z-10">
//                <div className="p-2 bg-red-50 rounded-lg border border-red-100">
//                  <Search className="w-5 h-5 text-red-600" />
//                </div>
//                Target Identification
//              </h3>
             
//              <div className="space-y-5 relative z-10">
//                 <div>
//                     <label className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mb-1.5 block">Target License ID</label>
//                     <input 
//                       type="text" value={licenseId} onChange={e => setLicenseId(e.target.value)}
//                       placeholder="e.g. LIC-123456"
//                       className="w-full bg-slate-50 border border-slate-400 text-slate-900 font-mono text-sm rounded-xl p-3.5 focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all shadow-sm placeholder:text-slate-400"
//                     />
//                     <p className="text-[10px] text-slate-500 mt-2 font-medium">Paste the unique License ID generated during Protocol 3.</p>
//                 </div>

//                 <div className="pt-4">
//                     <button 
//                       onClick={revokeCredential}
//                       disabled={revoking || !licenseId}
//                       className={`w-full py-4 rounded-xl font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]
//                         ${revoking || !licenseId
//                            ? "bg-slate-100 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none" 
//                            : "bg-red-600 hover:bg-red-700 text-white shadow-red-600/20 hover:shadow-red-700/30 border border-red-700"
//                         }`}
//                     >
//                        {revoking ? "BROADCASTING TO NETWORK..." : <><Flame className="w-4 h-4" /> PERMANENTLY REVOKE</>}
//                     </button>
//                 </div>
//              </div>
//           </div>

//           {/* LOGS */}
//           <div className="bg-slate-100 border border-slate-400 rounded-2xl p-5 h-40 overflow-y-auto font-mono text-[11px] text-red-700 shadow-inner scrollbar-thin scrollbar-thumb-slate-300">
//               {logs.length===0 && <span className="text-slate-500 italic">System Secure. No active alerts.</span>}
//               {logs.map((l,i) => <div key={i} className="mb-1 border-b border-slate-300 pb-1.5 pt-0.5">{l}</div>)}
//           </div>
//         </div>

//         {/* RIGHT: STATUS MONITOR */}
//         <div className="space-y-6">
//            {result ? (
//                <div className="bg-red-50 border border-red-400 rounded-2xl p-8 text-center animate-in zoom-in slide-in-from-bottom-4 duration-500 relative overflow-hidden h-full shadow-lg">
//                   <div className="w-24 h-24 bg-red-100 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
//                      <Ban className="w-12 h-12 text-red-600" />
//                   </div>
//                   <h3 className="text-2xl font-extrabold text-red-900 mb-2 tracking-tight">REVOCATION COMPLETE</h3>
//                   <p className="text-sm text-red-700 mb-8 max-w-xs mx-auto font-medium">
//                     The Smart Contract has updated the status. This credential is now mathematically invalid.
//                   </p>
                  
//                   <div className="bg-white p-5 rounded-xl border border-red-300 shadow-sm text-left space-y-3">
//                       <div className="flex justify-between items-center border-b border-slate-200 pb-3">
//                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">New Status</span>
//                          <span className="text-xs text-red-700 font-bold bg-red-100 border border-red-200 px-2.5 py-1 rounded-md">REVOKED</span>
//                       </div>
//                       <div className="flex justify-between items-center border-b border-slate-200 pb-3 pt-1">
//                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Target ID</span>
//                          <span className="text-[11px] text-slate-800 font-mono font-bold truncate w-32 text-right">{licenseId}</span>
//                       </div>
//                       <div className="flex justify-between items-center pt-1">
//                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tx Hash</span>
//                          <span className="text-[11px] text-blue-600 font-mono truncate w-32 text-right hover:text-blue-800 cursor-pointer" title={result.tx_hash}>{result.tx_hash}</span>
//                       </div>
//                    </div>
//                 </div>
//            ) : (
//                <div className="h-full border-2 border-dashed border-slate-400 bg-white rounded-2xl flex flex-col items-center justify-center p-12 text-slate-500 group hover:border-slate-500 hover:bg-slate-50 transition-all shadow-sm">
//                   <FileWarning className="w-16 h-16 mb-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
//                   <p className="text-sm font-bold text-slate-700">Governance Console</p>
//                   <p className="text-xs mt-1.5 text-center max-w-[200px] font-medium text-slate-500">Select a target to enforce policy on the ledger.</p>
//                </div>
//            )}
//         </div>

//       </div>
//     </main>
//   );
// }

"use client";
import { useState } from "react";
import {
  ShieldAlert,
  Search,
  Ban,
  Siren,
  FileWarning,
  Flame,
  AlertTriangle,
  Loader2,
  Copy,
  CheckCircle2,
} from "lucide-react";

type Outcome =
  | { kind: "success"; tx_hash: string; revoked_id: string }
  | { kind: "notice"; detail: string }
  | null;

export default function Protocol5Page() {
  const [licenseId, setLicenseId] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const addLog = (msg: string) =>
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const revokeCredential = async () => {
    const id = licenseId.trim();
    if (!id) return alert("Please enter the Target License ID");

    if (
      !confirm(
        "GOVERNANCE WARNING\n\nPermanently revoke this credential?\n\nThis writes a 'Revoked' status to the blockchain and cannot be undone."
      )
    )
      return;

    setRevoking(true);
    setOutcome(null);
    setLogs([]);
    addLog("Initiating revocation protocol...");
    addLog(`Target license: ${id}`);

    try {
      const response = await fetch("http://127.0.0.1:8002/protocol5/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holder_did: id,
          claim_type: "DeFiTradingLicense", // unused by backend, required by the model
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.status === "success") {
        addLog("Revocation mined on-chain.");
        setOutcome({ kind: "success", tx_hash: data.tx_hash, revoked_id: data.revoked_id });
      } else if (response.ok && data.status === "error") {
        // Backend reports "not found" / "already revoked" as a normal response
        addLog(`No change: ${data.detail}`);
        setOutcome({ kind: "notice", detail: data.detail });
      } else {
        throw new Error(typeof data.detail === "string" ? data.detail : "Revocation failed");
      }
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
      setOutcome({ kind: "notice", detail: e.message });
    } finally {
      setRevoking(false);
    }
  };

  const copyTx = (tx: string) => {
    navigator.clipboard.writeText(tx);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="min-h-screen bg-[#fafafa] text-slate-800 p-8 font-sans selection:bg-red-200 selection:text-red-900">
      <header className="max-w-5xl mx-auto mb-10 border-b border-slate-300 pb-6 mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          <h2 className="text-4xl font-mono text-red-600 font-bold tracking-widest uppercase">Protocol 5</h2>
        </div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <ShieldAlert className="w-9 h-9 text-red-600" />
          Governance & Revocation
        </h2>
        <p className="text-slate-600 mt-2 text-lg font-medium">
          Issuer-only revocation. The on-chain status flips and verifiers reject the credential immediately.
        </p>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* LEFT */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-300 rounded-2xl p-8 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.04] pointer-events-none transform translate-x-4 -translate-y-4">
              <Siren className="w-48 h-48 text-red-900" />
            </div>

            <h3 className="text-slate-900 font-bold mb-6 flex items-center gap-2.5 text-lg relative z-10">
              <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                <Search className="w-5 h-5 text-red-600" />
              </div>
              Target Identification
            </h3>

            <div className="space-y-5 relative z-10">
              <div>
                <label className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mb-1.5 block">Target License ID</label>
                <input
                  type="text"
                  value={licenseId}
                  onChange={(e) => setLicenseId(e.target.value)}
                  placeholder="e.g. LIC-A1B2C3D4E5F6"
                  className="w-full bg-slate-50 border border-slate-400 text-slate-900 font-mono text-sm rounded-xl p-3.5 focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all shadow-sm placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-2 font-medium">
                  Paste the unique License ID (LIC-, AID- or MED- prefix) generated in Protocol 3.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={revokeCredential}
                  disabled={revoking || !licenseId.trim()}
                  className={`w-full py-4 rounded-xl font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]
                    ${
                      revoking || !licenseId.trim()
                        ? "bg-slate-100 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none"
                        : "bg-red-600 hover:bg-red-700 text-white shadow-red-600/20 hover:shadow-red-700/30 border border-red-700"
                    }`}
                >
                  {revoking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> BROADCASTING TO NETWORK...
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4" /> PERMANENTLY REVOKE
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 border border-slate-400 rounded-2xl p-5 h-40 overflow-y-auto font-mono text-[11px] text-red-700 shadow-inner">
            {logs.length === 0 && <span className="text-slate-500 italic">System secure. No active alerts.</span>}
            {logs.map((l, i) => (
              <div key={i} className="mb-1 border-b border-slate-300 pb-1.5 pt-0.5">
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {outcome?.kind === "success" ? (
            <div className="bg-red-50 border border-red-400 rounded-2xl p-8 text-center animate-in zoom-in slide-in-from-bottom-4 duration-500 relative overflow-hidden h-full shadow-lg">
              <div className="w-24 h-24 bg-red-100 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <Ban className="w-12 h-12 text-red-600" />
              </div>
              <h3 className="text-2xl font-extrabold text-red-900 mb-2 tracking-tight">REVOCATION COMPLETE</h3>
              <p className="text-sm text-red-700 mb-8 max-w-xs mx-auto font-medium">
                The registry now marks this credential as revoked. Any verifier checking the chain will reject it, even though
                its cryptographic proof is still valid.
              </p>

              <div className="bg-white p-5 rounded-xl border border-red-300 shadow-sm text-left space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">New Status</span>
                  <span className="text-xs text-red-700 font-bold bg-red-100 border border-red-200 px-2.5 py-1 rounded-md">REVOKED</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 pt-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Target ID</span>
                  <span className="text-[11px] text-slate-800 font-mono font-bold truncate w-40 text-right" title={licenseId}>
                    {licenseId}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 gap-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tx Hash</span>
                  <button
                    onClick={() => copyTx(outcome.tx_hash)}
                    className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 font-mono truncate max-w-[10rem]"
                    title={outcome.tx_hash}
                  >
                    <span className="truncate">{outcome.tx_hash}</span>
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                </div>
              </div>
            </div>
          ) : outcome?.kind === "notice" ? (
            <div className="h-full bg-amber-50 border border-amber-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-md animate-in fade-in duration-300">
              <div className="w-20 h-20 bg-amber-100 border border-amber-200 rounded-full flex items-center justify-center mb-5">
                <AlertTriangle className="w-10 h-10 text-amber-600" />
              </div>
              <h3 className="text-xl font-extrabold text-amber-900 mb-2">Nothing was revoked</h3>
              <p className="text-sm text-amber-800 font-medium max-w-xs break-words">{outcome.detail}</p>
            </div>
          ) : (
            <div className="h-full border-2 border-dashed border-slate-400 bg-white rounded-2xl flex flex-col items-center justify-center p-12 text-slate-500 group hover:border-slate-500 hover:bg-slate-50 transition-all shadow-sm">
              <FileWarning className="w-16 h-16 mb-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
              <p className="text-sm font-bold text-slate-700">Governance Console</p>
              <p className="text-xs mt-1.5 text-center max-w-[200px] font-medium text-slate-500">
                Select a target to enforce policy on the ledger.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
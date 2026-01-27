"use client";
import { useState } from "react";

export default function Protocol6Page() {
  const [targetDID, setTargetDID] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runAudit = async () => {
    if (!targetDID) return alert("Enter a DID to audit");
    setLoading(true);
    setHistory([]);

    try {
      const response = await fetch("http://127.0.0.1:8002/protocol6/audit-did", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_did: targetDID }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setHistory(data.history);
        alert(`✅ AUDIT COMPLETE (M1-M11)\n\nEvidence Report Anchored on Chain!\nTX: ${data.tx_hash}\nReport CID: ${data.report_cid}`);
      } else {
        alert("Audit Failed: " + data.detail);
      }
    } catch (err) {
      alert("Network Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-slate-900 text-white font-mono">
      <h1 className="text-3xl font-bold mb-2 text-cyan-400">Protocol 6: Audit & Forensics</h1>
      <p className="mb-8 text-gray-400 text-sm">Immutable Ledger Reconstruction</p>

      <div className="w-full max-w-2xl">
        
        {/* Search Bar */}
        <div className="flex gap-4 mb-8">
          <input 
            type="text" 
            placeholder="Enter Target DID (e.g. BADiJY...)" 
            className="flex-1 p-4 bg-black rounded-lg border border-slate-700 focus:border-cyan-500 outline-none text-lg"
            onChange={(e) => setTargetDID(e.target.value)}
          />
          <button 
            onClick={runAudit}
            disabled={loading}
            className="px-8 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {loading ? "SCANNING..." : "RUN AUDIT"}
          </button>
        </div>

        {/* Timeline Results */}
        <div className="space-y-4">
            {history.length === 0 && !loading && (
                <div className="text-center text-gray-600 mt-12">
                    No records found on-chain for this DID.
                </div>
            )}

            {history.map((item, i) => (
                <div key={i} className={`p-4 rounded border-l-4 bg-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4`}
                     style={{ 
                         borderColor: item.color === 'red' ? '#ef4444' : 
                                      item.color === 'green' ? '#22c55e' : 
                                      item.color === 'purple' ? '#a855f7' : '#3b82f6' 
                     }}>
                    <div className="flex justify-between mb-1">
                        <span className="font-bold text-sm uppercase" style={{ 
                             color: item.color === 'red' ? '#ef4444' : 
                                    item.color === 'green' ? '#22c55e' : 
                                    item.color === 'purple' ? '#a855f7' : '#3b82f6' 
                        }}>
                            {item.event}
                        </span>
                        <span className="text-xs text-gray-500">{item.timestamp}</span>
                    </div>
                    <div className="text-sm text-gray-300">
                        {item.details}
                    </div>
                </div>
            ))}
        </div>

      </div>
    </main>
  );
}
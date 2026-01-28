"use client";
import { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { 
  FileJson, 
  PenTool, 
  Stamp, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  Cpu,
  Fingerprint,
  Link,
  Smartphone
} from "lucide-react";

export default function Protocol3Page() {
  // State
  const [issuerDid, setIssuerDid] = useState("did:sov:2wJPyULfLLnYTEFYzByfUR");
  
  // CRITICAL: This must be the Connection ID from Protocol 1
  const [subjectDid, setSubjectDid] = useState(""); 
  
  // Credential Data
  const [holderName, setHolderName] = useState("Ahammod Munim Ramil");
  const [holderRole, setHolderRole] = useState("Senior DeFi Trader");
  const [credType, setCredType] = useState("DeFi Trading License");
  const [expiry, setExpiry] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0=Draft, 1=Signing, 2=Anchoring, 3=Complete
  const [resultData, setResultData] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev]);

  // --- MOCK PREVIEW ---
  const previewJson = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", credType.replace(/\s/g, "")],
    "issuer": issuerDid,
    "issuanceDate": new Date().toISOString().split('T')[0],
    "credentialSubject": {
      "connection_id": subjectDid || "55544330-...",
      "name": holderName,
      "role": holderRole,
      "licenseType": credType
    }
  };

  // --- ACTION ---
  const issueCredential = async () => {
    if (!subjectDid) return alert("Please enter the Connection ID from Protocol 1");
    
    setLoading(true);
    setStep(1); // SIGNING
    addLog("Initiating ACA-Py Issuance Protocol...");

    try {
      // Step 1: Send to Backend
      const response = await fetch("http://127.0.0.1:8002/protocol3/issue-credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuer_did: issuerDid,
          subject_did: subjectDid, // Sending Connection ID here
          credential_data: {
             type: credType,
             name: holderName,
             role: holderRole,
             expiry: expiry,
          }
        })
      });
      const data = await response.json();

      if (data.status === "success") {
        addLog("✅ ACA-Py: Credential Sent to Phone.");
        setStep(2); // ANCHORING
        await new Promise(r => setTimeout(r, 800)); 
        
        addLog("✅ Blockchain: Hash Anchored to Ethereum.");
        setResultData(data);
        setStep(3); // DONE
        addLog(`🎉 PROTOCOL COMPLETE. TX: ${data.tx_hash}`);
      } else {
        throw new Error(data.detail || "Issuance Failed");
      }
    } catch (e: any) {
      addLog(`❌ ERROR: ${e.message}`);
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-purple-500/30">
      
      {/* HEADER */}
      <header className="max-w-6xl mx-auto mb-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-purple-500 tracking-widest uppercase">Protocol 3</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Credential Issuance</h2>
        <p className="text-slate-400 mt-2 text-lg">
          Issue a Schema-Compliant Credential to the Wallet & Anchor to Chain.
        </p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT COLUMN: EDITOR */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6 shadow-2xl relative">
             <div className="absolute top-0 right-0 p-4 opacity-5">
               <PenTool className="w-40 h-40 text-purple-500" />
             </div>

             <h3 className="text-white font-bold mb-6 flex items-center gap-2">
               <FileJson className="w-5 h-5 text-purple-400" /> Credential Details
             </h3>

             <div className="space-y-4 relative z-10">
               {/* ISSUER */}
               <div>
                 <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Issuer DID (You)</label>
                 <input 
                   type="text" value={issuerDid} onChange={e => setIssuerDid(e.target.value)}
                   className="w-full bg-black/50 border border-slate-700 text-slate-500 font-mono text-xs rounded p-3 focus:border-purple-500 outline-none"
                   
                 />
               </div>

               {/* RECIPIENT - UPDATED LABEL */}
               <div>
                 <label className="text-[10px] uppercase text-purple-400 font-bold tracking-wider flex justify-between">
                    <span>Recipient Connection ID</span>
                    <span className="text-[9px] opacity-70">From Protocol 1</span>
                 </label>
                 <input 
                   type="text" 
                   placeholder="e.g. 55544330-3219-4ecf-bc65-..." 
                   value={subjectDid} 
                   onChange={e => setSubjectDid(e.target.value)}
                   className="w-full bg-black/50 border border-slate-700 text-purple-300 font-mono text-xs rounded p-3 focus:border-purple-500 outline-none"
                 />
               </div>

               {/* ATTRIBUTES */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Holder Name</label>
                    <input 
                      type="text" value={holderName} onChange={e => setHolderName(e.target.value)}
                      className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Role</label>
                    <input 
                      type="text" value={holderRole} onChange={e => setHolderRole(e.target.value)}
                      className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none focus:border-purple-500"
                    />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">License Type</label>
                    <select 
                      value={credType} onChange={e => setCredType(e.target.value)}
                      className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none"
                    >
                      <option>DeFi Trading License</option>
                      <option>Personal Assistant ID</option>
                      <option>Medical Proxy Auth</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Expiry Date</label>
                    <DatePicker
                      selected={new Date(expiry)}
                      onChange={(date:any) => setExpiry(date.toISOString().split('T')[0])}
                      dateFormat="yyyy-MM-dd"
                      className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none"
                    />
                 </div>
               </div>

               <div className="pt-4">
                 <button 
                   onClick={issueCredential}
                   disabled={loading || !subjectDid}
                   className={`w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all
                     ${loading ? "bg-slate-800 text-slate-500" : "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)]"}
                   `}
                 >
                   {loading ? "ISSUING CREDENTIAL..." : "ISSUE & ANCHOR"} <ArrowRight className="w-4 h-4" />
                 </button>
               </div>
             </div>
          </div>

          {/* CONSOLE LOGS */}
          <div className="bg-black border border-slate-800 rounded-lg p-4 h-40 overflow-y-auto font-mono text-[10px] text-green-500/80">
            {logs.length===0 && <span className="text-slate-700">Waiting for issuance...</span>}
            {logs.map((l,i) => <div key={i}>{l}</div>)}
          </div>
        </div>


        {/* RIGHT COLUMN: VISUALIZER */}
        <div className="space-y-6">
          
          {/* 1. JSON PREVIEW */}
          <div className={`transition-all duration-500 ${step === 3 ? "opacity-50 blur-[1px]" : "opacity-100"}`}>
             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                <span>Payload Preview</span>
                <span className="text-slate-600">JSON-LD</span>
             </h4>
             <div className="bg-[#1e1e24] p-4 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300 leading-relaxed overflow-x-auto">
                <pre>{JSON.stringify(previewJson, null, 2)}</pre>
             </div>
          </div>

          {/* 2. SUCCESS CERTIFICATE */}
          {step === 3 && resultData && (
             <div className="animate-in zoom-in duration-500 relative">
                {/* Glowing Border */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur opacity-30"></div>
                
                <div className="relative bg-[#0F0F12] border border-purple-500/50 rounded-xl p-8 shadow-2xl">
                   {/* Badge */}
                   <div className="absolute -top-5 right-8 bg-black border border-purple-500 text-purple-400 p-2 rounded-full shadow-lg">
                      <Stamp className="w-8 h-8" />
                   </div>

                   <div className="mb-6">
                      <h3 className="text-2xl font-bold text-white mb-1">Verifiable Credential</h3>
                      <div className="flex items-center gap-2 text-green-400 text-xs font-mono">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Issued & Anchored</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-6 mb-6">
                      <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                         <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Holder Name</div>
                         <div className="text-[10px] text-purple-300 font-mono truncate">{holderName}</div>
                      </div>
                      <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                         <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">License</div>
                         <div className="text-[10px] text-white font-mono">{credType}</div>
                      </div>
                   </div>

                   <div className="border-t border-slate-800 pt-4 space-y-3">
                      <div className="flex items-center gap-3">
                         <Smartphone className="w-4 h-4 text-green-500" />
                         <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] text-slate-500 uppercase">Wallet Delivery</div>
                            <div className="text-[9px] text-green-400 font-mono">SENT TO PHONE</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <Link className="w-4 h-4 text-blue-500" />
                         <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] text-slate-500 uppercase">IPFS Metadata</div>
                            <div className="text-[9px] text-blue-400 font-mono truncate">{resultData.ipfs_cid}</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <Fingerprint className="w-4 h-4 text-purple-500" />
                         <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] text-slate-500 uppercase">Blockchain Anchor</div>
                            <div className="text-[9px] text-purple-400 font-mono truncate">{resultData.tx_hash}</div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          )}

        </div>

      </div>
    </main>
  );
}
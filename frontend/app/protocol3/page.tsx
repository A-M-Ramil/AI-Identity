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
  Link
} from "lucide-react";

export default function Protocol3Page() {
  // State
  const [issuerDid, setIssuerDid] = useState("did:sov:2wJPyULfLLnYTEFYzByfUR");
  const [subjectDid, setSubjectDid] = useState("");
  const [credType, setCredType] = useState("DeFi Trading License");
  const [expiry, setExpiry] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0=Draft, 1=Signing, 2=Anchoring, 3=Complete
  const [credential, setCredential] = useState<any>(null);
  const [txHash, setTxHash] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev]);

  // --- MOCK PREVIEW ---
  // This updates live as the user types, showing them what they are about to sign
  const previewJson = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", credType.replace(/\s/g, "")],
    "issuer": issuerDid,
    "issuanceDate": new Date().toISOString().split('T')[0],
    "expirationDate": expiry,
    "credentialSubject": {
      "id": subjectDid || "did:sov:agent:...",
      "licenseType": "UNRESTRICTED_DEFI_ACCESS",
      "authorization": "LEVEL_5"
    }
  };

  // --- ACTION ---
  const issueCredential = async () => {
    if (!subjectDid) return alert("Please enter the Agent's DID");
    
    setLoading(true);
    setStep(1); // SIGNING
    addLog("Initiating Cryptographic Signature...");

    try {
      // Step 1: Backend Signing
      const response = await fetch("http://127.0.0.1:8002/protocol3/issue-credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuer_did: issuerDid,
          subject_did: subjectDid,
          credential_data: {
             type: credType,
             expiry: expiry,
             access_level: "Level 5"
          }
        })
      });
      const data = await response.json();

      if (data.status === "success") {
        await new Promise(r => setTimeout(r, 800)); // Visual delay
        setStep(2); // ANCHORING
        addLog("Signature Valid. Anchoring Hash to Ledger...");
        
        // In a real flow, the backend does this in one go, but we simulate the progress
        // The backend *already* did it, so we just show the result
        await new Promise(r => setTimeout(r, 800)); 
        
        setCredential(data.credential);
        setTxHash(data.tx_hash);
        setStep(3); // DONE
        addLog(`✅ SUCCESS: Credential Issued! TX: ${data.tx_hash}`);
      } else {
        throw new Error(data.reason);
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
          Issue a Verifiable Credential (VC) to an authorized AI Agent.
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
               <FileJson className="w-5 h-5 text-purple-400" /> Credential Draft
             </h3>

             <div className="space-y-4 relative z-10">
               <div>
                 <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Issuer (You)</label>
                 <input 
                   type="text" value={issuerDid} onChange={e => setIssuerDid(e.target.value)}
                   className="w-full bg-black/50 border border-slate-700 text-slate-300 font-mono text-xs rounded p-3 focus:border-purple-500 outline-none"
                 />
               </div>

               <div>
                 <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Subject (Agent DID)</label>
                 <input 
                   type="text" placeholder="Paste Agent DID here..." value={subjectDid} onChange={e => setSubjectDid(e.target.value)}
                   className="w-full bg-black/50 border border-slate-700 text-purple-300 font-mono text-xs rounded p-3 focus:border-purple-500 outline-none"
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">License Type</label>
                    <select 
                      value={credType} onChange={e => setCredType(e.target.value)}
                      className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none"
                    >
                      <option>DeFi Trading License</option>
                      <option>Medical Proxy Access</option>
                      <option>Legal Power of Attorney</option>
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
                   {loading ? "CRYPTOGRAPHIC SIGNING..." : "DIGITALLY SIGN & ISSUE"} <ArrowRight className="w-4 h-4" />
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
          {step === 3 && credential && (
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
                        <span>Cryptographically Signed & Anchored</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-6 mb-6">
                      <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                         <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Issued To</div>
                         <div className="text-[10px] text-purple-300 font-mono truncate">{credential.credentialSubject.id}</div>
                      </div>
                      <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                         <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">License</div>
                         <div className="text-[10px] text-white font-mono">{credential.credentialSubject.licenseType}</div>
                      </div>
                   </div>

                   <div className="border-t border-slate-800 pt-4 space-y-3">
                      <div className="flex items-center gap-3">
                         <Fingerprint className="w-4 h-4 text-slate-500" />
                         <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] text-slate-500 uppercase">Proof (Signature)</div>
                            <div className="text-[9px] text-slate-400 font-mono truncate">{credential.proof.jws}</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <Link className="w-4 h-4 text-slate-500" />
                         <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] text-slate-500 uppercase">Blockchain Anchor</div>
                            <div className="text-[9px] text-blue-400 font-mono truncate">{txHash}</div>
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
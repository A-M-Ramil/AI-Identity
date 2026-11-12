// "use client";
// import { useState } from "react";
// import DatePicker from "react-datepicker";
// import "react-datepicker/dist/react-datepicker.css";

// import { 
//   FileJson, 
//   PenTool, 
//   Stamp, 
//   CheckCircle2, 
//   ArrowRight,
//   Fingerprint,
//   Link,
//   Smartphone,
//   Copy
// } from "lucide-react";

// export default function Protocol3Page() {
//   // State
//   const [issuerDid, setIssuerDid] = useState("did:sov:2wJPyULfLLnYTEFYzByfUR");
  
//   // CRITICAL: This must be the Connection ID from Protocol 1
//   const [subjectDid, setSubjectDid] = useState(""); 
  
//   // Credential Data
//   const [holderName, setHolderName] = useState("Ahammod Munim Ramil");
//   const [holderRole, setHolderRole] = useState("Senior DeFi Trader");
//   const [credType, setCredType] = useState("DeFi Trading License");
//   const [expiry, setExpiry] = useState(new Date().toISOString().split('T')[0]);
  
//   const [loading, setLoading] = useState(false);
//   const [step, setStep] = useState(0); // 0=Draft, 1=Signing, 2=Anchoring, 3=Complete
//   const [resultData, setResultData] = useState<any>(null);
//   const [logs, setLogs] = useState<string[]>([]);

//   const addLog = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev]);

//   // --- MOCK PREVIEW ---
//   const previewJson = {
//     "@context": ["https://www.w3.org/2018/credentials/v1"],
//     "type": ["VerifiableCredential", credType.replace(/\s/g, "")],
//     "issuer": issuerDid,
//     "issuanceDate": new Date().toISOString().split('T')[0],
//     "credentialSubject": {
//       "connection_id": subjectDid || "55544330-...",
//       "name": holderName,
//       "role": holderRole,
//       "licenseType": credType
//     }
//   };

//   // --- ACTION ---
//   const issueCredential = async () => {
//     if (!subjectDid) return alert("Please enter the Connection ID from Protocol 1");
    
//     setLoading(true);
//     setStep(1); // SIGNING
//     addLog("Initiating ACA-Py Issuance Protocol...");

//     try {
//       // Step 1: Send to Backend
//       const response = await fetch("http://127.0.0.1:8002/protocol3/issue-credential", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           issuer_did: issuerDid,
//           subject_did: subjectDid, // Sending Connection ID here
//           credential_data: {
//              type: credType,
//              name: holderName,
//              role: holderRole,
//              expiry: expiry,
//           }
//         })
//       });
//       const data = await response.json();

//       if (data.status === "success") {
//         addLog("✅ ACA-Py: Credential Sent to Phone.");
//         setStep(2); // ANCHORING
//         await new Promise(r => setTimeout(r, 800)); 
        
//         addLog("✅ Blockchain: Hash Anchored to Ethereum.");
//         setResultData(data);
//         setStep(3); // DONE
//         addLog(`🎉 PROTOCOL COMPLETE. TX: ${data.tx_hash}`);
//         if(data.license_id) addLog(`🔑 GENERATED LICENSE ID: ${data.license_id}`);
//       } else {
//         throw new Error(data.detail || "Issuance Failed");
//       }
//     } catch (e: any) {
//       addLog(`❌ ERROR: ${e.message}`);
//       setStep(0);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-purple-500/30">
      
//       {/* HEADER */}
//       <header className="max-w-6xl mx-auto mb-10 border-b border-slate-800 pb-6">
//         <div className="flex items-center gap-3 mb-2">
//           <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse"/>
//           <h1 className="text-sm font-mono text-purple-500 tracking-widest uppercase">Protocol 3</h1>
//         </div>
//         <h2 className="text-3xl font-bold text-white tracking-tight">Credential Issuance</h2>
//         <p className="text-slate-400 mt-2 text-lg">
//           Issue a Schema-Compliant Credential to the Wallet & Anchor to Chain.
//         </p>
//       </header>

//       <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
//         {/* LEFT COLUMN: EDITOR */}
//         <div className="space-y-6">
//           <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6 shadow-2xl relative">
//              <div className="absolute top-0 right-0 p-4 opacity-5">
//                <PenTool className="w-40 h-40 text-purple-500" />
//              </div>

//              <h3 className="text-white font-bold mb-6 flex items-center gap-2">
//                <FileJson className="w-5 h-5 text-purple-400" /> Credential Details
//              </h3>

//              <div className="space-y-4 relative z-10">
//                {/* ISSUER */}
//                <div>
//                  <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Issuer DID (You)</label>
//                  <input 
//                    type="text" value={issuerDid} onChange={e => setIssuerDid(e.target.value)}
//                    className="w-full bg-black/50 border border-slate-700 text-slate-500 font-mono text-xs rounded p-3 focus:border-purple-500 outline-none"
                   
//                  />
//                </div>

//                {/* RECIPIENT - UPDATED LABEL */}
//                <div>
//                  <label className="text-[10px] uppercase text-purple-400 font-bold tracking-wider flex justify-between">
//                     <span>Recipient Connection ID</span>
//                     <span className="text-[9px] opacity-70">From Protocol 1</span>
//                  </label>
//                  <input 
//                    type="text" 
//                    placeholder="e.g. 55544330-3219-4ecf-bc65-..." 
//                    value={subjectDid} 
//                    onChange={e => setSubjectDid(e.target.value)}
//                    className="w-full bg-black/50 border border-slate-700 text-purple-300 font-mono text-xs rounded p-3 focus:border-purple-500 outline-none"
//                  />
//                </div>

//                {/* ATTRIBUTES */}
//                <div className="grid grid-cols-2 gap-4">
//                   <div>
//                     <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Holder Name</label>
//                     <input 
//                       type="text" value={holderName} onChange={e => setHolderName(e.target.value)}
//                       className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none focus:border-purple-500"
//                     />
//                   </div>
//                   <div>
//                     <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Role</label>
//                     <input 
//                       type="text" value={holderRole} onChange={e => setHolderRole(e.target.value)}
//                       className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none focus:border-purple-500"
//                     />
//                   </div>
//                </div>

//                <div className="grid grid-cols-2 gap-4">
//                  <div>
//                     <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">License Type</label>
//                     <select 
//                       value={credType} onChange={e => setCredType(e.target.value)}
//                       className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none"
//                     >
//                       <option>DeFi Trading License</option>
//                       <option>Personal Assistant ID</option>
//                       <option>Medical Proxy Auth</option>
//                     </select>
//                  </div>
//                  <div>
//                     <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Expiry Date</label>
//                     <DatePicker
//                       selected={new Date(expiry)}
//                       onChange={(date:any) => setExpiry(date.toISOString().split('T')[0])}
//                       dateFormat="yyyy-MM-dd"
//                       className="w-full bg-black/50 border border-slate-700 text-white text-xs rounded p-3 outline-none"
//                     />
//                  </div>
//                </div>

//                <div className="pt-4">
//                  <button 
//                    onClick={issueCredential}
//                    disabled={loading || !subjectDid}
//                    className={`w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all
//                      ${loading ? "bg-slate-800 text-slate-500" : "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)]"}
//                    `}
//                  >
//                    {loading ? "ISSUING CREDENTIAL..." : "ISSUE & ANCHOR"} <ArrowRight className="w-4 h-4" />
//                  </button>
//                </div>
//              </div>
//           </div>

//           {/* CONSOLE LOGS */}
//           <div className="bg-black border border-slate-800 rounded-lg p-4 h-40 overflow-y-auto font-mono text-[10px] text-green-500/80">
//             {logs.length===0 && <span className="text-slate-700">Waiting for issuance...</span>}
//             {logs.map((l,i) => <div key={i}>{l}</div>)}
//           </div>
//         </div>


//         {/* RIGHT COLUMN: VISUALIZER */}
//         <div className="space-y-6">
          
//           {/* 1. JSON PREVIEW */}
//           <div className={`transition-all duration-500 ${step === 3 ? "opacity-50 blur-[1px]" : "opacity-100"}`}>
//              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
//                 <span>Payload Preview</span>
//                 <span className="text-slate-600">JSON-LD</span>
//              </h4>
//              <div className="bg-[#1e1e24] p-4 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300 leading-relaxed overflow-x-auto">
//                 <pre>{JSON.stringify(previewJson, null, 2)}</pre>
//              </div>
//           </div>

//           {/* 2. SUCCESS CERTIFICATE */}
//           {step === 3 && resultData && (
//              <div className="animate-in zoom-in duration-500 relative">
//                 {/* Glowing Border */}
//                 <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur opacity-30"></div>
                
//                 <div className="relative bg-[#0F0F12] border border-purple-500/50 rounded-xl p-8 shadow-2xl">
//                    {/* Badge */}
//                    <div className="absolute -top-5 right-8 bg-black border border-purple-500 text-purple-400 p-2 rounded-full shadow-lg">
//                       <Stamp className="w-8 h-8" />
//                    </div>

//                    <div className="mb-6">
//                       <h3 className="text-2xl font-bold text-white mb-1">Verifiable Credential</h3>
//                       <div className="flex items-center gap-2 text-green-400 text-xs font-mono">
//                         <CheckCircle2 className="w-3 h-3" />
//                         <span>Issued & Anchored</span>
//                       </div>
//                    </div>

//                    {/* UNIQUE LICENSE ID BOX */}
//                    <div className="bg-purple-900/30 border border-purple-500/50 p-4 rounded-lg mb-6 flex justify-between items-center">
//                        <div>
//                            <div className="text-[10px] uppercase text-purple-400 font-bold mb-1 tracking-wider">Unique License ID</div>
//                            <div className="text-2xl text-white font-mono font-bold tracking-widest">
//                                {resultData.license_id || "MISSING FROM BACKEND"}
//                            </div>
//                        </div>
//                        <button 
//                            onClick={() => {
//                                if(resultData.license_id) {
//                                    navigator.clipboard.writeText(resultData.license_id);
//                                    alert("License ID copied to clipboard!");
//                                }
//                            }}
//                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-3 py-2 rounded font-bold uppercase transition-colors"
//                        >
//                            <Copy className="w-3 h-3" /> Copy
//                        </button>
//                    </div>

//                    <div className="grid grid-cols-2 gap-6 mb-6">
//                       <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
//                          <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Holder Name</div>
//                          <div className="text-[10px] text-purple-300 font-mono truncate">{holderName}</div>
//                       </div>
//                       <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
//                          <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">License</div>
//                          <div className="text-[10px] text-white font-mono">{credType}</div>
//                       </div>
//                    </div>

//                    <div className="border-t border-slate-800 pt-4 space-y-3">
//                       <div className="flex items-center gap-3">
//                          <Smartphone className="w-4 h-4 text-green-500" />
//                          <div className="flex-1 overflow-hidden">
//                             <div className="text-[9px] text-slate-500 uppercase">Wallet Delivery</div>
//                             <div className="text-[9px] text-green-400 font-mono">SENT TO PHONE</div>
//                          </div>
//                       </div>
//                       <div className="flex items-center gap-3">
//                          <Link className="w-4 h-4 text-blue-500" />
//                          <div className="flex-1 overflow-hidden">
//                             <div className="text-[9px] text-slate-500 uppercase">IPFS Metadata</div>
//                             <div className="text-[9px] text-blue-400 font-mono truncate">{resultData.ipfs_cid}</div>
//                          </div>
//                       </div>
//                       <div className="flex items-center gap-3">
//                          <Fingerprint className="w-4 h-4 text-purple-500" />
//                          <div className="flex-1 overflow-hidden">
//                             <div className="text-[9px] text-slate-500 uppercase">Blockchain Anchor</div>
//                             <div className="text-[9px] text-purple-400 font-mono truncate">{resultData.tx_hash}</div>
//                          </div>
//                       </div>
//                    </div>
//                 </div>
//              </div>
//           )}

//         </div>

//       </div>
//     </main>
//   );
// }

"use client";
import { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { 
  FileJson, 
  PenTool, 
  Stamp, 
  CheckCircle2, 
  ArrowRight,
  Fingerprint,
  Link,
  Smartphone,
  Copy
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
        if(data.license_id) addLog(`🔑 GENERATED LICENSE ID: ${data.license_id}`);
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
    <main className="min-h-screen bg-[#fafafa] text-slate-800 p-8 font-sans selection:bg-purple-100 selection:text-purple-900">
      
      {/* HEADER */}
      <header className="max-w-6xl mx-auto mb-10 border-b border-black/40  pb-6 mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)]"/>
          <h2 className="text-4xl font-mono text-purple-600 font-bold tracking-widest uppercase">Protocol 3</h2>
        </div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Credential Issuance</h2>
        <p className="text-slate-500 mt-2 text-lg font-medium">
          Issue a Schema-Compliant Credential to the Wallet & Anchor to Chain.
        </p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        
        {/* LEFT COLUMN: EDITOR */}
        <div className="space-y-6">
          <div className="bg-white border border-black/40 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none transform translate-x-4 -translate-y-4">
               <PenTool className="w-48 h-48 text-purple-900" />
             </div>

             <h3 className="text-slate-900 font-bold mb-6 flex items-center gap-2.5 text-lg">
               <div className="p-2 bg-purple-50 rounded-lg">
                 <FileJson className="w-5 h-5 text-purple-600" />
               </div>
               Credential Details
             </h3>

             <div className="space-y-5 relative z-10">
               {/* ISSUER */}
               <div>
                 <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1.5 block">Issuer DID (You)</label>
                 <input 
                   type="text" value={issuerDid} onChange={e => setIssuerDid(e.target.value)}
                   className="w-full bg-slate-50 border border-black/40  text-slate-600 font-mono text-xs rounded-xl p-3.5 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 outline-none transition-all shadow-sm"
                 />
               </div>

               {/* RECIPIENT - HIGHLIGHTED */}
               <div>
                 <label className="text-[10px] uppercase text-purple-600 font-bold tracking-wider flex justify-between mb-1.5">
                   <span>Recipient Connection ID</span>
                   <span className="text-[9px] bg-purple-100 px-2 py-0.5 rounded text-purple-700">From Protocol 1</span>
                 </label>
                 <input 
                   type="text" 
                   placeholder="e.g. 55544330-3219-4ecf-bc65-..." 
                   value={subjectDid} 
                   onChange={e => setSubjectDid(e.target.value)}
                   className="w-full bg-purple-50/50 border border-purple-200 text-purple-900 font-mono text-xs rounded-xl p-3.5 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 outline-none transition-all shadow-sm placeholder:text-purple-300"
                 />
               </div>

               {/* ATTRIBUTES */}
               <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1.5 block">Holder Name</label>
                    <input 
                      type="text" value={holderName} onChange={e => setHolderName(e.target.value)}
                      className="w-full bg-slate-50 border border-black/40  text-slate-900 text-sm rounded-xl p-3.5 outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1.5 block">Role</label>
                    <input 
                      type="text" value={holderRole} onChange={e => setHolderRole(e.target.value)}
                      className="w-full bg-slate-50 border border-black/40  text-slate-900 text-sm rounded-xl p-3.5 outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 transition-all shadow-sm"
                    />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-5">
                 <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1.5 block">License Type</label>
                    <select 
                      value={credType} onChange={e => setCredType(e.target.value)}
                      className="w-full bg-slate-50 border border-black/40  text-slate-900 text-sm rounded-xl p-3.5 outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 transition-all shadow-sm cursor-pointer"
                    >
                      <option>DeFi Trading License</option>
                      <option>Personal Assistant ID</option>
                      <option>Medical Proxy Auth</option>
                    </select>
                 </div>
                 <div className="flex flex-col">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1.5 block">Expiry Date</label>
                    <DatePicker
                      selected={new Date(expiry)}
                      onChange={(date:any) => setExpiry(date.toISOString().split('T')[0])}
                      dateFormat="yyyy-MM-dd"
                      className="w-full bg-slate-50 border border-black/40  text-slate-900 text-sm rounded-xl p-3.5 outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-400/10 transition-all shadow-sm"
                    />
                 </div>
               </div>

               <div className="pt-6">
                 <button 
                   onClick={issueCredential}
                   disabled={loading || !subjectDid}
                   className={`w-full py-4 rounded-xl font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                     ${loading || !subjectDid ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-black/40 " : "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"}
                   `}
                 >
                   {loading ? "ISSUING CREDENTIAL..." : "ISSUE & ANCHOR"} <ArrowRight className="w-4 h-4" />
                 </button>
               </div>
             </div>
          </div>

          {/* CONSOLE LOGS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-40 overflow-y-auto font-mono text-[11px] text-emerald-400 shadow-inner">
            {logs.length===0 && <span className="text-slate-500">Waiting for issuance protocol to begin...</span>}
            {logs.map((l,i) => <div key={i} className="mb-1 leading-relaxed">{l}</div>)}
          </div>
        </div>


        {/* RIGHT COLUMN: VISUALIZER */}
        <div className="space-y-6">
          
          {/* 1. JSON PREVIEW */}
          <div className={`transition-all duration-500 ${step === 3 ? "opacity-40 blur-[2px] pointer-events-none" : "opacity-100"}`}>
             <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex justify-between tracking-wider">
                <span>Payload Preview</span>
                <span className="text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded">JSON-LD</span>
             </h4>
             <div className="bg-white p-5 rounded-2xl border border-black/40  font-mono text-[11px] text-slate-600 leading-relaxed overflow-x-auto shadow-sm">
                <pre>{JSON.stringify(previewJson, null, 2)}</pre>
             </div>
          </div>

          {/* 2. SUCCESS CERTIFICATE */}
          {step === 3 && resultData && (
             <div className="animate-in zoom-in slide-in-from-bottom-4 duration-700 relative">
                {/* Glowing Border */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-2xl blur-lg opacity-30"></div>
                
                <div className="relative bg-white border border-purple-100 rounded-2xl p-8 shadow-xl overflow-hidden">
                   {/* Decorative background shape */}
                   <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10"></div>

                   {/* Badge */}
                   <div className="absolute -top-4 right-6 bg-white border border-purple-200 text-purple-600 p-3 rounded-full shadow-md z-10">
                      <Stamp className="w-8 h-8" />
                   </div>

                   <div className="mb-8">
                      <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Verifiable Credential</h3>
                      <div className="flex items-center gap-2 text-emerald-600 text-xs font-mono font-semibold bg-emerald-50 w-fit px-3 py-1 rounded-full border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Issued & Anchored</span>
                      </div>
                   </div>

                   {/* UNIQUE LICENSE ID BOX */}
                   <div className="bg-purple-50/50 border border-purple-200/60 p-5 rounded-xl mb-8 flex justify-between items-center shadow-inner">
                       <div>
                           <div className="text-[10px] uppercase text-purple-500 font-bold mb-1.5 tracking-wider">Unique License ID</div>
                           <div className="text-xl md:text-2xl text-purple-900 font-mono font-bold tracking-widest break-all">
                               {resultData.license_id || "MISSING FROM BACKEND"}
                           </div>
                       </div>
                       <button 
                           onClick={() => {
                               if(resultData.license_id) {
                                   navigator.clipboard.writeText(resultData.license_id);
                                   alert("License ID copied to clipboard!");
                               }
                           }}
                           className="flex items-center gap-1.5 bg-white border border-purple-200 hover:bg-purple-50 hover:border-purple-300 text-purple-700 text-[10px] px-3 py-2 rounded-lg font-bold uppercase transition-all shadow-sm active:scale-95 ml-4 shrink-0"
                       >
                           <Copy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Copy</span>
                       </button>
                   </div>

                   <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                         <div className="text-[9px] uppercase text-slate-400 font-bold mb-1.5">Holder Name</div>
                         <div className="text-xs text-slate-800 font-semibold truncate">{holderName}</div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                         <div className="text-[9px] uppercase text-slate-400 font-bold mb-1.5">License</div>
                         <div className="text-xs text-slate-800 font-semibold">{credType}</div>
                      </div>
                   </div>

                   <div className="border-t border-slate-100 pt-5 space-y-4">
                      <div className="flex items-center gap-3.5">
                         <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                           <Smartphone className="w-4 h-4 text-emerald-600" />
                         </div>
                         <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Wallet Delivery</div>
                            <div className="text-[10px] text-emerald-600 font-mono font-semibold">SENT TO PHONE</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-3.5">
                         <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                           <Link className="w-4 h-4 text-blue-600" />
                         </div>
                         <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">IPFS Metadata</div>
                            <div className="text-[10px] text-blue-600 font-mono truncate">{resultData.ipfs_cid}</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-3.5">
                         <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                           <Fingerprint className="w-4 h-4 text-purple-600" />
                         </div>
                         <div className="flex-1 overflow-hidden">
                            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Blockchain Anchor</div>
                            <div className="text-[10px] text-purple-600 font-mono truncate">{resultData.tx_hash}</div>
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
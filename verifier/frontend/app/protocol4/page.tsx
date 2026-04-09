"use client";
import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Smartphone,
  Scan,
  Lock,
  Unlock,
  ArrowRight,
  QrCode,
  CheckCircle2,
  XCircle
} from "lucide-react";

export default function Protocol4Page() {
  // --- STATE ---
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Login, 2: Ready, 3: Verifying, 4: Result
  const [connectionId, setConnectionId] = useState(""); 
  const [qrUrl, setQrUrl] = useState("");
  const [claimType, setClaimType] = useState("DeFiTradingLicense");
  
  const [loading, setLoading] = useState(false);
  const [presExId, setPresExId] = useState("");
  const [verifyResult, setVerifyResult] = useState<{verified: boolean, details: string} | null>(null);

  // --- STEP 1: DEFI LOGIN (GENERATE QR) ---
  const generateLoginQR = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8012/protocol4/connect-verifier", { method: "POST" });
      const data = await res.json();
      
      setConnectionId(data.connection_id);
      // We use a free API to turn the URL into a QR code
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.invitation_url)}&color=22c55e&bgcolor=09090b`);
      
    } catch (e) {
      console.error(e);
      alert("Failed to generate login QR");
    } finally {
      setLoading(false);
    }
  };

  // AUTO-POLL CONNECTION STATUS
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connectionId && step === 1) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8012/protocol4/check-connection/${connectionId}`);
          const data = await res.json();
          if (data.connected) {
            setStep(2); // Move to Proof Request
            clearInterval(interval);
          }
        } catch (e) {}
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [connectionId, step]);

  // --- STEP 2: REQUEST ZK PROOF ---
  const requestProof = async () => {
    setLoading(true);
    setStep(3); // Verifying Step

    try {
      const response = await fetch("http://127.0.0.1:8012/protocol4/request-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           challenge: claimType,
           verkey: connectionId,
           presentation_json: {} // <-- Add this line back!
        }),
      });

      const data = await response.json();
      if (data.status === "sent") {
        setPresExId(data.presentation_exchange_id);
      } else {
        throw new Error("Request Failed");
      }
    } catch (err: any) {
      setVerifyResult({ verified: false, details: err.message });
      setStep(4);
      setLoading(false);
    }
  };

  // AUTO-POLL ZK PROOF STATUS
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 3 && presExId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8012/protocol4/check-proof/${presExId}`);
          const data = await res.json();
          
          if (data.verified === true) {
            setVerifyResult({ verified: true, details: data.details });
            setStep(4);
            setLoading(false);
            clearInterval(interval);
          } 
          else if (data.verified === false || data.status === "failed") {
            setVerifyResult({ verified: false, details: data.details || "Proof Rejected" });
            setStep(4);
            setLoading(false);
            clearInterval(interval);
          }
        } catch (e) {}
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [step, presExId]);


  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-green-500/30">
      
      <header className="max-w-5xl mx-auto mb-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-green-500 tracking-widest uppercase">Protocol 4</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Zero-Knowledge Verification</h2>
        <p className="text-slate-400 mt-2 text-lg">
          DeFi Platform requesting cryptographic proof of identity without revealing underlying data.
        </p>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT COLUMN: CONTROLS */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6 shadow-2xl relative min-h-[400px] flex flex-col justify-center">
            
            {step === 1 && (
                <div className="text-center animate-in fade-in zoom-in duration-300">
                    <QrCode className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Connect BC Wallet</h3>
                    <p className="text-sm text-slate-400 mb-6 max-w-xs mx-auto">
                        Scan the QR code below with your BC Wallet to establish a secure peer-to-peer connection with the DeFi Platform.
                    </p>
                    
                    {qrUrl ? (
                        <div className="bg-black p-4 rounded-xl inline-block border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.15)] mb-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrUrl} alt="Login QR" className="w-48 h-48 rounded" />
                        </div>
                    ) : (
                        <button 
                            onClick={generateLoginQR} 
                            disabled={loading}
                            className="bg-green-700 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-bold text-xs tracking-widest uppercase transition-all shadow-lg shadow-green-900/20"
                        >
                            {loading ? "GENERATING..." : "GENERATE LOGIN QR"}
                        </button>
                    )}
                    {qrUrl && <p className="text-[10px] text-green-400 font-mono animate-pulse uppercase tracking-widest mt-2">Waiting for Scan...</p>}
                </div>
            )}

            {step >= 2 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <div className="bg-green-900/20 border border-green-500/30 text-green-400 text-xs px-4 py-2 rounded mb-6 flex items-center justify-center gap-2">
                        <Smartphone className="w-4 h-4"/> Phone Connected!
                    </div>

                    <h3 className="text-sm font-bold text-green-400 uppercase mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Request Cryptographic Proof
                    </h3>
                    
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">License to Verify</label>
                            <select 
                                value={claimType}
                                onChange={e => setClaimType(e.target.value)}
                                className="w-full bg-black/50 border border-slate-700 text-white rounded px-3 py-3 text-xs outline-none focus:border-green-500"
                            >
                                <option value="DeFiTradingLicense">DeFi Trading License</option>
                                <option value="PersonalAssistantID">Personal Assistant ID</option>
                                <option value="MedicalProxyAuth">Medical Proxy Auth</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        onClick={requestProof} 
                        disabled={loading || step > 2}
                        className={`w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all
                            ${step > 2 ? "bg-slate-800 text-slate-500" : "bg-green-700 hover:bg-green-600 text-white shadow-lg shadow-green-900/20"}
                        `}
                    >
                        {step === 3 ? "WAITING FOR PHONE..." : "REQUEST PROOF"} <ArrowRight className="w-3 h-3"/>
                    </button>
                </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: STATUS VISUALIZER */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-8 relative overflow-hidden h-full flex flex-col items-center justify-center text-center min-h-[400px]">
             
             {/* BACKGROUND ICON */}
             <div className="absolute opacity-5 pointer-events-none">
                <ShieldCheck className="w-64 h-64 text-white" />
             </div>

             {/* STATUS STATES */}
             {step <= 2 && (
               <div className="relative z-10 text-slate-500">
                  <Scan className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-bold">Awaiting Request</h3>
                  <p className="text-xs mt-2">Connect wallet and select a license.</p>
               </div>
             )}

             {step === 3 && (
               <div className="relative z-10">
                  <div className="w-20 h-20 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-6"></div>
                  <h3 className="text-xl font-bold text-white animate-pulse">Check Your Phone</h3>
                  <p className="text-sm text-green-400 mt-2">Waiting for User Approval...</p>
                  <p className="text-xs text-slate-500 mt-4 max-w-xs mx-auto">
                    The Agent is calculating a Zero-Knowledge Proof. No private data is leaving the device.
                  </p>
               </div>
             )}

             {step === 4 && verifyResult?.verified && (
               <div className="relative z-10 animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                     <Unlock className="w-10 h-10 text-black" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">ACCESS GRANTED</h3>
                  <div className="bg-green-900/20 border border-green-500/30 rounded px-4 py-2 mt-4 inline-flex items-center gap-2">
                     <CheckCircle2 className="w-4 h-4 text-green-500" />
                     <span className="text-xs text-green-400 font-mono">Proof Cryptographically Verified</span>
                  </div>
               </div>
             )}

             {step === 4 && !verifyResult?.verified && (
               <div className="relative z-10 animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                     <Lock className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">ACCESS DENIED</h3>
                  <div className="bg-red-900/20 border border-red-500/30 rounded px-4 py-2 mt-4 inline-flex items-center gap-2">
                     <XCircle className="w-4 h-4 text-red-500" />
                     <span className="text-[10px] text-red-400 font-mono max-w-[200px] truncate" title={verifyResult?.details}>
                        {verifyResult?.details}
                     </span>
                  </div>
                  <button onClick={() => setStep(2)} className="mt-6 text-xs text-slate-500 hover:text-white underline decoration-slate-700 underline-offset-4">
                     Try Again
                  </button>
               </div>
             )}

          </div>
        </div>

      </div>
    </main>
  );
}
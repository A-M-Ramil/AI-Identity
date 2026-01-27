"use client";
import { useState } from "react";
import { 
  ShieldCheck, 
  Fingerprint, 
  Database, 
  Server, 
  CheckCircle, 
  AlertCircle, 
  Terminal, 
  Copy, 
  ExternalLink 
} from "lucide-react";

export default function Protocol1Page() {
  // State
  const [govID, setGovID] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [showLogs, setShowLogs] = useState(false);

  // Simulation Steps for the UI Progress Bar
  const steps = [
    { id: 1, label: "Biometric Liveness (M4-M5)", icon: Fingerprint },
    { id: 2, label: "SSI Key Generation (M6-M7)", icon: ShieldCheck },
    { id: 3, label: "IPFS Storage (M8)", icon: Database },
    { id: 4, label: "Blockchain Anchor (M9-M11)", icon: Server },
  ];

  const registerIdentity = async () => {
    if (!govID) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCurrentStep(1); // Start Bio Check

    try {
      // Simulate Step 1 Visual (Biometrics)
      await new Promise(r => setTimeout(r, 800)); 
      setCurrentStep(2); // Start ACA-Py

      const response = await fetch("http://127.0.0.1:8002/protocol1/create-ssi-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gov_id: govID }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setCurrentStep(3); // IPFS done (backend returns fast)
        await new Promise(r => setTimeout(r, 600)); 
        setCurrentStep(4); // Chain done
        setResult(data);
      } else {
        throw new Error(data.detail || "Registration Failed");
      }
    } catch (err: any) {
      setError(err.message);
      setCurrentStep(0);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-cyan-500/30">
      
      {/* HEADER */}
      <header className="max-w-4xl mx-auto mb-12 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-cyan-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-cyan-500 tracking-widest uppercase">Protocol 1</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Self-Sovereign Identity Registration</h2>
        <p className="text-slate-400 mt-2 text-lg">
          Anchor a Human Identity to the Blockchain using ACA-Py and IPFS.
        </p>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: FORM */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-cyan-400" />
              Identity Input
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Government ID / Passport No.</label>
                <input 
                  type="text" 
                  value={govID}
                  onChange={(e) => setGovID(e.target.value)}
                  placeholder="e.g. A-1234567-X"
                  className="w-full bg-black/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <button 
                onClick={registerIdentity}
                disabled={loading || !govID}
                className={`w-full py-4 rounded-lg font-bold text-sm tracking-wide transition-all
                  ${loading 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_-5px_rgba(8,145,178,0.5)]"
                  }`}
              >
                {loading ? "PROCESSING CRYPTOGRAPHY..." : "REGISTER IDENTITY (M1-M11)"}
              </button>
            </div>
          </div>

          {/* PROGRESS STEPS */}
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6">
            <h4 className="text-xs font-mono text-slate-500 mb-4 uppercase">System Processes</h4>
            <div className="space-y-4">
              {steps.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id || result;
                
                return (
                  <div key={step.id} className={`flex items-center gap-3 ${isCompleted || isActive ? "opacity-100" : "opacity-30"}`}>
                    <div className={`p-2 rounded-full ${isCompleted ? "bg-green-500/20 text-green-400" : isActive ? "bg-cyan-500/20 text-cyan-400 animate-pulse" : "bg-slate-800 text-slate-500"}`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={`text-sm ${isCompleted ? "text-green-400" : isActive ? "text-cyan-300" : "text-slate-500"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RESULT CARD */}
        <div className="relative">
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-200">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-mono">{error}</span>
            </div>
          )}

          {result ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* THE DIGITAL ID CARD */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl shadow-2xl p-6 group hover:border-cyan-500/50 transition-colors">
                
                {/* Holographic Top Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500" />
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Decentralized ID</h3>
                    <span className="text-xs font-mono text-green-400 flex items-center gap-1 mt-1">
                      <CheckCircle className="w-3 h-3" /> Anchored on Ethereum
                    </span>
                  </div>
                  <div className="h-10 w-10 bg-white p-1 rounded-md">
                    {/* Placeholder QR Code */}
                    <div className="w-full h-full bg-slate-900 grid grid-cols-4 grid-rows-4 gap-[1px]">
                       {[...Array(16)].map((_,i) => <div key={i} className={`bg-black ${Math.random()>0.5 ? 'opacity-100':'opacity-0'}`} />)}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">DID (Identity)</label>
                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-slate-800 group-hover:border-cyan-500/30 transition-colors">
                      <code className="text-xs text-cyan-300 font-mono truncate flex-1">{result.ssi_did}</code>
                      <button onClick={() => copyToClipboard(result.ssi_did)} className="text-slate-500 hover:text-white"><Copy className="w-3 h-3"/></button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Verkey (Public Key)</label>
                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-slate-800">
                      <code className="text-xs text-purple-300 font-mono truncate flex-1">{result.verkey}</code>
                      <button onClick={() => copyToClipboard(result.verkey)} className="text-slate-500 hover:text-white"><Copy className="w-3 h-3"/></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <a href={result.view_url} target="_blank" className="flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 py-2 rounded border border-slate-700 transition-all text-slate-300">
                      <Database className="w-3 h-3" /> View IPFS
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                    <div className="flex flex-col items-center justify-center bg-slate-800/50 rounded border border-slate-800">
                      <span className="text-[9px] text-slate-500 uppercase">Block Hash</span>
                      <span className="text-[10px] font-mono text-slate-300">{result.blockchain_tx.slice(0,8)}...</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Toggle Logs */}
              <button 
                onClick={() => setShowLogs(!showLogs)}
                className="mt-6 flex items-center gap-2 text-xs text-slate-500 hover:text-cyan-400 transition-colors w-full justify-center"
              >
                <Terminal className="w-3 h-3" />
                {showLogs ? "Hide Supervisor Logs" : "Show Supervisor Logs"}
              </button>

              {showLogs && (
                <div className="mt-4 p-4 bg-black border border-slate-800 rounded-lg font-mono text-[10px] text-green-500 h-48 overflow-y-auto">
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}

            </div>
          ) : (
            /* EMPTY STATE PLACEHOLDER */
            <div className="h-full border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-12 text-slate-600">
              <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">Ready to Register</p>
              <p className="text-xs mt-1">Waiting for user input...</p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
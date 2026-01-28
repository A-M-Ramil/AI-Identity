"use client";
import { useState } from "react";
import { 
  Wallet, 
  ArrowRight, 
  CheckCircle2, 
  QrCode,
  Smartphone,
  Fingerprint,
  FileBadge,
  Key,
  Link as LinkIcon,
  Globe
} from "lucide-react";

declare global { interface Window { ethereum?: any; } }

export default function Protocol1Page() {
  // STATE
  const [metaMaskAddress, setMetaMaskAddress] = useState("");
  
  const [govId, setGovId] = useState("");
  const [fullName, setFullName] = useState("");
  
  // Real Data from ACA-Py
  const [did, setDid] = useState("");
  const [verkey, setVerkey] = useState("");
  const [ipfsCid, setIpfsCid] = useState("");
  const [txHash, setTxHash] = useState("");
  
  const [invitationUrl, setInvitationUrl] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [qrCodeData, setQrCodeData] = useState(""); 
  
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  // 1. METAMASK
  const connectMetaMask = async () => {
    if (!window.ethereum) return alert("Install MetaMask!");
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setMetaMaskAddress(accounts[0]);
    } catch (e: any) { alert(e.message); }
  };

  // 2. GENERATE IDENTITY (CALLS BACKEND)
  const generateIdentity = async () => {
    if (!metaMaskAddress || !govId) return alert("Connect Wallet and enter Gov ID.");
    setLoading(true);

    try {
        const response = await fetch("http://127.0.0.1:8002/protocol1/create-ssi-identity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gov_id: govId, name: fullName })
        });
        const data = await response.json();

        if (data.status === "success") {
            setDid(data.ssi_did);
            setVerkey(data.verkey);
            setIpfsCid(data.ipfs_cid);
            setTxHash(data.blockchain_tx);
        } else {
            alert("Generation Failed: " + JSON.stringify(data));
        }
    } catch (e: any) {
        alert("Error: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  // 3. MOBILE LINK
  const connectSSIWallet = async () => {
    if (!did) return alert("Generate your DID first!");
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8002/protocol1/connect-wallet", { method: "POST" });
      const data = await response.json();
      
      setInvitationUrl(data.invitation_url);
      setConnectionId(data.connection_id);
      setQrCodeData(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.invitation_url)}`);
      
      pollConnection(data.connection_id);
    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  const pollConnection = (connId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8002/protocol1/check-connection/${connId}`);
        const data = await res.json();
        
        if (data.connected) {
           clearInterval(interval);
           setConnected(true);
           setLoading(false);
           
           // LINK TO METAMASK IN BACKEND
           await fetch("http://127.0.0.1:8002/protocol1/link-wallet", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ 
                 connection_id: connId, 
                 wallet_address: metaMaskAddress,
                 did: did
               })
           });
        }
      } catch (e) { console.error(e); }
    }, 2000);
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-indigo-500/30">
      <header className="max-w-6xl mx-auto mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-sm font-mono text-indigo-500 tracking-widest uppercase mb-2">Protocol 1 (Full Implementation)</h1>
        <h2 className="text-3xl font-bold text-white">Identity Nexus</h2>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT: IDENTITY CREATION */}
        <div className="space-y-6">
          
          {/* A. FINANCIAL */}
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5">
             <h3 className="text-white font-bold mb-3 flex items-center gap-2">
               <Wallet className="w-5 h-5 text-indigo-400" /> 1. Financial Anchor
             </h3>
             {!metaMaskAddress ? (
               <button onClick={connectMetaMask} className="w-full py-3 bg-orange-700 hover:bg-orange-600 text-white font-bold rounded">Connect MetaMask</button>
             ) : (
               <div className="bg-black/50 p-3 rounded border border-slate-700 text-xs font-mono text-green-400">{metaMaskAddress}</div>
             )}
          </div>

          {/* B. ATTRIBUTES */}
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5">
             <h3 className="text-white font-bold mb-3 flex items-center gap-2">
               <FileBadge className="w-5 h-5 text-indigo-400" /> 2. Attributes
             </h3>
             <div className="space-y-3">
                <input type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded p-3 text-xs outline-none text-white"/>
                <input type="text" placeholder="Gov ID / Passport" value={govId} onChange={e => setGovId(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded p-3 text-xs outline-none text-white"/>
                <button onClick={generateIdentity} disabled={loading || !!did} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded">
                  {loading && !did ? "GENERATING ON ACA-PY..." : "GENERATE DID & KEYS"}
                </button>
             </div>
          </div>

          {/* C. DID OUTPUT (REAL) */}
          {did && (
            <div className="bg-[#18181b] border border-indigo-500/30 rounded-xl p-5 animate-in fade-in">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-indigo-400" /> 3. Sovereign Identity (ACA-Py)
              </h3>
              <div className="space-y-2 text-[10px] font-mono">
                 <div className="bg-black/50 p-2 rounded">
                    <span className="text-slate-500 block">DID (Decentralized Identifier)</span>
                    <span className="text-indigo-300 break-all">{did}</span>
                 </div>
                 <div className="bg-black/50 p-2 rounded">
                    <span className="text-slate-500 block">Verkey (Public Key)</span>
                    <span className="text-slate-300 break-all">{verkey}</span>
                 </div>
                 <div className=" gap-5">
                    <div className="bg-black/50 p-2 rounded">
                       <span className="text-slate-500 block flex gap-1"><Globe className="w-3 h-3"/> IPFS CID</span>
                       <span className="text-blue-300 truncate">{ipfsCid}</span>
                    </div>
                    <div className="bg-black/50 mt-2 p-2 rounded">
                       <span className="text-slate-500 block">Blockchain TX</span>
                       <span className="text-slate-300 truncate">{txHash}</span>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: AGENT LINK */}
        <div className="space-y-6">
           <div className={`h-full border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center ${connected ? "bg-green-900/10 border-green-500/50" : "bg-[#18181b]"}`}>
              <Smartphone className="w-12 h-12 text-indigo-400 mb-4" />
              <h3 className="text-white font-bold mb-4">4. Link Mobile Agent</h3>
              
              {!did ? (
                 <p className="text-slate-500 text-sm">Complete Steps 1-3 first.</p>
              ) : (
                 !invitationUrl ? (
                    <button onClick={connectSSIWallet} disabled={loading} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded">
                      {loading ? "Creating..." : "Create Mobile Link"}
                    </button>
                 ) : (
                    <div className="text-center animate-in zoom-in">
                        {!connected ? (
                           <div className="bg-white p-4 rounded-xl inline-block mb-4">
                              <img src={qrCodeData} alt="QR" className="w-48 h-48" />
                           </div>
                        ) : (
                           <div className="mb-6">
                              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-2" />
                              <h3 className="text-xl font-bold text-white">SYNC COMPLETE</h3>
                           </div>
                        )}
                        <div className="text-[10px] font-mono text-slate-500">Connection ID: {connectionId}</div>
                    </div>
                 )
              )}
           </div>
        </div>

      </div>
    </main>
  );
}
"use client";
import { useState, useEffect } from "react";
import { 
  Bot, 
  Cpu, 
  Wallet, 
  ArrowRight, 
  Hash,
  Coins,
  RefreshCw,
  Server,
  Activity
} from "lucide-react";

export default function Protocol2Page() {
  // --- STATE ---
  const [ownerDid, setOwnerDid] = useState("");
  const [modelArch, setModelArch] = useState("Transformer-6B");
  const [version, setVersion] = useState("v2.1.5");
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null); // Current Registration Result
  const [fleet, setFleet] = useState<any[]>([]); // List of all Agents

  // Funding State
  const [fundAmount, setFundAmount] = useState("1.0");
  const [funding, setFunding] = useState(false);
  const [balance, setBalance] = useState(0);

  // --- 1. ACTIONS: REGISTER ---
  const registerAgent = async () => {
    if (!ownerDid) return alert("Enter Owner DID");
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("http://127.0.0.1:8012/protocol2/register-abcd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          owner_did: ownerDid, 
          model_architecture: modelArch,
          version_tag: version,
          training_hash: "sha256:" + Math.random().toString(36).substring(7) 
        }),
      });
      const data = await res.json();
      
      if (data.status === "success") {
        setResult(data);
        // Using your original structure, but passing the address to the new MetaMask fetcher
        fetchBalance(data.abcd_layers.C.wallet_address);
        fetchFleet(); 
      } else {
        alert("Error: " + data.detail);
      }
    } catch (e:any) {
      alert("Network Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. ACTIONS: FUNDING ---
  const fundAgent = async () => {
    if (!result) return;
    if (typeof (window as any).ethereum === 'undefined') return alert("MetaMask not found");

    setFunding(true);
    try {
      // Using your original structure
      const agentAddress = result.abcd_layers.C.wallet_address;
      const amountWei = BigInt(Math.floor(parseFloat(fundAmount) * 1e18)).toString(16);

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
            from: (window as any).ethereum.selectedAddress, 
            to: agentAddress,
            value: "0x" + amountWei, 
        }],
      });

      alert(`Transaction Sent! Hash: ${txHash}`);
      
      setTimeout(() => {
         fetchBalance(agentAddress);
      }, 4000);

    } catch (e: any) {
      console.error(e);
      alert("Funding Failed: " + e.message);
    } finally {
      setFunding(false);
    }
  };

  // --- 3. HELPERS ---
  
  // FIXED: Fetch balance via MetaMask instead of backend to prevent the 404 error
  const fetchBalance = async (address: string) => {
    if (typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined') {
      try {
        const balanceWei = await (window as any).ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest']
        });
        const balanceEth = parseInt(balanceWei, 16) / 1e18;
        setBalance(balanceEth);
      } catch (e) { 
        console.error("Web3 Balance fetch error", e); 
      }
    }
  };

  const fetchFleet = async () => {
    if (!ownerDid) return;
    try {
      const res = await fetch(`http://127.0.0.1:8012/protocol2/fetch-fleet/${ownerDid}`);
      const data = await res.json();
      if (data.status === "success") {
        setFleet(data.agents);
      }
    } catch (e) { console.error("Fleet fetch error", e); }
  };

  useEffect(() => {
    if (ownerDid.length > 10) fetchFleet();
  }, [ownerDid]);


  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-blue-500/30">
      
      <header className="max-w-6xl mx-auto mb-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-blue-500 tracking-widest uppercase">Protocol 2 (ABCD)</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">AI Identity & Fleet Management</h2>
        <p className="text-slate-400 mt-2 text-lg">
          Register Algorithmic Fingerprints (Layer A) and Manage Cryptographic Wallets (Layer C).
        </p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        
        {/* LEFT: REGISTRATION */}
        <div className="space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <h3 className="text-white font-bold mb-6 flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" /> 1. Register New Agent
            </h3>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Owner Identity (Layer D Link)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={ownerDid} onChange={e => setOwnerDid(e.target.value)}
                    placeholder="Paste your Owner DID..."
                    className="w-full bg-black/50 border border-slate-700 text-white rounded p-3 text-xs font-mono focus:border-blue-500 outline-none"
                  />
                  <button onClick={fetchFleet} className="bg-slate-800 hover:bg-slate-700 p-3 rounded text-slate-400">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block flex gap-2">
                    <Cpu className="w-3 h-3"/> Model Arch (Layer A)
                  </label>
                  <input 
                    type="text" value={modelArch} onChange={e => setModelArch(e.target.value)}
                    className="w-full bg-black/50 border border-slate-700 text-white rounded p-3 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block flex gap-2">
                    <Hash className="w-3 h-3"/> Version Tag (Layer A)
                  </label>
                  <input 
                    type="text" value={version} onChange={e => setVersion(e.target.value)}
                    className="w-full bg-black/50 border border-slate-700 text-white rounded p-3 text-xs outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={registerAgent} disabled={loading || !ownerDid}
                className={`w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-all
                  ${loading ? "bg-slate-800 text-slate-500" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"}
                `}
              >
                {loading ? "ANCHORING LAYERS..." : "GENERATE IDENTITY & WALLET"} <ArrowRight className="w-3 h-3"/>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: CURRENT AGENT DETAILS */}
        <div className="space-y-6">
          {result ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              
              {/* WALLET CARD */}
              <div className="bg-[#18181b] border border-yellow-500/30 rounded-xl p-6 shadow-2xl relative">
                 <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Wallet className="w-32 h-32 text-yellow-500" />
                 </div>
                 <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                   <Wallet className="w-5 h-5 text-yellow-500" /> Agent Wallet (Layer C)
                 </h3>
                 
                 <div className="bg-black/50 p-3 rounded border border-slate-700 mb-4 relative z-10">
                   <label className="text-[9px] uppercase text-slate-500 font-bold block mb-1">Public Address</label>
                   <code className="text-xs text-yellow-200 font-mono break-all">
                     {result.abcd_layers.C.wallet_address}
                   </code>
                 </div>

                 <div className="flex items-center justify-between bg-black/30 p-4 rounded-lg border border-slate-800 relative z-10">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Balance</span>
                      <span className="text-2xl text-white font-mono">{balance.toFixed(4)} <span className="text-sm text-slate-500">ETH</span></span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <input 
                         type="number" 
                         value={fundAmount} 
                         onChange={e => setFundAmount(e.target.value)}
                         className="w-16 bg-black border border-slate-700 text-white text-xs rounded p-2 text-center outline-none"
                       />
                       <button 
                         onClick={fundAgent}
                         disabled={funding}
                         className="bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold px-3 py-2 rounded uppercase flex items-center gap-1 transition-colors"
                       >
                         {funding ? "..." : <><Coins className="w-3 h-3" /> Fund</>}
                       </button>
                       <button onClick={() => fetchBalance(result.abcd_layers.C.wallet_address)} className="p-2 rounded bg-slate-800 hover:bg-slate-700">
                          <RefreshCw className="w-3 h-3 text-slate-400" />
                       </button>
                    </div>
                 </div>
              </div>

              {/* IDENTITY SUMMARY */}
              <div className="bg-[#0F0F12] border border-blue-500/30 rounded-xl p-4 text-[10px] font-mono text-slate-400">
                 <div className="flex justify-between mb-2">
                    <span>AGENT DID:</span>
                    <span className="text-blue-300">{result.abcd_layers.C.did}</span>
                 </div>
                 <div className="flex justify-between">
                    <span>TX HASH:</span>
                    <span className="text-slate-500">{result.tx_hash}</span>
                 </div>
              </div>

            </div>
          ) : (
            <div className="h-full border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-12 text-slate-600">
               <Bot className="w-16 h-16 mb-4 opacity-20" />
               <p className="text-sm">Ready to Register</p>
               <p className="text-xs mt-1">Define ABCD Layers to initialize Agent.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- FLEET VIEW SECTION (RESTORED) --- */}
      <section className="max-w-6xl mx-auto border-t border-slate-800 pt-10">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
               <Server className="w-6 h-6 text-slate-500" /> 
               Agent Fleet 
               <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{fleet.length} Active</span>
            </h3>
            <button onClick={fetchFleet} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
               <RefreshCw className="w-3 h-3" /> Refresh List
            </button>
         </div>

         {fleet.length === 0 ? (
            <div className="text-center py-12 bg-[#18181b] rounded-xl border border-slate-800">
               <p className="text-slate-600 text-sm">No agents found for this Owner DID.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {fleet.map((agent, i) => (
                  <div key={i} className="bg-[#18181b] border border-slate-800 rounded-lg p-4 hover:border-blue-500/50 transition-colors group">
                     <div className="flex justify-between items-start mb-3">
                        <div className="bg-blue-900/20 text-blue-400 p-2 rounded-lg">
                           <Bot className="w-5 h-5" />
                        </div>
                        {agent.is_active ? (
                           <span className="flex items-center gap-1 text-[9px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">
                              <Activity className="w-3 h-3" /> ONLINE
                           </span>
                        ) : (
                           <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded">OFFLINE</span>
                        )}
                     </div>
                     
                     <div className="space-y-2">
                        <div>
                           <label className="text-[9px] uppercase text-slate-500 font-bold">On-Chain Hash</label>
                           <div className="text-[10px] font-mono text-slate-300 truncate" title={agent.agent_hash}>
                              {agent.agent_hash}
                           </div>
                        </div>
                        <div>
                           <label className="text-[9px] uppercase text-slate-500 font-bold">Model Role Hash</label>
                           <div className="text-[10px] font-mono text-slate-400 truncate" title={agent.role_hash}>
                              {agent.role_hash}
                           </div>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         )}
      </section>

    </main>
  );
}
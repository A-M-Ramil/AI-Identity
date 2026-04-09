"use client";
import { useState } from "react";
import { 
  Settings, 
  Zap, 
  Search, 
  Clock, 
  Coins, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  Bot,
  ShieldCheck
} from "lucide-react";

export default function Protocol6Page() {
  const [ownerAddress, setOwnerAddress] = useState("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  const [agentDid, setAgentDid] = useState("");
  const [limit, setLimit] = useState("0.5");
  const [duration, setDuration] = useState("300");
  const [tradeAmount, setTradeAmount] = useState("0.1"); 
  
  const [logs, setLogs] = useState<string[]>([]);
  const [policyData, setPolicyData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // --- 1. DELEGATE ---
  const delegate = async () => {
    if (!agentDid) return alert("Enter Agent DID");
    setLoading(true);
    addLog(`🤝 Setting Policy: Limit ${limit} ETH for ${duration}s...`);
    
    try {
        const response = await fetch("http://127.0.0.1:8012/protocol6/delegate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner_address: ownerAddress,
                agent_did: agentDid,
                spend_limit_eth: parseFloat(limit),
                duration_seconds: parseInt(duration)
            })
        });
        const data = await response.json();
        if(data.status === "success") {
            addLog(`✅ Policy Anchored! TX: ${data.tx_hash}`);
            addLog(`🔹 Authorized EOA: ${data.authorized_agent}`);
            inspectChain(); // Refresh view
        } else {
            throw new Error(data.detail);
        }
    } catch (e: any) { 
        addLog("❌ Error: " + e.message); 
    } finally { 
        setLoading(false); 
    }
  };

  // --- 2. EXECUTE ---
  const executeTrade = async () => {
      if(!agentDid) return alert("Enter Agent DID");
      setLoading(true);
      addLog(`⚙️ Agent attempting to spend ${tradeAmount} ETH...`);
      
      try {
        const response = await fetch("http://127.0.0.1:8012/protocol6/execute-trade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agent_did: agentDid,
                amount_eth: parseFloat(tradeAmount)
            })
        });
        const data = await response.json();
        
        if(data.status === "success") {
            addLog(`✅ SUCCESS: Trade Sent! Hash: ${data.tx_hash}`);
        } else {
            addLog(`⛔ BLOCKED: ${data.reason}`);
            addLog("Policy Violation detected.");
        }
        inspectChain();
    } catch (e: any) { 
        addLog("❌ Error: " + e.message); 
    } finally { 
        setLoading(false); 
    }
  };

  // --- INSPECT ---
  const inspectChain = async () => {
      if(!agentDid) return;
      try {
          const response = await fetch(`http://127.0.0.1:8012/protocol6/inspect/${ownerAddress}/${agentDid}`);
          const data = await response.json();
          if(data.status === "success") setPolicyData(data.on_chain_data);
      } catch (e) { console.error(e); }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-purple-500/30">
      <header className="max-w-6xl mx-auto mb-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-purple-500 tracking-widest uppercase">Protocol 6</h1>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Delegation & Execution</h2>
        <p className="text-slate-400 mt-2 text-lg">
           Enforce on-chain policies on Agents born in Protocol 2.
        </p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COL 1: POLICY */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-400" /> 1. Set Rules
                </h3>
                
                <div className="space-y-4 mb-4">
                     <div className="bg-black/50 border border-slate-700 rounded p-2">
                        <label className="text-[9px] uppercase text-slate-500 font-bold block mb-1">Agent DID</label>
                        <input 
                            type="text" value={agentDid} onChange={e => setAgentDid(e.target.value)}
                            placeholder="did:sov:agent:..."
                            className="w-full bg-transparent text-xs font-mono text-white outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/50 border border-slate-700 rounded p-2">
                            <label className="text-[9px] uppercase text-slate-500 font-bold block mb-1 flex items-center gap-1"><Coins className="w-3 h-3"/> Limit</label>
                            <input type="number" value={limit} onChange={e => setLimit(e.target.value)} className="w-full bg-transparent text-sm font-mono text-white outline-none"/>
                        </div>
                        <div className="bg-black/50 border border-slate-700 rounded p-2">
                            <label className="text-[9px] uppercase text-slate-500 font-bold block mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Time (s)</label>
                            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-transparent text-sm font-mono text-white outline-none"/>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={delegate} disabled={loading || !agentDid}
                    className="w-full bg-purple-700 hover:bg-purple-600 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition-all"
                >
                    {loading ? "Anchoring..." : "Anchor Policy"}
                </button>
            </div>
        </div>

        {/* COL 2: EXECUTION */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5 shadow-lg h-full flex flex-col">
                <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" /> 2. Attempt Trade
                </h3>
                <div className="flex-grow flex flex-col justify-center space-y-6">
                    <div className="bg-black/50 border border-slate-700 rounded p-3">
                        <label className="text-[9px] uppercase text-slate-500 font-bold block mb-1">Amount (ETH)</label>
                        <input 
                            type="number" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)}
                            className="w-full bg-transparent text-xl font-mono text-white outline-none text-center"
                        />
                    </div>
                    <button 
                        onClick={executeTrade} disabled={loading || !agentDid}
                        className="w-full bg-green-700 hover:bg-green-600 text-white py-4 rounded-lg font-bold text-sm uppercase shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? "Processing..." : <>Execute <Zap className="w-4 h-4 fill-current"/></>}
                    </button>
                </div>
            </div>
        </div>

        {/* COL 3: INSPECTOR */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-cyan-400 uppercase flex items-center gap-2">
                        <Search className="w-4 h-4" /> Policy State
                    </h3>
                    <button onClick={inspectChain} className="text-[10px] bg-cyan-900/50 text-cyan-200 px-2 py-1 rounded">REFRESH</button>
                </div>
                {policyData ? (
                    <div className="space-y-3">
                        <div className={`flex items-center gap-2 p-2 rounded text-xs font-bold ${policyData.active ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                             {policyData.active ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                             {policyData.active ? "POLICY ACTIVE" : "POLICY INACTIVE"}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                             <div className="bg-black/40 p-2 rounded"><span className="text-slate-500 block">Limit</span>{policyData.limit_eth} ETH</div>
                             <div className="bg-black/40 p-2 rounded"><span className="text-slate-500 block">Time Left</span>{policyData.seconds_remaining}s</div>
                        </div>
                        <div className="text-[9px] font-mono text-slate-600 text-center pt-2 border-t border-slate-800/50">
                            Authorized EOA: {policyData.agent_eoa?.slice(0,8)}...
                        </div>
                    </div>
                ) : <div className="text-center py-8 text-slate-600 text-xs italic">No Data</div>}
            </div>

            <div className="bg-black border border-slate-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] text-slate-400 scrollbar-thin scrollbar-thumb-slate-700">
                <div className="flex items-center gap-2 text-slate-600 mb-2 border-b border-white/5 pb-1"><Terminal className="w-3 h-3" /> LOGS</div>
                {logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
            </div>
        </div>

      </div>
    </main>
  );
}
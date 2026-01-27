"use client";
import { useState } from "react";
import { 
  Wallet, 
  Settings, 
  Zap, 
  Search, 
  Clock, 
  Coins, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRightLeft
} from "lucide-react";

export default function Protocol6Page() {
  // --- STATE (UNCHANGED) ---
  const [agentAddress, setAgentAddress] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [limit, setLimit] = useState("0.5");
  const [duration, setDuration] = useState("300");
  const [tradeAmount, setTradeAmount] = useState("0.1"); 
  const [logs, setLogs] = useState<string[]>([]);
  const [policyData, setPolicyData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // --- ACTIONS (UNCHANGED) ---
  const deployWallet = async () => {
    const manualWallet = prompt("Enter deployed AgentWallet Address (from Forge output):");
    if (manualWallet) {
        setWalletAddress(manualWallet);
        addLog(`✅ Wallet Connected: ${manualWallet}`);
    }
  };

  const delegate = async () => {
    if (!agentAddress) return alert("Enter Agent Address");
    if (!limit || !duration) return alert("Please set both Limit and Duration");
    
    setLoading(true);
    addLog(`🔹 M1: Defining Policy (Limit: ${limit} ETH, Time: ${duration}s)...`);
    
    try {
        const response = await fetch("http://127.0.0.1:8002/protocol6/delegate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner_address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 
                agent_address: agentAddress,
                spend_limit_eth: parseFloat(limit),
                duration_seconds: parseInt(duration)
            })
        });
        const data = await response.json();
        if(data.status === "success") {
            addLog(`✅ M2: Policy Anchored on Chain! TX: ${data.tx_hash}`);
        }
    } catch (e: any) { addLog("❌ Error: " + e.message); }
    finally { setLoading(false); }
  };

  const executeTrade = async () => {
      const privateKey = prompt("Enter Agent Private Key (to sign trade):");
      if(!privateKey) return;
      
      setLoading(true);
      addLog(`🔹 M3: Agent attempting to spend ${tradeAmount} ETH...`);
      try {
        const response = await fetch("http://127.0.0.1:8002/protocol6/execute-trade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                wallet_address: walletAddress,
                agent_private_key: privateKey,
                amount_eth: parseFloat(tradeAmount)
            })
        });
        const data = await response.json();
        
        if(data.status === "success") {
            addLog(`✅ SUCCESS: Trade Executed! Hash: ${data.tx_hash}`);
        } else {
            addLog(`⛔ BLOCKED: ${data.reason}`);
            addLog("The Smart Contract enforced the Policy!");
        }
    } catch (e: any) { addLog("❌ Error: " + e.message); }
    finally { setLoading(false); }
  };

  const inspectChain = async () => {
      if(!agentAddress) return alert("Enter Agent Address");
      try {
          const owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; 
          const response = await fetch(`http://127.0.0.1:8002/protocol6/inspect/${owner}/${agentAddress}`);
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
        <div className="flex justify-between items-end">
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Delegation Management</h2>
                <p className="text-slate-400 mt-2 text-lg">
                Define and enforce on-chain spending policies for autonomous agents.
                </p>
            </div>
            {walletAddress && (
                <div className="hidden md:flex items-center gap-2 bg-purple-900/20 border border-purple-500/50 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-mono text-purple-300">Wallet Active</span>
                </div>
            )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COL 1: INFRA & POLICY */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* Step 1: Wallet */}
            <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5 shadow-lg relative group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Wallet className="w-16 h-16 text-purple-500" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-400" /> Infrastructure
                </h3>
                <button 
                    onClick={deployWallet} 
                    className={`w-full py-3 rounded-lg font-bold text-xs uppercase transition-all mb-3 border
                        ${walletAddress 
                            ? "bg-green-900/20 border-green-500/50 text-green-400" 
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"}`}
                >
                    {walletAddress ? "Connected" : "Connect Smart Wallet"}
                </button>
                <div className="bg-black/50 border border-slate-700 rounded p-2">
                    <label className="text-[9px] uppercase text-slate-500 font-bold block mb-1">Agent Address (Delegate)</label>
                    <input 
                        type="text" placeholder="Paste 0x..." 
                        className="w-full bg-transparent text-xs font-mono text-slate-300 outline-none placeholder:text-slate-700"
                        onChange={e => setAgentAddress(e.target.value)}
                    />
                </div>
            </div>

            {/* Step 2: Policy */}
            <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-400" /> Policy Definition
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-black/50 border border-slate-700 rounded p-2">
                        <label className="text-[9px] uppercase text-slate-500 font-bold block mb-1 flex items-center gap-1"><Coins className="w-3 h-3"/> Limit (ETH)</label>
                        <input 
                            type="number" value={limit} onChange={e => setLimit(e.target.value)}
                            className="w-full bg-transparent text-sm font-mono text-white outline-none"
                        />
                    </div>
                    <div className="bg-black/50 border border-slate-700 rounded p-2">
                        <label className="text-[9px] uppercase text-slate-500 font-bold block mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Duration (s)</label>
                        <input 
                            type="number" value={duration} onChange={e => setDuration(e.target.value)}
                            className="w-full bg-transparent text-sm font-mono text-white outline-none"
                        />
                    </div>
                </div>
                <button 
                    onClick={delegate} 
                    disabled={loading}
                    className="w-full bg-purple-700 hover:bg-purple-600 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg shadow-purple-900/20 transition-all"
                >
                    {loading ? "Anchoring..." : "Sign & Anchor Policy"}
                </button>
            </div>

        </div>

        {/* COL 2: EXECUTION */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5 shadow-lg h-full flex flex-col">
                <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" /> Execution Layer
                </h3>
                
                <div className="flex-grow flex flex-col justify-center space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-slate-400 mb-2">
                            <ArrowRightLeft className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-400">
                            Simulate the Agent attempting to spend funds from the Smart Wallet.
                        </p>
                    </div>

                    <div className="bg-black/50 border border-slate-700 rounded p-3">
                        <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Trade Amount (ETH)</label>
                        <input 
                            type="number" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)}
                            className="w-full bg-transparent text-xl font-mono text-white outline-none text-center"
                        />
                    </div>

                    <button 
                        onClick={executeTrade} 
                        disabled={loading}
                        className="w-full bg-green-700 hover:bg-green-600 text-white py-4 rounded-lg font-bold text-sm uppercase shadow-[0_0_20px_-5px_rgba(21,128,61,0.5)] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? "Processing..." : <>Attempt Trade <Zap className="w-4 h-4 fill-current"/></>}
                    </button>
                </div>
            </div>
        </div>

        {/* COL 3: INSPECTOR & LOGS */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* INSPECTOR CARD */}
            <div className="bg-[#18181b] border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <h3 className="text-sm font-bold text-cyan-400 uppercase flex items-center gap-2">
                        <Search className="w-4 h-4" /> On-Chain State
                    </h3>
                    <button onClick={inspectChain} className="text-[10px] bg-cyan-900/50 hover:bg-cyan-900 text-cyan-200 px-2 py-1 rounded transition-colors">
                        REFRESH
                    </button>
                </div>

                {policyData ? (
                    <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-center p-2 bg-black/40 rounded border border-slate-800">
                            <span className="text-xs text-slate-400">Status</span>
                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${policyData.active ? "bg-green-900/30 text-green-400 border border-green-900" : "bg-red-900/30 text-red-400 border border-red-900"}`}>
                                {policyData.active ? <CheckCircle2 className="w-3 h-3"/> : <AlertTriangle className="w-3 h-3"/>}
                                {policyData.active ? "ACTIVE" : "INACTIVE"}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-black/40 rounded border border-slate-800">
                                <span className="text-[9px] text-slate-500 uppercase block">Limit</span>
                                <span className="text-xs font-mono text-white">{policyData.limit_eth} ETH</span>
                            </div>
                            <div className="p-2 bg-black/40 rounded border border-slate-800">
                                <span className="text-[9px] text-slate-500 uppercase block">Remaining</span>
                                <span className="text-xs font-mono text-cyan-400">{policyData.seconds_remaining}s</span>
                            </div>
                        </div>
                        <div className="text-[9px] text-slate-600 font-mono text-center pt-2 border-t border-slate-800/50">
                            Chain Clock: {policyData.chain_current_time}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-600 text-xs italic">
                        Querying Smart Contract...
                    </div>
                )}
            </div>

            {/* LOGS */}
            <div className="bg-black border border-slate-800 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] text-slate-400 scrollbar-thin scrollbar-thumb-slate-700">
                <div className="flex items-center gap-2 text-slate-600 mb-2 border-b border-white/5 pb-1">
                    <Terminal className="w-3 h-3" /> SYSTEM_LOGS
                </div>
                {logs.length === 0 && <span className="text-slate-700 italic">Waiting for operations...</span>}
                {logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
            </div>

        </div>

      </div>
    </main>
  );
}
// "use client";
// import { useState } from "react";
// import { 
//   Settings, 
//   Zap, 
//   Search, 
//   Clock, 
//   Coins, 
//   Terminal, 
//   CheckCircle2, 
//   AlertTriangle,
//   Bot,
//   ShieldCheck
// } from "lucide-react";

// export default function Protocol6Page() {
//   const [ownerAddress, setOwnerAddress] = useState("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
//   const [agentDid, setAgentDid] = useState("");
//   const [limit, setLimit] = useState("0.5");
//   const [duration, setDuration] = useState("300");
//   const [tradeAmount, setTradeAmount] = useState("0.1"); 
  
//   const [logs, setLogs] = useState<string[]>([]);
//   const [policyData, setPolicyData] = useState<any>(null);
//   const [loading, setLoading] = useState(false);

//   const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

//   // --- 1. DELEGATE ---
//   const delegate = async () => {
//     if (!agentDid) return alert("Enter Agent DID");
//     setLoading(true);
//     addLog(`🤝 Setting Policy: Limit ${limit} ETH for ${duration}s...`);
    
//     try {
//         const response = await fetch("http://127.0.0.1:8012/protocol6/delegate", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//                 owner_address: ownerAddress,
//                 agent_did: agentDid,
//                 spend_limit_eth: parseFloat(limit),
//                 duration_seconds: parseInt(duration)
//             })
//         });
//         const data = await response.json();
//         if(data.status === "success") {
//             addLog(`✅ Policy Anchored! TX: ${data.tx_hash}`);
//             addLog(`🔹 Authorized EOA: ${data.authorized_agent}`);
//             inspectChain(); // Refresh view
//         } else {
//             throw new Error(data.detail);
//         }
//     } catch (e: any) { 
//         addLog("❌ Error: " + e.message); 
//     } finally { 
//         setLoading(false); 
//     }
//   };

//   // --- 2. EXECUTE ---
//   const executeTrade = async () => {
//       if(!agentDid) return alert("Enter Agent DID");
//       setLoading(true);
//       addLog(`⚙️ Agent attempting to spend ${tradeAmount} ETH...`);
      
//       try {
//         const response = await fetch("http://127.0.0.1:8012/protocol6/execute-trade", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//                 agent_did: agentDid,
//                 amount_eth: parseFloat(tradeAmount)
//             })
//         });
//         const data = await response.json();
        
//         if(data.status === "success") {
//             addLog(`✅ SUCCESS: Trade Sent! Hash: ${data.tx_hash}`);
//         } else {
//             addLog(`⛔ BLOCKED: ${data.reason}`);
//             addLog("Policy Violation detected.");
//         }
//         inspectChain();
//     } catch (e: any) { 
//         addLog("❌ Error: " + e.message); 
//     } finally { 
//         setLoading(false); 
//     }
//   };

//   // --- INSPECT ---
//   const inspectChain = async () => {
//       if(!agentDid) return;
//       try {
//           const response = await fetch(`http://127.0.0.1:8012/protocol6/inspect/${ownerAddress}/${agentDid}`);
//           const data = await response.json();
//           if(data.status === "success") setPolicyData(data.on_chain_data);
//       } catch (e) { console.error(e); }
//   };

//   return (
//     <main className="min-h-screen bg-[#fafafa] text-slate-800 p-8 font-sans selection:bg-purple-200 selection:text-purple-900">
//       <header className="max-w-6xl mx-auto mb-10 border-b border-slate-400 pb-6 mt-8">
//         <div className="flex items-center gap-3 mb-3">
//           <div className="h-2 w-2 bg-purple-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(147,51,234,0.7)]"/>
//           <h1 className="text-4xl font-mono text-purple-700 font-bold tracking-widest uppercase">Protocol 6</h1>
//         </div>
//         <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Delegation & Execution</h2>
//         <p className="text-slate-600 mt-2 text-lg font-medium">
//            Enforce on-chain policies on Agents born in Protocol 2.
//         </p>
//       </header>

//       <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        
//         {/* COL 1: POLICY */}
//         <div className="lg:col-span-1 h-full">
//             <div className="bg-white border border-slate-400 rounded-2xl p-6 shadow-md h-full flex flex-col">
//                 <h3 className="text-sm font-bold text-slate-900 uppercase mb-5 flex items-center gap-2">
//                     <div className="p-1.5 bg-purple-50 border border-purple-200 rounded-lg">
//                       <Settings className="w-4 h-4 text-purple-700" /> 
//                     </div>
//                     1. Set Rules
//                 </h3>
                
//                 <div className="space-y-5 mb-6 flex-grow">
//                      <div>
//                         <label className="text-[10px] uppercase text-slate-600 font-bold block mb-1.5 tracking-wider">Agent DID</label>
//                         <input 
//                             type="text" value={agentDid} onChange={e => setAgentDid(e.target.value)}
//                             placeholder="did:sov:agent:..."
//                             className="w-full bg-slate-50 border border-slate-400 text-sm font-mono text-slate-900 rounded-xl p-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-600/20 transition-all shadow-sm placeholder:text-slate-400"
//                         />
//                     </div>
//                     <div className="grid grid-cols-2 gap-4">
//                         <div>
//                             <label className="text-[10px] uppercase text-slate-600 font-bold block mb-1.5 flex items-center gap-1.5 tracking-wider"><Coins className="w-3.5 h-3.5 text-slate-500"/> Limit</label>
//                             <input type="number" value={limit} onChange={e => setLimit(e.target.value)} className="w-full bg-slate-50 border border-slate-400 rounded-xl p-3 text-sm font-mono text-slate-900 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-600/20 transition-all shadow-sm"/>
//                         </div>
//                         <div>
//                             <label className="text-[10px] uppercase text-slate-600 font-bold block mb-1.5 flex items-center gap-1.5 tracking-wider"><Clock className="w-3.5 h-3.5 text-slate-500"/> Time (s)</label>
//                             <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-slate-50 border border-slate-400 rounded-xl p-3 text-sm font-mono text-slate-900 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-600/20 transition-all shadow-sm"/>
//                         </div>
//                     </div>
//                 </div>
                
//                 <button 
//                     onClick={delegate} disabled={loading || !agentDid}
//                     className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3.5 rounded-xl font-bold text-xs uppercase shadow-md transition-all active:scale-[0.98] mt-auto disabled:bg-slate-200 disabled:text-slate-400 disabled:border disabled:border-slate-400 disabled:shadow-none"
//                 >
//                     {loading ? "Anchoring..." : "Anchor Policy"}
//                 </button>
//             </div>
//         </div>

//         {/* COL 2: EXECUTION */}
//         <div className="lg:col-span-1 h-full">
//             <div className="bg-white border border-slate-400 rounded-2xl p-6 shadow-md h-full flex flex-col relative overflow-hidden">
//                 {/* Background Decoration */}
//                 <div className="absolute top-0 right-0 p-4 opacity-[0.05] pointer-events-none transform translate-x-2 -translate-y-2">
//                    <Zap className="w-32 h-32 text-amber-600" />
//                 </div>

//                 <h3 className="text-sm font-bold text-slate-900 uppercase mb-5 flex items-center gap-2 relative z-10 shrink-0">
//                     <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg">
//                       <Zap className="w-4 h-4 text-amber-600" /> 
//                     </div>
//                     2. Attempt Trade
//                 </h3>
                
//                 <div className="flex-grow flex flex-col justify-center space-y-8 relative z-10">
//                     <div>
//                         <label className="text-[10px] uppercase text-slate-600 font-bold block mb-2 tracking-wider text-center">Amount (ETH)</label>
//                         <input 
//                             type="number" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)}
//                             className="w-full bg-slate-50 border border-slate-400 rounded-xl p-4 text-2xl font-mono font-bold text-slate-900 outline-none text-center focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/20 transition-all shadow-inner"
//                         />
//                     </div>
//                     <button 
//                         onClick={executeTrade} disabled={loading || !agentDid}
//                         className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold text-sm uppercase shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:border disabled:border-slate-400 disabled:shadow-none mt-auto"
//                     >
//                         {loading ? "Processing..." : <>Execute <Zap className="w-4 h-4 fill-current"/></>}
//                     </button>
//                 </div>
//             </div>
//         </div>

//         {/* COL 3: INSPECTOR */}
//         <div className="lg:col-span-1 h-full flex flex-col gap-6">
            
//             {/* Policy State Card - flex-grow to take up remaining height */}
//             <div className="bg-white border border-slate-400 rounded-2xl p-6 shadow-md flex-grow flex flex-col">
//                 <div className="flex justify-between items-center mb-5 shrink-0">
//                     <h3 className="text-sm font-bold text-cyan-800 uppercase flex items-center gap-2">
//                         <div className="p-1.5 bg-cyan-50 border border-cyan-200 rounded-lg">
//                           <Search className="w-4 h-4 text-cyan-700" />
//                         </div> 
//                         Policy State
//                     </h3>
//                     <button onClick={inspectChain} className="text-[10px] font-bold bg-slate-100 border border-slate-400 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg transition-colors active:scale-95 shadow-sm">REFRESH</button>
//                 </div>
                
//                 <div className="flex-grow flex flex-col justify-center">
//                   {policyData ? (
//                       <div className="space-y-4">
//                           <div className={`flex items-center gap-2 p-3 rounded-lg text-xs font-bold border shadow-sm ${policyData.active ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"}`}>
//                                {policyData.active ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
//                                {policyData.active ? "POLICY ACTIVE" : "POLICY INACTIVE"}
//                           </div>
//                           <div className="grid grid-cols-2 gap-3 text-xs">
//                                <div className="bg-slate-50 border border-slate-300 p-3 rounded-xl shadow-sm"><span className="text-[9px] uppercase font-bold tracking-wider text-slate-600 block mb-0.5">Limit</span><span className="font-mono font-bold text-slate-900">{policyData.limit_eth} ETH</span></div>
//                                <div className="bg-slate-50 border border-slate-300 p-3 rounded-xl shadow-sm"><span className="text-[9px] uppercase font-bold tracking-wider text-slate-600 block mb-0.5">Time Left</span><span className="font-mono font-bold text-slate-900">{policyData.seconds_remaining}s</span></div>
//                           </div>
//                           <div className="text-[10px] font-mono font-semibold text-slate-600 text-center pt-3 border-t border-slate-300 mt-2">
//                               Authorized EOA: <span className="text-slate-900">{policyData.agent_eoa?.slice(0,8)}...</span>
//                           </div>
//                       </div>
//                   ) : <div className="text-center py-6 bg-slate-50 border border-slate-300 rounded-xl text-slate-600 text-xs font-medium shadow-inner">No Data Found</div>}
//                 </div>
//             </div>

//             {/* LOGS CONSOLE - Fixed height */}
//             <div className="bg-slate-100 border border-slate-400 rounded-2xl p-4 h-48 shrink-0 overflow-y-auto font-mono text-[11px] text-slate-800 shadow-inner scrollbar-thin scrollbar-thumb-slate-400">
//                 <div className="flex items-center gap-2 text-slate-700 font-bold mb-3 border-b border-slate-300 pb-2"><Terminal className="w-3.5 h-3.5" /> LOGS</div>
//                 {logs.length === 0 && <span className="text-slate-500 italic">Waiting for events...</span>}
//                 {logs.map((l, i) => <div key={i} className="mb-1.5 leading-relaxed">{l}</div>)}
//             </div>
            
//         </div>

//       </div>
//     </main>
//   );
// }


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
  XCircle,
  ShieldOff,
} from "lucide-react";

const API = "http://127.0.0.1:8012";

export default function Protocol6Page() {
  const [ownerAddress, setOwnerAddress] = useState("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  const [agentDid, setAgentDid] = useState("");
  const [limit, setLimit] = useState("0.5");
  const [duration, setDuration] = useState("300");
  const [tradeAmount, setTradeAmount] = useState("0.1");

  const [logs, setLogs] = useState<string[]>([]);
  const [policyData, setPolicyData] = useState<any>(null);
  const [lastTrade, setLastTrade] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const errText = (data: any) =>
    typeof data?.detail === "string" ? data.detail : data?.reason || JSON.stringify(data?.detail || "Unknown error");

  // --- INSPECT ---
  const inspectChain = async () => {
    if (!agentDid) return;
    try {
      const response = await fetch(`${API}/protocol6/inspect/${ownerAddress}/${agentDid}`);
      const data = await response.json();
      if (data.status === "success") setPolicyData(data.on_chain_data);
    } catch (e) {
      console.error(e);
    }
  };

  // --- 1. DELEGATE ---
  const delegate = async () => {
    if (!agentDid) return alert("Enter Agent DID");
    setLoading(true);
    addLog(`Setting policy: limit ${limit} ETH for ${duration}s...`);

    try {
      const response = await fetch(`${API}/protocol6/delegate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_address: ownerAddress,
          agent_did: agentDid,
          spend_limit_eth: parseFloat(limit),
          duration_seconds: parseInt(duration),
        }),
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        addLog(`Policy anchored. TX: ${data.tx_hash}`);
        addLog(`Authorized EOA: ${data.authorized_agent}`);
        setLastTrade(null);
        await inspectChain();
      } else {
        throw new Error(errText(data));
      }
    } catch (e: any) {
      addLog("ERROR: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. REVOKE ---
  const revokeDelegation = async () => {
    if (!agentDid) return alert("Enter Agent DID");
    if (!confirm("Revoke this delegation? The agent will be denied immediately.")) return;
    setLoading(true);
    addLog("Revoking delegation...");

    try {
      const response = await fetch(`${API}/protocol6/revoke-delegation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_address: ownerAddress, agent_did: agentDid }),
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        addLog(`Delegation revoked. TX: ${data.tx_hash}`);
        setLastTrade(null);
        await inspectChain();
      } else {
        throw new Error(errText(data));
      }
    } catch (e: any) {
      addLog("ERROR: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. EXECUTE ---
  const executeTrade = async () => {
    if (!agentDid) return alert("Enter Agent DID");
    setLoading(true);
    addLog(`Agent attempting to spend ${tradeAmount} ETH...`);

    try {
      const response = await fetch(`${API}/protocol6/execute-trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_did: agentDid, amount_eth: parseFloat(tradeAmount) }),
      });
      const data = await response.json();

      if (data.status === "success") {
        addLog(`SUCCESS: trade sent. Hash: ${data.tx_hash}`);
        setLastTrade({ ok: true, text: `Trade of ${tradeAmount} ETH executed` });
      } else {
        const reason = data.reason || errText(data);
        addLog(`BLOCKED: ${reason}`);
        setLastTrade({ ok: false, text: reason });
      }
      await inspectChain();
    } catch (e: any) {
      addLog("ERROR: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const inactiveLabel =
    policyData && !policyData.active
      ? "POLICY INACTIVE / REVOKED"
      : policyData && policyData.seconds_remaining === 0
      ? "POLICY EXPIRED"
      : "POLICY ACTIVE";
  const policyOk = policyData && policyData.active && policyData.seconds_remaining > 0;

  return (
    <main className="min-h-screen bg-[#fafafa] text-slate-800 p-8 font-sans selection:bg-purple-200 selection:text-purple-900">
      <header className="max-w-6xl mx-auto mb-10 border-b border-slate-400 pb-6 mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-2 w-2 bg-purple-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(147,51,234,0.7)]" />
          <h1 className="text-4xl font-mono text-purple-700 font-bold tracking-widest uppercase">Protocol 6</h1>
        </div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Delegation & Execution</h2>
        <p className="text-slate-600 mt-2 text-lg font-medium">
          Set, enforce and revoke on-chain spending policies for agents registered in Protocol 2.
        </p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* COL 1: POLICY */}
        <div className="lg:col-span-1 h-full">
          <div className="bg-white border border-slate-400 rounded-2xl p-6 shadow-md h-full flex flex-col">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-5 flex items-center gap-2">
              <div className="p-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                <Settings className="w-4 h-4 text-purple-700" />
              </div>
              1. Set Rules
            </h3>

            <div className="space-y-5 mb-6 flex-grow">
              <div>
                <label className="text-[10px] uppercase text-slate-600 font-bold block mb-1.5 tracking-wider">Agent DID</label>
                <input
                  type="text"
                  value={agentDid}
                  onChange={(e) => setAgentDid(e.target.value)}
                  placeholder="Agent DID from Protocol 2"
                  className="w-full bg-slate-50 border border-slate-400 text-sm font-mono text-slate-900 rounded-xl p-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-600/20 transition-all shadow-sm placeholder:text-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase text-slate-600 font-bold mb-1.5 flex items-center gap-1.5 tracking-wider">
                    <Coins className="w-3.5 h-3.5 text-slate-500" /> Limit (ETH)
                  </label>
                  <input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-400 rounded-xl p-3 text-sm font-mono text-slate-900 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-600/20 transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-600 font-bold mb-1.5 flex items-center gap-1.5 tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-slate-500" /> Time (s)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-400 rounded-xl p-3 text-sm font-mono text-slate-900 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-600/20 transition-all shadow-sm"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">The limit applies per transaction, not cumulatively.</p>
            </div>

            <div className="space-y-3 mt-auto">
              <button
                onClick={delegate}
                disabled={loading || !agentDid}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3.5 rounded-xl font-bold text-xs uppercase shadow-md transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:border disabled:border-slate-400 disabled:shadow-none"
              >
                {loading ? "Working..." : "Anchor Policy"}
              </button>
              <button
                onClick={revokeDelegation}
                disabled={loading || !agentDid}
                className="w-full bg-white hover:bg-red-50 text-red-700 border border-red-400 py-3 rounded-xl font-bold text-xs uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-400"
              >
                <ShieldOff className="w-4 h-4" /> Revoke Delegation
              </button>
            </div>
          </div>
        </div>

        {/* COL 2: EXECUTION */}
        <div className="lg:col-span-1 h-full">
          <div className="bg-white border border-slate-400 rounded-2xl p-6 shadow-md h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.05] pointer-events-none transform translate-x-2 -translate-y-2">
              <Zap className="w-32 h-32 text-amber-600" />
            </div>

            <h3 className="text-sm font-bold text-slate-900 uppercase mb-5 flex items-center gap-2 relative z-10 shrink-0">
              <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
              2. Attempt Trade
            </h3>

            <div className="flex-grow flex flex-col justify-center space-y-6 relative z-10">
              <div>
                <label className="text-[10px] uppercase text-slate-600 font-bold block mb-2 tracking-wider text-center">Amount (ETH)</label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-400 rounded-xl p-4 text-2xl font-mono font-bold text-slate-900 outline-none text-center focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/20 transition-all shadow-inner"
                />
              </div>

              {lastTrade && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl border text-xs font-semibold animate-in fade-in duration-300 ${
                    lastTrade.ok
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-red-50 border-red-300 text-red-800"
                  }`}
                >
                  {lastTrade.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                  <span className="break-words min-w-0">{lastTrade.ok ? lastTrade.text : `Denied: ${lastTrade.text}`}</span>
                </div>
              )}

              <button
                onClick={executeTrade}
                disabled={loading || !agentDid}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-bold text-sm uppercase shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:border disabled:border-slate-400 disabled:shadow-none"
              >
                {loading ? (
                  "Processing..."
                ) : (
                  <>
                    Execute <Zap className="w-4 h-4 fill-current" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* COL 3: INSPECTOR */}
        <div className="lg:col-span-1 h-full flex flex-col gap-6">
          <div className="bg-white border border-slate-400 rounded-2xl p-6 shadow-md flex-grow flex flex-col">
            <div className="flex justify-between items-center mb-5 shrink-0">
              <h3 className="text-sm font-bold text-cyan-800 uppercase flex items-center gap-2">
                <div className="p-1.5 bg-cyan-50 border border-cyan-200 rounded-lg">
                  <Search className="w-4 h-4 text-cyan-700" />
                </div>
                Policy State
              </h3>
              <button
                onClick={inspectChain}
                className="text-[10px] font-bold bg-slate-100 border border-slate-400 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg transition-colors active:scale-95 shadow-sm"
              >
                REFRESH
              </button>
            </div>

            <div className="flex-grow flex flex-col justify-center">
              {policyData ? (
                <div className="space-y-4">
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg text-xs font-bold border shadow-sm ${
                      policyOk ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"
                    }`}
                  >
                    {policyOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {inactiveLabel}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 border border-slate-300 p-3 rounded-xl shadow-sm">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-600 block mb-0.5">Limit</span>
                      <span className="font-mono font-bold text-slate-900">{policyData.limit_eth} ETH</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-300 p-3 rounded-xl shadow-sm">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-600 block mb-0.5">Time Left</span>
                      <span className="font-mono font-bold text-slate-900">{policyData.seconds_remaining}s</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono font-semibold text-slate-600 text-center pt-3 border-t border-slate-300 mt-2">
                    Authorized EOA: <span className="text-slate-900">{policyData.agent_eoa?.slice(0, 8)}...</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 border border-slate-300 rounded-xl text-slate-600 text-xs font-medium shadow-inner">
                  No data yet. Anchor a policy or press Refresh.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-100 border border-slate-400 rounded-2xl p-4 h-48 shrink-0 overflow-y-auto font-mono text-[11px] text-slate-800 shadow-inner">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-3 border-b border-slate-300 pb-2">
              <Terminal className="w-3.5 h-3.5" /> LOGS
            </div>
            {logs.length === 0 && <span className="text-slate-500 italic">Waiting for events...</span>}
            {logs.map((l, i) => (
              <div key={i} className={`mb-1.5 leading-relaxed ${l.includes("BLOCKED") || l.includes("ERROR") ? "text-red-700" : ""}`}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
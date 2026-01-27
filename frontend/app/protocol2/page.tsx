"use client";
import { useState, useEffect } from "react";
import { 
  Bot, 
  Cpu, 
  Link as LinkIcon, 
  ShieldCheck, 
  Activity, 
  Hash, 
  Terminal, 
  RefreshCw,
  Server,
  UserCheck
} from "lucide-react";

type AgentRecord = {
  did: string;
  role: string;
  status: "Active" | "Inactive";
  verified: boolean;
  isHistorical?: boolean; // To distinguish full DIDs from hashes
};

export default function Protocol2Page() {
  // State
  const [userDid, setUserDid] = useState("did:sov:2wJPyULfLLnYTEFYzByfUR");
  const [agentRole, setAgentRole] = useState("DeFi Trader");
  const [loading, setLoading] = useState(false);
  const [fleet, setFleet] = useState<AgentRecord[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (userDid) fetchFleetHistory();
  }, [userDid]);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // --- ACTIONS ---

  // 1. Fetch History (The "Radar")
  const fetchFleetHistory = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8002/protocol2/fetch-fleet/${userDid}`);
      const data = await res.json();
      
      if (data.status === "success" && data.agents) {
        // Transform backend data to UI format
        const history: AgentRecord[] = data.agents.map((a: any) => ({
          did: a.agent_hash, // It's a hash
          role: "Recovered Entity", // Metadata is hidden on-chain
          status: a.is_active ? "Active" : "Inactive",
          verified: true,
          isHistorical: true
        }));
        setFleet(history);
        // Only log if we found something relevant to avoid spamming on load
        if(history.length > 0) addLog(`📡 Radar detected ${history.length} anchored agents.`);
      }
    } catch (e) { console.error("History fetch failed", e); }
  };

  // 2. Register Agent (The "Spawner")
  const spawnAgent = async () => {
    if (!userDid) return;
    setLoading(true);
    addLog(`⚙️ Initializing ${agentRole} Protocol...`);

    try {
      // Simulate "Booting Up" visual
      await new Promise(r => setTimeout(r, 600));

      const response = await fetch("http://127.0.0.1:8002/protocol2/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            owner_did: userDid, 
            agent_role: agentRole 
        })
      });
      const data = await response.json();

      if (data.status === "success") {
        addLog(`✅ SUCCESS: Agent Anchored on Blockchain.`);
        addLog(`🔗 TX Hash: ${data.tx_hash}`);
        
        // Add new agent to the TOP of the fleet list
        const newAgent: AgentRecord = {
          did: data.agent_did, // We have the full string now!
          role: agentRole,
          status: "Active",
          verified: true,
          isHistorical: false
        };
        
        setFleet(prev => [newAgent, ...prev]);
      } else {
        throw new Error(data.reason || "Registration Failed");
      }
    } catch (e: any) {
      addLog(`❌ ERROR: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 p-8 font-sans selection:bg-blue-500/30">
      
      {/* HEADER */}
      <header className="max-w-6xl mx-auto mb-12 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"/>
          <h1 className="text-sm font-mono text-blue-500 tracking-widest uppercase">Protocol 2</h1>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">AI Agent Registration</h2>
            <p className="text-slate-400 mt-2 text-lg">
              Cryptographically bind AI Agents to a Human Identity (Hierarchical SSI).
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-500 bg-black/30 px-3 py-2 rounded border border-slate-800">
            <Server className="w-3 h-3" />
            <span>NET: ANVIL LOCALHOST</span>
            <div className="h-2 w-2 bg-green-500 rounded-full ml-2" />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SPAWNER (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden">
            {/* Background Effect */}
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Bot className="w-32 h-32 text-blue-500" />
            </div>

            <h3 className="text-white font-semibold mb-6 flex items-center gap-2 relative z-10">
              <Cpu className="w-5 h-5 text-blue-400" />
              Agent Factory
            </h3>
            
            <div className="space-y-5 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-3 h-3" /> Owner Identity (Root)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={userDid}
                    onChange={(e) => setUserDid(e.target.value)}
                    className="w-full bg-black/50 border border-slate-700 text-blue-300 font-mono text-xs rounded-lg px-3 py-3 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <button onClick={fetchFleetHistory} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 p-2 rounded-lg transition-colors" title="Refresh Fleet">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent Function</label>
                <select 
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                  className="w-full bg-black/50 border border-slate-700 text-white text-sm rounded-lg px-3 py-3 focus:ring-1 focus:ring-blue-500 focus:outline-none appearance-none"
                >
                  <option>DeFi Trader</option>
                  <option>Personal Assistant</option>
                  <option>Medical Proxy</option>
                  <option>Legal Guardian</option>
                </select>
              </div>

              <div className="pt-2">
                <button 
                  onClick={spawnAgent}
                  disabled={loading || !userDid}
                  className={`w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2
                    ${loading 
                      ? "bg-blue-900/20 text-blue-500/50 cursor-not-allowed border border-blue-900/50" 
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)] border border-blue-400"
                    }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Anchoring...
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" /> Spawn & Anchor
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* LOGS DRAWER */}
          <div className="bg-[#18181b] border border-slate-800 rounded-xl p-4">
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center justify-between w-full text-[10px] uppercase font-bold text-slate-500 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2"><Terminal className="w-3 h-3" /> System Logs</span>
              <span className="text-xs">{showLogs ? "−" : "+"}</span>
            </button>
            {showLogs && (
              <div className="mt-3 h-32 overflow-y-auto font-mono text-[10px] text-green-500/80 space-y-1 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                {logs.length === 0 && <span className="text-slate-700">System idle...</span>}
                {logs.map((log, i) => (
                  <div key={i} className="border-b border-white/5 pb-1">{log}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: FLEET GRID (8 Cols) */}
        <div className="lg:col-span-8">
           <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" /> Live Agent Fleet
              </h3>
              <span className="text-xs font-mono text-slate-600 bg-slate-900 px-2 py-1 rounded">
                Total Units: {fleet.length}
              </span>
           </div>

           {fleet.length === 0 ? (
             <div className="h-64 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600">
               <Bot className="w-12 h-12 mb-3 opacity-20" />
               <p className="text-sm">No Agents Detected</p>
               <p className="text-xs mt-1">Register an agent to begin.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {fleet.map((agent, i) => (
                 <div key={i} className="group bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 rounded-lg p-4 transition-all duration-300 hover:bg-slate-900">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${agent.isHistorical ? 'bg-slate-800 text-slate-400' : 'bg-blue-900/30 text-blue-400'}`}>
                           <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200">{agent.role}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                             <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> 
                             Operational
                          </div>
                        </div>
                      </div>
                      {agent.verified && (
                        <div className="bg-green-900/20 border border-green-900/50 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> VERIFIED
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="bg-black/40 p-2 rounded border border-slate-800/50 group-hover:border-slate-700 transition-colors">
                        <div className="text-[9px] uppercase text-slate-500 font-bold mb-1 flex items-center gap-1">
                          {agent.isHistorical ? <Hash className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                          {agent.isHistorical ? "Blockchain Fingerprint (Hash)" : "Decentralized ID (DID)"}
                        </div>
                        <code className="text-[10px] font-mono text-slate-300 break-all leading-tight block">
                          {agent.did}
                        </code>
                      </div>
                      
                      <div className="flex justify-between items-center pt-1">
                         <span className="text-[9px] text-slate-600 font-mono">
                           {agent.isHistorical ? "Source: Ledger History" : "Source: Just Registered"}
                         </span>
                         {agent.isHistorical && (
                           <span className="text-[9px] text-blue-500/50">Metadata Private</span>
                         )}
                      </div>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>

      </div>
    </main>
  );
}
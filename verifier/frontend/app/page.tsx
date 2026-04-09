"use client";
import { useState } from "react";
import Link from "next/link";
import { 
  Bot, 
  ShieldCheck, 
  Wallet, 
  ArrowRight,
  Database,
  Cpu
} from "lucide-react";

export default function Home() {
  const [ownerAddress, setOwnerAddress] = useState("");
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const connectMetaMask = async () => {
    // Check if we are in the browser and ethereum exists
    if (typeof window !== "undefined" && typeof (window as any).ethereum !== 'undefined') {
        try {
            // Request account access
            const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
            const userAddress = accounts[0];
            
            setOwnerAddress(userAddress);
            setIsWalletConnected(true);
            
            // Optional: Force MetaMask to switch to your local Anvil network (Chain ID 31337 / 0x7a69)
            await (window as any).ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x7a69' }], 
            });

        } catch (error: any) {
            console.error(`❌ MetaMask Connection Failed: ${error.message}`);
        }
    } else {
        alert("Please install the MetaMask extension!");
    }
  };

  const protocols = [
    {
      id: 2,
      title: "Agent Registration",
      desc: "Spawn Autonomous AI Agents and cryptographically link them to your Root Identity.",
      icon: Bot,
      color: "text-blue-400",
      bg: "hover:border-blue-500/50",
      link: "/protocol2"
    },
    {
      id: 4,
      title: "Zero-Trust Verification",
      desc: "Verify your Government-issued Credentials before deploying agents to the platform.",
      icon: ShieldCheck,
      color: "text-green-400",
      bg: "hover:border-green-500/50",
      link: "/protocol4"
    },
    {
      id: 6,
      title: "Delegated Execution",
      desc: "Deploy Smart Vaults with strict on-chain spending limits and time-locks for your Agents.",
      icon: Wallet,
      color: "text-yellow-400",
      bg: "hover:border-yellow-500/50",
      link: "/protocol6"
    },
  ];

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 font-sans selection:bg-white/10">
      
      {/* HERO SECTION */}
      <section className="relative pt-20 pb-16 px-6 border-b border-slate-800 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#09090b] to-[#09090b]">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-mono text-slate-400 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            System Operational • Node B: Verifier & DeFi Engine
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
            Web3 Agent Platform
          </h1>
          
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
            Connect your wallet, verify your identity via Zero-Knowledge proofs, and deploy autonomous trading agents with secure on-chain delegations.
          </p>

          {/* METAMASK CONNECTION BUTTON */}
          <button 
            onClick={connectMetaMask}
            className={`px-8 py-3 rounded-full font-bold text-sm uppercase tracking-widest transition-all duration-300
                ${isWalletConnected 
                    ? "bg-orange-900/20 border border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]" 
                    : "bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]"}`}
          >
            {isWalletConnected 
                ? `🦊 Connected: ${ownerAddress.slice(0,6)}...${ownerAddress.slice(-4)}` 
                : "🦊 Connect MetaMask"}
          </button>

          <div className="mt-12 flex justify-center gap-8 text-xs font-mono text-slate-500">
             <div className="flex items-center gap-2">
               <Database className="w-4 h-4" /> <span>IPFS Storage</span>
             </div>
             <div className="flex items-center gap-2">
               <Cpu className="w-4 h-4" /> <span>ACA-Py Agents</span>
             </div>
             <div className="flex items-center gap-2">
               <ShieldCheck className="w-4 h-4" /> <span>Ethereum Sepolia</span>
             </div>
          </div>
        </div>
      </section>

      {/* GRID SECTION */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {protocols.map((p) => (
              <Link key={p.id} href={p.link} className={`group relative bg-[#18181b] border border-slate-800 rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${p.bg}`}>
                
                {/* Protocol Number */}
                <div className="absolute top-4 right-4 text-[10px] font-bold text-slate-700 font-mono">
                  P{p.id}
                </div>

                <div className={`w-12 h-12 rounded-lg bg-black/50 border border-slate-800 flex items-center justify-center mb-4 group-hover:bg-slate-900 transition-colors`}>
                  <p.icon className={`w-6 h-6 ${p.color}`} />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  {p.title}
                </h3>
                
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  {p.desc}
                </p>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-white transition-colors uppercase tracking-wider">
                  Launch Demo <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-8 border-t border-slate-900 text-[10px] text-slate-600 font-mono">
        THESIS DEFENSE SYSTEM v1.0 • SECURE CONNECTION ESTABLISHED
      </footer>
    </main>
  );
}
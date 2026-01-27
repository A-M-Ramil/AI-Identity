"use client";
import Link from "next/link";
import { 
  Fingerprint, 
  Bot, 
  FileBadge, 
  ShieldCheck, 
  Ban, 
  Wallet, 
  Activity, 
  ArrowRight,
  Database,
  Cpu
} from "lucide-react";

export default function Home() {
  
  const protocols = [
    {
      id: 1,
      title: "Human Identity",
      desc: "Anchor a Human DID to Ethereum using ACA-Py & IPFS.",
      icon: Fingerprint,
      color: "text-cyan-400",
      bg: "hover:border-cyan-500/50",
      link: "/protocol1"
    },
    {
      id: 2,
      title: "Agent Registration",
      desc: "Spawn AI Agents and cryptographically link them to the Human Root Identity.",
      icon: Bot,
      color: "text-blue-400",
      bg: "hover:border-blue-500/50",
      link: "/protocol2"
    },
    {
      id: 3,
      title: "Credential Issuance",
      desc: "Issue Verifiable Credentials (VCs) to Agents for specific roles (e.g. DeFi Trader).",
      icon: FileBadge,
      color: "text-purple-400",
      bg: "hover:border-purple-500/50",
      link: "/protocol3"
    },
    {
      id: 4,
      title: "Zero-Trust Verification",
      desc: "Verify Agent Credentials using Off-Chain Proofs and On-Chain Revocation Checks.",
      icon: ShieldCheck,
      color: "text-green-400",
      bg: "hover:border-green-500/50",
      link: "/protocol4"
    },
    {
      id: 5,
      title: "Governance & Revocation",
      desc: "Emergency Kill-Switch to invalidate Agent permissions on the Immutable Ledger.",
      icon: Ban,
      color: "text-red-400",
      bg: "hover:border-red-500/50",
      link: "/protocol5"
    },
    {
      id: 6,
      title: "Delegated Execution",
      desc: "Enforce on-chain spending limits and time-locks for Autonomous Agents.",
      icon: Wallet,
      color: "text-yellow-400",
      bg: "hover:border-yellow-500/50",
      link: "/protocol6"
    },
    {
      id: 7,
      title: "Forensic Audit",
      desc: "Trace the full chain of custody from Action -> Agent -> Human Owner.",
      icon: Activity,
      color: "text-orange-400",
      bg: "hover:border-orange-500/50",
      link: "/protocol7"
    }
  ];

  return (
    <main className="min-h-screen bg-[#09090b] text-slate-200 font-sans selection:bg-white/10">
      
      {/* HERO SECTION */}
      <section className="relative pt-20 pb-16 px-6 border-b border-slate-800 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#09090b] to-[#09090b]">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-mono text-slate-400 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            System Operational • Anvil Localhost:8545
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
            Hierarchical Self-Sovereign<br/>Identity for AI Agents
          </h1>
          
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A blockchain-based framework ensuring accountability, delegation, and 
            auditability for autonomous systems in decentralized environments.
          </p>

          <div className="mt-10 flex justify-center gap-8 text-xs font-mono text-slate-500">
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
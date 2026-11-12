// "use client";
// import { useState } from "react";
// import Link from "next/link";
// import { 
//   Bot, 
//   ShieldCheck, 
//   Wallet, 
//   ArrowRight,
//   Database,
//   Cpu
// } from "lucide-react";

// export default function Home() {
//   const [ownerAddress, setOwnerAddress] = useState("");
//   const [isWalletConnected, setIsWalletConnected] = useState(false);

//   const connectMetaMask = async () => {
//     // Check if we are in the browser and ethereum exists
//     if (typeof window !== "undefined" && typeof (window as any).ethereum !== 'undefined') {
//         try {
//             // Request account access
//             const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
//             const userAddress = accounts[0];
            
//             setOwnerAddress(userAddress);
//             setIsWalletConnected(true);
            
//             // Optional: Force MetaMask to switch to your local Anvil network (Chain ID 31337 / 0x7a69)
//             await (window as any).ethereum.request({
//                 method: 'wallet_switchEthereumChain',
//                 params: [{ chainId: '0x7a69' }], 
//             });

//         } catch (error: any) {
//             console.error(`❌ MetaMask Connection Failed: ${error.message}`);
//         }
//     } else {
//         alert("Please install the MetaMask extension!");
//     }
//   };

//   const protocols = [
//     {
//       id: 2,
//       title: "Agent Registration",
//       desc: "Spawn Autonomous AI Agents and cryptographically link them to your Root Identity.",
//       icon: Bot,
//       color: "text-blue-400",
//       bg: "hover:border-blue-500/50",
//       link: "/protocol2"
//     },
//     {
//       id: 4,
//       title: "Zero-Trust Verification",
//       desc: "Verify your Government-issued Credentials before deploying agents to the platform.",
//       icon: ShieldCheck,
//       color: "text-green-400",
//       bg: "hover:border-green-500/50",
//       link: "/protocol4"
//     },
//     {
//       id: 6,
//       title: "Delegated Execution",
//       desc: "Deploy Smart Vaults with strict on-chain spending limits and time-locks for your Agents.",
//       icon: Wallet,
//       color: "text-yellow-400",
//       bg: "hover:border-yellow-500/50",
//       link: "/protocol6"
//     },
//   ];

//   return (
//     <main className="min-h-screen bg-[#09090b] text-slate-200 font-sans selection:bg-white/10">
      
//       {/* HERO SECTION */}
//       <section className="relative pt-20 pb-16 px-6 border-b border-slate-800 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#09090b] to-[#09090b]">
//         <div className="max-w-6xl mx-auto text-center">
//           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-mono text-slate-400 mb-6">
//             <span className="relative flex h-2 w-2">
//               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
//               <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
//             </span>
//             System Operational • Node B: Verifier & DeFi Engine
//           </div>
          
//           <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
//             Web3 Agent Platform
//           </h1>
          
//           <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
//             Connect your wallet, verify your identity via Zero-Knowledge proofs, and deploy autonomous trading agents with secure on-chain delegations.
//           </p>

//           {/* METAMASK CONNECTION BUTTON */}
//           <button 
//             onClick={connectMetaMask}
//             className={`px-8 py-3 rounded-full font-bold text-sm uppercase tracking-widest transition-all duration-300
//                 ${isWalletConnected 
//                     ? "bg-orange-900/20 border border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]" 
//                     : "bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]"}`}
//           >
//             {isWalletConnected 
//                 ? `🦊 Connected: ${ownerAddress.slice(0,6)}...${ownerAddress.slice(-4)}` 
//                 : "🦊 Connect MetaMask"}
//           </button>

//           <div className="mt-12 flex justify-center gap-8 text-xs font-mono text-slate-500">
//              <div className="flex items-center gap-2">
//                <Database className="w-4 h-4" /> <span>IPFS Storage</span>
//              </div>
//              <div className="flex items-center gap-2">
//                <Cpu className="w-4 h-4" /> <span>ACA-Py Agents</span>
//              </div>
//              <div className="flex items-center gap-2">
//                <ShieldCheck className="w-4 h-4" /> <span>Ethereum Sepolia</span>
//              </div>
//           </div>
//         </div>
//       </section>

//       {/* GRID SECTION */}
//       <section className="px-6 py-16">
//         <div className="max-w-6xl mx-auto">
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {protocols.map((p) => (
//               <Link key={p.id} href={p.link} className={`group relative bg-[#18181b] border border-slate-800 rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${p.bg}`}>
                
//                 {/* Protocol Number */}
//                 <div className="absolute top-4 right-4 text-[10px] font-bold text-slate-700 font-mono">
//                   P{p.id}
//                 </div>

//                 <div className={`w-12 h-12 rounded-lg bg-black/50 border border-slate-800 flex items-center justify-center mb-4 group-hover:bg-slate-900 transition-colors`}>
//                   <p.icon className={`w-6 h-6 ${p.color}`} />
//                 </div>
                
//                 <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
//                   {p.title}
//                 </h3>
                
//                 <p className="text-sm text-slate-400 leading-relaxed mb-4">
//                   {p.desc}
//                 </p>

//                 <div className="flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-white transition-colors uppercase tracking-wider">
//                   Launch Demo <ArrowRight className="w-3 h-3" />
//                 </div>
//               </Link>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* FOOTER */}
//       <footer className="text-center py-8 border-t border-slate-900 text-[10px] text-slate-600 font-mono">
//         THESIS DEFENSE SYSTEM v1.0 • SECURE CONNECTION ESTABLISHED
//       </footer>
//     </main>
//   );
// }
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
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50 group-hover:bg-blue-100 border-blue-200",
      hoverBorder: "hover:border-blue-400 hover:shadow-blue-900/5",
      link: "/protocol2"
    },
    {
      id: 4,
      title: "Zero-Trust Verification",
      desc: "Verify your Government-issued Credentials before deploying agents to the platform.",
      icon: ShieldCheck,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50 group-hover:bg-emerald-100 border-emerald-200",
      hoverBorder: "hover:border-emerald-400 hover:shadow-emerald-900/5",
      link: "/protocol4"
    },
    {
      id: 6,
      title: "Delegated Execution",
      desc: "Deploy Smart Vaults with strict on-chain spending limits and time-locks for your Agents.",
      icon: Wallet,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50 group-hover:bg-amber-100 border-amber-200",
      hoverBorder: "hover:border-amber-400 hover:shadow-amber-900/5",
      link: "/protocol6"
    },
  ];

  return (
    <main className="min-h-screen bg-[#fafafa] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* HERO SECTION */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden border-b border-slate-300 bg-gradient-to-b from-white via-[#fafafa] to-slate-100/50">
        {/* Subtle background glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-blue-50/50 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-slate-300 text-xs font-mono text-slate-600 mb-8 shadow-sm hover:shadow-md transition-shadow">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            System Operational • Node B: Verifier & DeFi Engine
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 drop-shadow-sm">
            Web3 Agent Platform
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium mb-10">
            Connect your wallet, verify your identity via Zero-Knowledge proofs, and deploy autonomous trading agents with secure on-chain delegations.
          </p>

          {/* METAMASK CONNECTION BUTTON */}
          <button 
            onClick={connectMetaMask}
            className={`px-8 py-3.5 rounded-full font-bold text-sm uppercase tracking-widest transition-all duration-300 active:scale-[0.98]
                ${isWalletConnected 
                    ? "bg-orange-50 border border-orange-300 text-orange-700 shadow-sm" 
                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 border border-orange-600"}`}
          >
            {isWalletConnected 
                ? `🦊 Connected: ${ownerAddress.slice(0,6)}...${ownerAddress.slice(-4)}` 
                : "🦊 Connect MetaMask"}
          </button>

          <div className="mt-12 flex flex-wrap justify-center gap-6 md:gap-10 text-xs font-mono text-slate-600 bg-white w-fit mx-auto px-6 py-3.5 rounded-2xl border border-slate-300 shadow-sm">
             <div className="flex items-center gap-2">
               <Database className="w-4 h-4 text-slate-400" /> <span>IPFS Storage</span>
             </div>
             <div className="flex items-center gap-2">
               <Cpu className="w-4 h-4 text-slate-400" /> <span>ACA-Py Agents</span>
             </div>
             <div className="flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-slate-400" /> <span>Ethereum Sepolia</span>
             </div>
          </div>
        </div>
      </section>

      {/* GRID SECTION */}
      <section className="px-6 py-20 relative">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {protocols.map((p) => (
              <Link key={p.id} href={p.link} className={`group relative bg-white border border-slate-300 rounded-2xl p-8 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl ${p.hoverBorder}`}>
                
                {/* Protocol Number */}
                <div className="absolute top-6 right-6 text-[10px] font-bold text-slate-500 font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 group-hover:border-slate-300 transition-colors">
                  P{p.id}
                </div>

                <div className={`w-14 h-14 rounded-xl border flex items-center justify-center mb-6 shadow-sm transition-colors duration-300 ${p.iconBg}`}>
                  <p.icon className={`w-6 h-6 ${p.iconColor}`} />
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-slate-700 transition-colors">
                  {p.title}
                </h3>
                
                <p className="text-sm text-slate-600 leading-relaxed mb-8">
                  {p.desc}
                </p>

                <div className="absolute bottom-8 left-8 flex items-center gap-2 text-xs font-bold text-slate-400 group-hover:text-slate-900 transition-colors uppercase tracking-wider">
                  Launch Demo 
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-10 border-t border-slate-300 bg-white/50">
         <div className="text-[10px] text-slate-500 font-mono tracking-widest font-semibold">
          THESIS DEFENSE SYSTEM v1.0 • SECURE CONNECTION ESTABLISHED
         </div>
      </footer>
    </main>
  );
}
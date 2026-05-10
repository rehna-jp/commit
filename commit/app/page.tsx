import Image from 'next/image';
import Link from 'next/link';
import { Lock, Camera, ShieldCheck, Trophy, ArrowRight } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { LiveStreaks } from './components/LiveStreaks';
import { HeroStats } from './components/HeroStats';
import { HabitChip } from './components/HabitTypeSelector';
import { HabitType } from './lib/types';

const STEPS = [
  { icon: Lock, title: 'Stake', desc: 'Lock USDC on a daily habit commitment' },
  { icon: Camera, title: 'Prove', desc: 'Submit daily photo or code proof' },
  { icon: ShieldCheck, title: 'Verify', desc: 'AI verifies, chain enforces' },
  { icon: Trophy, title: 'Earn', desc: 'Complete your streak, claim rewards' },
];

const ALL_HABITS = [HabitType.Code, HabitType.Read, HabitType.Write, HabitType.Design, HabitType.Gym];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#07050d] text-white selection:bg-grape-500/30 overflow-hidden">
      {/* Immersive Glowing Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-grape-600/20 blur-[150px]" />
        <div className="absolute top-[30%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-lilac-900/10 blur-[180px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-orchid-900/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      <Navbar />

      {/* Hero Section */}
      <section className="relative z-10 w-full overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-32 flex flex-col items-center text-center">
          {/* Bigger Logo with Glow */}
          <div className="relative mb-8 animate-[float_6s_ease-in-out_infinite]">
            <div className="absolute inset-0 bg-grape-500 blur-2xl opacity-50 rounded-full"></div>
            <Image
              src="/commit-logo.png"
              alt="commit logo"
              width={160}
              height={160}
              className="relative drop-shadow-[0_0_25px_rgba(153,134,209,0.8)] rounded-2xl"
              priority
            />
          </div>

          <div className="relative inline-block mb-4">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-grape-500 to-orchid-500 opacity-40 blur-lg"></div>
            <div className="relative inline-flex items-center gap-2 rounded-full border border-grape-400/30 bg-[#13111c]/60 px-4 py-1.5 text-xs font-medium uppercase tracking-widest backdrop-blur-md text-lilac-500">
              <span className="flex size-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]"></span>
              Habit-stake protocol on Solana
            </div>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6">
            <span className="bg-gradient-to-br from-white via-smoke-700 to-grape-800 bg-clip-text text-transparent">commit</span>
            <span className="text-orchid-500 animate-pulse">.</span>
          </h1>
          
          <h2 className="text-2xl md:text-3xl font-medium text-smoke-500 mb-8 max-w-2xl leading-snug">
            Stake it. Prove it. <br/>
            <span className="bg-gradient-to-r from-lilac-400 to-orchid-500 bg-clip-text text-transparent">Let the chain decide.</span>
          </h2>
          
          <p className="text-base md:text-lg text-smoke-600 max-w-xl mx-auto mb-12 leading-relaxed">
            Pledge USDC on your daily routines. AI verifies your check-ins. Cryptographic attestations on Solana. Succeed to earn, fail and be slashed.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/streak/create"
              className="group relative overflow-hidden flex items-center gap-2 bg-grape-500 text-white rounded-xl px-8 py-4 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(94,84,142,0.8)] hover:shadow-[0_0_60px_-15px_rgba(94,84,142,1)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
              <span className="relative flex items-center gap-2">
                Start Staking Now <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 border border-grape-400/40 bg-white/5 backdrop-blur-md text-smoke-600 hover:text-white hover:bg-white/10 hover:border-grape-400/60 rounded-xl px-8 py-4 text-base font-medium transition-all active:scale-95 shadow-lg"
            >
              Browse Streaks
            </Link>
          </div>

          <HeroStats />
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 w-full py-20 bg-gradient-to-b from-transparent via-[#13111c]/80 to-transparent backdrop-blur-sm border-y border-grape-400/10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">The Mechanism</h2>
            <div className="h-1 w-20 bg-gradient-to-r from-grape-500 to-orchid-500 mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="group relative p-6 rounded-2xl bg-white/5 border border-grape-400/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(94,84,142,0.5)] hover:border-grape-400/50">
                <div className="absolute top-0 right-0 text-[8rem] font-black text-white/5 -z-10 leading-none group-hover:text-grape-500/10 transition-colors">
                  {i + 1}
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-grape-500 to-amethyst-700 rounded-xl flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(94,84,142,0.5)] group-hover:scale-110 transition-transform">
                  <Icon size={24} className="text-white drop-shadow-md" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-smoke-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Habit types */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-medium text-white text-center mb-8">Choose Your Discipline</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {ALL_HABITS.map((h) => (
            <div key={h} className="hover:scale-105 transition-transform cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.2)] hover:shadow-[0_0_25px_rgba(190,149,196,0.3)] rounded-full">
              <HabitChip habitType={h} />
            </div>
          ))}
        </div>
      </section>

      {/* Active streaks — live on-chain */}
      <LiveStreaks />

      {/* Footer */}
      <footer className="relative z-10 border-t border-grape-400/20 bg-[#07050d] py-10">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm font-medium text-smoke-600">
            commit<span className="text-orchid-500">.</span> — Built on <span className="text-white">Solana</span>
          </p>
          <div className="flex items-center gap-6 text-sm text-smoke-600">
            <a
              href="https://github.com"
              className="hover:text-lilac-400 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <span className="opacity-50">|</span>
            <span className="text-smoke-700">Dev3pack Hackathon 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Lock,
  Camera,
  ShieldCheck,
  Trophy,
  ArrowRight,
  Coins,
  Brain,
  Search,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { Navbar } from "./components/Navbar";
import { LiveStreaks } from "./components/LiveStreaks";
import { HeroStats } from "./components/HeroStats";
import { HabitChip } from "./components/HabitTypeSelector";
import { HabitType } from "./lib/types";
import { PROGRAM_ID_STR } from "./lib/constants";

const ALL_HABITS = [
  HabitType.Code,
  HabitType.Read,
  HabitType.Write,
  HabitType.Design,
  HabitType.Gym,
];

export default function LandingPage() {
  const explorerUrl = `https://explorer.solana.com/address/${PROGRAM_ID_STR}?cluster=devnet`;

  return (
    <div className="relative min-h-screen bg-[#07050d] text-white selection:bg-grape-500/30 overflow-hidden font-sans">
      {/* Immersive Glowing Backgrounds */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-grape-600/20 blur-[150px]" />
        <div className="absolute top-[30%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-lilac-900/10 blur-[180px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-orchid-900/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      {/* HEADER SECTION (1) */}
      <Navbar isLanding={true} />

      {/* HERO SECTION (2) */}
      <section className="relative z-10 w-full overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-32 flex flex-col items-center text-center">
          {/* Logo with intense glow */}
          <div className="relative mb-8 animate-[float_6s_ease-in-out_infinite]">
            <div className="absolute inset-0 bg-grape-500 blur-3xl opacity-50 rounded-full"></div>
            <Image
              src="/commit-logo.png"
              alt="commit logo"
              width={140}
              height={140}
              className="relative drop-shadow-[0_0_25px_rgba(153,134,209,0.8)] rounded-2xl"
              priority
            />
          </div>

          {/* Badge */}
          <div className="relative inline-block mb-6">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-grape-500 to-orchid-500 opacity-40 blur-lg"></div>
            <div className="relative inline-flex items-center gap-2 rounded-full border border-grape-400/30 bg-[#13111c]/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest backdrop-blur-md text-lilac-400">
              <span className="flex size-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]"></span>
              Habit-stake protocol on Solana
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl leading-tight md:leading-none">
            <span className="bg-gradient-to-r from-white via-smoke-500 to-grape-300 bg-clip-text text-transparent">
              Stake money on your habits.
            </span>
            <br />
            <span className="bg-gradient-to-r from-orchid-400 to-lilac-500 bg-clip-text text-transparent">
              Winners get paid by everyone who quit.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-smoke-500 max-w-3xl mx-auto mb-10 leading-relaxed">
            commit is a group habit challenge protocol. Stake USDC, submit daily
            proof, and when the challenge ends — quitters fund the reward for
            everyone who showed up.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="group relative overflow-hidden flex items-center gap-2 bg-grape-500 text-white rounded-xl px-8 py-4 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(94,84,142,0.8)] hover:shadow-[0_0_60px_-15px_rgba(94,84,142,1)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
              <span className="relative flex items-center gap-2">
                Launch App{" "}
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF SECTION (3) */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Hackathon card */}
          <div className="group relative p-6 rounded-2xl bg-white/5 border border-grape-400/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:border-grape-400/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold tracking-widest text-orchid-400 uppercase">
                Recognition
              </span>
              <Trophy className="text-orchid-400 w-5 h-5 group-hover:animate-bounce" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">
                3rd Place
              </p>
              <p className="text-sm text-smoke-500 mt-1">
                Dev3pack Global Hackathon 2026
              </p>
            </div>
          </div>

          {/* Smart Contract card */}
          <div className="group relative p-6 rounded-2xl bg-white/5 border border-grape-400/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:border-grape-400/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
                Deployment
              </span>
              <ShieldCheck className="text-emerald-400 w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">
                Solana Devnet
              </p>
              <p className="text-sm text-smoke-500 mt-1">
                Smart contracts live on Solana devnet
              </p>
            </div>
          </div>

          {/* Accelerators card */}
          <div className="group relative p-6 rounded-2xl bg-white/5 border border-grape-400/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:border-grape-400/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold tracking-widest text-lilac-400 uppercase">
                Accelerators
              </span>
              <Sparkles className="text-lilac-400 w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">
                2 Cohorts
              </p>
              <p className="text-sm text-smoke-500 mt-1">
                Dev3pack Bridge + Founder School FS26-2
              </p>
            </div>
          </div>
        </div>

        {/* Live on-chain metrics */}
        <HeroStats />
      </section>

      {/* PROBLEM SECTION (4) */}
      <section className="relative z-10 w-full py-24 bg-[#0c0915] border-y border-grape-400/10">
        <div className="absolute inset-0 bg-radial-gradient from-red-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-4xl px-6 flex flex-col md:flex-row gap-12 items-center">
          <div className="md:w-1/2 flex flex-col justify-center">
            <div className="inline-flex items-center gap-1.5 text-red-400 text-xs font-bold tracking-widest uppercase mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
              The Friction
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6 tracking-tight leading-snug">
              Why goal setting fails.
            </h2>
            <div className="space-y-6 text-base text-smoke-500 leading-relaxed">
              <p className="border-l-2 border-red-500/40 pl-4 italic text-smoke-400">
                {
                  "\"You've set the same goal three times this year. You started strong. Then missed one day. Told yourself you'd restart Monday. You didn't.\""
                }
              </p>
              <p>
                {"It's not discipline. It's that "}
                <strong className="text-white">
                  quitting costs you nothing.
                </strong>{" "}
                No consequence. No one loses when you stop. So you stop.
              </p>
            </div>
          </div>
          <div className="md:w-1/2 relative flex justify-center w-full">
            <div className="absolute inset-0 bg-red-500/10 blur-[80px] rounded-full"></div>
            <div className="relative border border-red-500/20 bg-black/40 backdrop-blur-md rounded-2xl p-8 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-3 text-red-400 mb-6">
                <AlertTriangle size={24} />
                <span className="font-bold text-sm uppercase tracking-wider">
                  The Quit Loop
                </span>
              </div>
              <div className="space-y-4 text-xs font-mono text-smoke-600">
                <div className="flex gap-2 items-center text-red-300">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Set goal (Excitement high)</span>
                </div>
                <div className="w-0.5 h-4 bg-red-500/20 ml-2.5"></div>
                <div className="flex gap-2 items-center text-red-300">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>Miss one check-in (Life happens)</span>
                </div>
                <div className="w-0.5 h-4 bg-red-500/20 ml-2.5"></div>
                <div className="flex gap-2 items-center text-red-300">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>{'"I\'ll start over next Monday"'}</span>
                </div>
                <div className="w-0.5 h-4 bg-red-500/20 ml-2.5"></div>
                <div className="flex gap-2 items-center text-red-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-red-500/30 flex items-center justify-center text-[10px]">
                    4
                  </span>
                  <span>Zero penalty. You quit. (Loop resets)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION SECTION (5) */}
      <section className="relative z-10 w-full py-24 bg-gradient-to-b from-transparent via-grape-500/5 to-transparent">
        <div className="mx-auto max-w-4xl px-6 flex flex-col md:flex-row-reverse gap-12 items-center">
          <div className="md:w-1/2 flex flex-col justify-center">
            <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
              The Redirection
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6 tracking-tight leading-snug">
              commit makes quitting expensive and showing up profitable.
            </h2>
            <p className="text-base text-smoke-500 leading-relaxed">
              When you stake money on a habit and someone in your group quits,
              their stake {"doesn't"} disappear.{" "}
              <span className="text-emerald-400 font-bold">
                It goes to you.
              </span>{" "}
              Underpinned by secure smart contracts on Solana, accountability is
              financial and code-enforced.
            </p>
          </div>
          <div className="md:w-1/2 relative flex justify-center w-full">
            <div className="absolute inset-0 bg-emerald-500/10 blur-[80px] rounded-full"></div>
            <div className="relative border border-emerald-500/20 bg-[#13111c]/80 backdrop-blur-xl rounded-2xl p-8 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-3 text-emerald-400 mb-6">
                <Flame size={24} className="animate-pulse" />
                <span className="font-bold text-sm uppercase tracking-wider">
                  Stake Dynamics
                </span>
              </div>
              <div className="relative flex justify-between items-center py-6 px-4 border border-grape-400/20 rounded-xl bg-black/20">
                <div className="text-center">
                  <div className="text-red-400 text-xs font-bold mb-1">
                    Quitter
                  </div>
                  <div className="text-sm font-mono text-smoke-600 line-through">
                    -$50 USDC
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center px-4">
                  <div className="w-full border-t border-dashed border-grape-400/40 relative">
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-grape-600/40 text-[9px] text-white px-1.5 py-0.5 rounded font-mono">
                      FLOWS TO
                    </span>
                  </div>
                </div>
                <div className="text-center animate-pulse">
                  <div className="text-emerald-400 text-xs font-bold mb-1">
                    Finisher
                  </div>
                  <div className="text-sm font-mono text-emerald-400 font-bold">
                    +$50 USDC
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS SECTION (6) */}
      <section className="relative z-10 w-full py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-widest text-orchid-400 uppercase">
            Yield on Discipline
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-4 tracking-tight">
            Outcomes, Not Features
          </h2>
          <div className="h-1 w-20 bg-gradient-to-r from-grape-500 to-orchid-500 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Outcome 1 */}
          <div className="group relative p-8 rounded-2xl bg-white/5 border border-grape-400/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(94,84,142,0.4)] hover:border-grape-400/50">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-6 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-110 transition-transform">
              <Coins size={22} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              You earn when others quit
            </h3>
            <p className="text-sm text-smoke-500 leading-relaxed">
              Every person who drops out adds to your reward. Consistency pays.
            </p>
          </div>

          {/* Outcome 2 */}
          <div className="group relative p-8 rounded-2xl bg-white/5 border border-grape-400/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(94,84,142,0.4)] hover:border-grape-400/50">
            <div className="w-12 h-12 bg-orchid-500/10 border border-orchid-500/30 rounded-xl flex items-center justify-center mb-6 text-orchid-400 shadow-[0_0_15px_rgba(202,121,165,0.2)] group-hover:scale-110 transition-transform">
              <Brain size={22} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              AI keeps it honest
            </h3>
            <p className="text-sm text-smoke-500 leading-relaxed">
              No honor system. Your daily proof is verified on-chain. No
              disputes, no favouritism.
            </p>
          </div>

          {/* Outcome 3 */}
          <div className="group relative p-8 rounded-2xl bg-white/5 border border-grape-400/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(94,84,142,0.4)] hover:border-grape-400/50">
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center mb-6 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:scale-110 transition-transform">
              <Lock size={22} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Your money is never in our hands
            </h3>
            <p className="text-sm text-smoke-500 leading-relaxed">
              A smart contract holds and distributes everything.{" "}
              {"We can't touch it."}
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION (7) */}
      <section className="relative z-10 w-full py-20 bg-[#0c0915] border-y border-grape-400/10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-widest text-lilac-400 uppercase">
              The Protocol Flow
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-4 tracking-tight">
              Three Simple Steps
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-grape-500 to-orchid-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            {/* Step 1 */}
            <div className="relative p-6 rounded-2xl bg-white/5 border border-grape-400/20 flex flex-col justify-between">
              <div className="absolute top-4 right-4 text-5xl font-black text-white/5">
                01
              </div>
              <div>
                <div className="w-10 h-10 bg-grape-500/20 border border-grape-500/30 rounded-lg flex items-center justify-center mb-6 text-grape-400">
                  <Search size={18} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Join a challenge
                </h3>
                <p className="text-sm text-smoke-500 leading-relaxed">
                  Find or create a group habit challenge. Set your goal and
                  duration.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative p-6 rounded-2xl bg-white/5 border border-grape-400/20 flex flex-col justify-between">
              <div className="absolute top-4 right-4 text-5xl font-black text-white/5">
                02
              </div>
              <div>
                <div className="w-10 h-10 bg-orchid-500/20 border border-orchid-500/30 rounded-lg flex items-center justify-center mb-6 text-orchid-400">
                  <Camera size={18} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Stake and show up
                </h3>
                <p className="text-sm text-smoke-500 leading-relaxed">
                  Lock USDC into the group pool. Submit photo proof every day.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative p-6 rounded-2xl bg-white/5 border border-grape-400/20 flex flex-col justify-between">
              <div className="absolute top-4 right-4 text-5xl font-black text-white/5">
                03
              </div>
              <div>
                <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center justify-center mb-6 text-emerald-400">
                  <Trophy size={18} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Winners get paid
                </h3>
                <p className="text-sm text-smoke-500 leading-relaxed">
                  When the challenge ends, the smart contract pays {"quitters'"}{" "}
                  stakes directly to everyone who finished.
                </p>
              </div>
            </div>
          </div>

          {/* Discipline Chips */}
          <div className="flex flex-col items-center pt-8 border-t border-grape-400/10">
            <h4 className="text-xs font-semibold tracking-widest text-smoke-600 uppercase mb-6">
              Choose Your Discipline
            </h4>
            <div className="flex flex-wrap justify-center gap-3">
              {ALL_HABITS.map((h) => (
                <div
                  key={h}
                  className="hover:scale-105 transition-transform cursor-pointer rounded-full"
                >
                  <HabitChip habitType={h} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVE STREAKS (LIVE ON-CHAIN METRIC SHOWCASE) */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
            Live Stream
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            Active Streaks — Live On-Chain
          </h2>
        </div>
        <LiveStreaks />
      </section>

      {/* POSITIONING SECTION (8) */}
      <section className="relative z-10 w-full py-20 max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-widest text-lilac-400 uppercase font-mono">
            The Positioning
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-4 tracking-tight">
            How commit Compares
          </h2>
          <div className="h-1 w-20 bg-gradient-to-r from-grape-500 to-orchid-500 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contrast 1 */}
          <div className="rounded-2xl border border-grape-400/20 bg-white/5 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="pb-4 border-b border-grape-400/10">
                <span className="text-xs font-bold uppercase tracking-wider text-smoke-600">
                  The Incentives
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  ✕
                </span>
                <p className="text-sm text-smoke-500">
                  <strong className="text-smoke-700">Other Apps:</strong> Punish
                  failure and pocket the money.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  ✓
                </span>
                <p className="text-sm text-white">
                  <strong className="text-emerald-400">commit:</strong> Rewards
                  success and pays it to your group.
                </p>
              </div>
            </div>
          </div>

          {/* Contrast 2 */}
          <div className="rounded-2xl border border-grape-400/20 bg-white/5 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="pb-4 border-b border-grape-400/10">
                <span className="text-xs font-bold uppercase tracking-wider text-smoke-600">
                  The Operations
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  ✕
                </span>
                <p className="text-sm text-smoke-500">
                  <strong className="text-smoke-700">Other Apps:</strong> Rely
                  on trust.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  ✓
                </span>
                <p className="text-sm text-white">
                  <strong className="text-emerald-400">commit:</strong> Runs on
                  a smart contract — the rules are public, the payout is
                  automatic, nobody decides.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BELIEFS SECTION (9) */}
      <section className="relative z-10 w-full py-24 bg-[#0c0915] border-y border-grape-400/10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-widest text-orchid-400 uppercase">
              Our Creed
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-4 tracking-tight">
              We Believe
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-grape-500 to-orchid-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-medium">
            <div className="p-6 rounded-2xl bg-white/5 border border-grape-400/20 flex gap-4 items-start">
              <span className="text-orchid-400 text-lg font-bold">01</span>
              <div>
                <p className="text-white text-base leading-relaxed">
                  We believe{" "}
                  <strong className="text-orchid-400">
                    consequences create commitment
                  </strong>{" "}
                  — not reminders, not streaks, not badges.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-grape-400/20 flex gap-4 items-start">
              <span className="text-orchid-400 text-lg font-bold">02</span>
              <div>
                <p className="text-white text-base leading-relaxed">
                  We believe{" "}
                  <strong className="text-orchid-400">
                    winners should be paid by quitters
                  </strong>
                  , not consoled by the app.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-grape-400/20 flex gap-4 items-start">
              <span className="text-orchid-400 text-lg font-bold">03</span>
              <div>
                <p className="text-white text-base leading-relaxed">
                  We believe{" "}
                  <strong className="text-orchid-400">
                    your money belongs in code
                  </strong>
                  , {"not in a company's account."}
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-grape-400/20 flex gap-4 items-start">
              <span className="text-orchid-400 text-lg font-bold">04</span>
              <div>
                <p className="text-white text-base leading-relaxed">
                  We believe{" "}
                  <strong className="text-orchid-400">
                    showing up every day is worth something real
                  </strong>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION (10) */}
      <section className="relative z-10 w-full py-28 max-w-4xl mx-auto px-6 text-center">
        <div className="absolute inset-0 bg-grape-500/10 blur-[120px] pointer-events-none rounded-full" />
        <div className="relative p-12 rounded-3xl border border-grape-400/20 bg-white/5 backdrop-blur-2xl shadow-2xl flex flex-col items-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Ready to put money on it?
          </h2>
          <p className="text-smoke-500 max-w-md mb-8">
            Create or join a challenge, lock your stake, and let the smart
            contract handle the rewards.
          </p>
          <Link
            href="/dashboard"
            className="group relative overflow-hidden flex items-center gap-2 bg-grape-500 text-white rounded-xl px-8 py-4 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(94,84,142,0.8)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
            <span className="relative flex items-center gap-2">
              Launch App{" "}
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </span>
          </Link>
        </div>
      </section>

      {/* FOOTER SECTION (11) */}
      <footer className="relative z-10 border-t border-grape-400/20 bg-[#07050d] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-widest text-smoke-600 mb-4">
                Protocol
              </h5>
              <ul className="space-y-3 text-sm text-smoke-500">
                <li>
                  <a
                    href="https://github.com/rehna-jp/commit#readme"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-lilac-400 transition-colors"
                  >
                    Docs
                  </a>
                </li>
                <li>
                  <a
                    href="https://rehna-jp.github.io/commit-landingpage/"
                    className="hover:text-lilac-400 transition-colors"
                  >
                    Waitlist
                  </a>
                </li>
                <li>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-lilac-400 transition-colors flex items-center gap-1"
                  >
                    Smart Contract <ExternalLink size={12} />
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-bold uppercase tracking-widest text-smoke-600 mb-4">
                Community
              </h5>
              <ul className="space-y-3 text-sm text-smoke-500">
                <li>
                  <a
                    href="https://x.com/commit_sol01"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-lilac-400 transition-colors"
                  >
                    X
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/rehna-jp/commit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-lilac-400 transition-colors"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-bold uppercase tracking-widest text-smoke-600 mb-4">
                Resources
              </h5>
              <ul className="space-y-3 text-sm text-smoke-500">
                <li>
                  <a
                    href="#media-kit"
                    className="hover:text-lilac-400 transition-colors"
                  >
                    Media Kit
                  </a>
                </li>
                <li>
                  <a
                    href="#press"
                    className="hover:text-lilac-400 transition-colors"
                  >
                    Press
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-bold uppercase tracking-widest text-smoke-600 mb-4">
                Legal & Contact
              </h5>
              <ul className="space-y-3 text-sm text-smoke-500">
                <li>
                  <a
                    href="#contact"
                    className="hover:text-lilac-400 transition-colors"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="#terms"
                    className="hover:text-lilac-400 transition-colors"
                  >
                    Terms & Conditions
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-grape-400/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium text-smoke-600">
            <div>
              commit<span className="text-orchid-500">.</span> — Built on{" "}
              <span className="text-white">Solana</span>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1.5 font-mono text-[10px]">
              <span className="text-smoke-600">Devnet Program Address:</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lilac-400 hover:underline flex items-center gap-1"
              >
                {PROGRAM_ID_STR} <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

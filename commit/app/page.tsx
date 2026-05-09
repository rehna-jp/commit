import Image from 'next/image';
import Link from 'next/link';
import { Lock, Camera, ShieldCheck, Trophy, ArrowRight } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { StreakCard } from './components/StreakCard';
import { HabitChip } from './components/HabitTypeSelector';
import { MOCK_STREAKS } from './lib/mock-data';
import { HabitType } from './lib/types';

const STEPS = [
  { icon: Lock, title: 'Stake', desc: 'Lock USDC on a daily habit commitment' },
  { icon: Camera, title: 'Prove', desc: 'Submit daily photo or code proof' },
  { icon: ShieldCheck, title: 'Verify', desc: 'AI verifies, chain enforces' },
  { icon: Trophy, title: 'Earn', desc: 'Complete your streak, claim rewards' },
];

const ALL_HABITS = [HabitType.Code, HabitType.Read, HabitType.Write, HabitType.Design, HabitType.Gym];

export default function LandingPage() {
  const showcase = MOCK_STREAKS.slice(0, 3);

  return (
    <div className="min-h-screen bg-amethyst-500">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-6 pt-20 pb-24 text-center">
          <Image
            src="/commit-logo.png"
            alt="commit"
            width={72}
            height={72}
            className="mx-auto mb-6 rounded-xl"
          />
          <h1 className="text-5xl font-medium tracking-tight text-white mb-3">
            commit<span className="text-lilac-500">.</span>
          </h1>
          <p className="text-xl text-smoke-500 mb-2">stake it. prove it.</p>
          <p className="text-xl text-smoke-500 mb-10">let the chain decide.</p>
          <p className="text-sm text-smoke-600 max-w-md mx-auto mb-10">
            Stake USDC on daily habits. AI-verified check-ins. Cryptographic attestations on Solana.
            Complete your streak to claim the pool.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/streak/create"
              className="flex items-center gap-2 bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
            >
              Start a Streak <ArrowRight size={16} />
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 border border-grape-400 text-smoke-700 hover:bg-grape-400/20 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
            >
              Browse Streaks
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-grape-200/30 border-y border-grape-300">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-xl font-medium text-white text-center mb-10">How it works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="text-center">
                <div className="w-10 h-10 bg-grape-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Icon size={20} className="text-white" />
                </div>
                <p className="text-xs font-medium text-smoke-600 uppercase tracking-wide mb-1">
                  Step {i + 1}
                </p>
                <h3 className="text-sm font-medium text-white mb-1">{title}</h3>
                <p className="text-xs text-smoke-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Habit types */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-xl font-medium text-white text-center mb-6">Five habit categories</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {ALL_HABITS.map((h) => (
            <HabitChip key={h} habitType={h} />
          ))}
        </div>
      </section>

      {/* Active streaks */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium text-white">Active Streaks</h2>
          <Link
            href="/dashboard"
            className="text-sm text-smoke-500 hover:text-white transition-colors flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {showcase.map((streak) => (
            <StreakCard key={streak.pubkey} streak={streak} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-grape-300 py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between flex-wrap gap-4">
          <p className="text-xs text-smoke-600">
            commit<span className="text-lilac-500">.</span> — Built on Solana
          </p>
          <div className="flex items-center gap-4 text-xs text-smoke-600">
            <a
              href="https://github.com"
              className="hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <span>Dev3pack Hackathon 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

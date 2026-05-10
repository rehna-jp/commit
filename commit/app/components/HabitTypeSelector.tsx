'use client';

import { Code2, BookOpen, PenLine, Palette, Dumbbell } from 'lucide-react';
import { HabitType } from '@/app/lib/types';

const HABIT_OPTIONS = [
  { value: HabitType.Code, label: 'Code', Icon: Code2 },
  { value: HabitType.Read, label: 'Read', Icon: BookOpen },
  { value: HabitType.Write, label: 'Write', Icon: PenLine },
  { value: HabitType.Design, label: 'Design', Icon: Palette },
  { value: HabitType.Gym, label: 'Gym', Icon: Dumbbell },
] as const;

interface Props {
  value: HabitType;
  onChange: (v: HabitType) => void;
  disabled?: boolean;
}

export function HabitTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {HABIT_OPTIONS.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={[
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all',
              active
                ? 'bg-grape-500 text-white border-grape-500 shadow-[0_0_15px_rgba(94,84,142,0.5)]'
                : 'bg-black/20 border-white/5 text-smoke-500 hover:text-white hover:border-grape-500/50 hover:bg-white/5',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            <Icon size={14} className={active ? 'text-white' : 'text-smoke-500'} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function HabitChip({ habitType }: { habitType: HabitType }) {
  const opt = HABIT_OPTIONS.find((o) => o.value === habitType);
  if (!opt) return null;
  const { label, Icon } = opt;
  return (
    <span className="inline-flex items-center gap-1.5 bg-orchid-500/10 border border-orchid-500/30 text-orchid-400 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide uppercase shadow-[0_0_10px_rgba(202,121,165,0.2)]">
      <Icon size={12} className="text-orchid-400" />
      {label}
    </span>
  );
}

export const HABIT_ICONS = {
  [HabitType.Code]: Code2,
  [HabitType.Read]: BookOpen,
  [HabitType.Write]: PenLine,
  [HabitType.Design]: Palette,
  [HabitType.Gym]: Dumbbell,
};

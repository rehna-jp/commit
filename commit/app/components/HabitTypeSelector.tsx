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
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all',
              active
                ? 'bg-grape-500 text-white border-grape-500'
                : 'bg-orchid-50 border-orchid-500 text-amethyst-500 hover:border-grape-500',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            <Icon size={12} className={active ? 'text-white' : 'text-grape-500'} />
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
    <span className="inline-flex items-center gap-1.5 bg-orchid-50 border border-orchid-500 text-amethyst-500 rounded-full px-3.5 py-1.5 text-xs font-medium">
      <Icon size={12} className="text-grape-500" />
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

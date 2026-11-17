import React from 'react';
import { Calendar, Zap, AlertCircle, HelpCircle } from 'lucide-react';

export default function ShelfLifeCard({
  baseDays = 5.2,
  adjustedDays = 5.2,
  factor = 1.0,
  temperature = 25,
  humidity = 60,
  isBanana = true,   // legacy prop — kept for compat
  isValidFruit = true,
  fruitType = null,
}) {
  const isInvalid = (!isBanana && !isValidFruit) || adjustedDays === 0;
  const isExpiringSoon = !isInvalid && adjustedDays <= 2.0;

  return (
    <div className="p-6 rounded-3xl bg-gray-900/70 border border-white/10 glass-panel space-y-5 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <Calendar size={16} className="text-amber-400" />
          Remaining Usable Shelf Life
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {isInvalid ? 'Validation Filter' : 'LSTM + Kinetics'}
        </span>
      </div>

      {/* Main Days Display */}
      <div className="flex items-baseline justify-between p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-black/40 to-transparent border border-emerald-500/20">
        <div>
          <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight">
            {isInvalid ? '0' : adjustedDays}{' '}
            <span className="text-xl font-bold text-gray-300 font-sans">Days</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isInvalid
              ? 'Shelf life calculation disabled — unsupported fruit'
              : `Adjusted for ${temperature}°C & ${humidity}% RH${fruitType ? ` · ${fruitType}` : ''}`}
          </p>
        </div>


      </div>

      {/* Breakdown: Base vs Adjusted */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 space-y-1">
          <div className="text-xs text-gray-400 font-medium">LSTM Base Shelf Life</div>
          <div className="text-xl font-bold text-gray-200 font-mono">{isInvalid ? '0' : baseDays} Days</div>
          <div className="text-[10px] text-gray-500">{isInvalid ? 'Requires banana input' : 'At 25°C baseline'}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 space-y-1">
          <div className="text-xs text-gray-400 font-medium">Kinetic Env Factor</div>
          <div className="text-xl font-bold text-gray-200 font-mono">{factor}x</div>
          <div className="text-[10px] text-gray-500">
            {factor === 1.0 ? 'Neutral Impact' : factor > 1.0 ? 'Accelerated Decay' : 'Preserving'}
          </div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-gray-400 flex items-center gap-2">
        <div className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
          →
        </div>
        <p>
          {isInvalid
            ? 'Upload a clear image of a Banana, Bittergourd, or Tomato to calculate shelf life.'
            : adjustedDays > 5
              ? 'Fresh condition. Safe for standard room temperature storage.'
              : adjustedDays > 2
                ? 'Active ripening. Consider consuming within 48–72 hours.'
                : 'Advanced ripeness. Recommended for immediate consumption or freezing.'}
        </p>
      </div>
    </div>
  );
}

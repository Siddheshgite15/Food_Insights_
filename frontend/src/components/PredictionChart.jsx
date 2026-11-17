import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TrendingDown } from 'lucide-react';

export default function PredictionChart({ currentDays = 5.2, currentIndex = 82 }) {
  // Generate 8-day degradation projection curve from current state
  const data = [];
  const daysTotal = Math.max(1, Math.round(currentDays));

  for (let d = 0; d <= 8; d++) {
    const remaining = Math.max(0, parseFloat((currentDays - d).toFixed(1)));
    const freshness = Math.max(0, Math.round(currentIndex * Math.pow(Math.max(0, (daysTotal - d) / daysTotal), 1.2)));
    data.push({
      day: d === 0 ? 'Today' : `Day +${d}`,
      remainingDays: remaining,
      freshnessIndex: freshness,
    });
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded-xl bg-gray-950 border border-white/10 shadow-xl text-xs space-y-1 backdrop-blur-md">
          <div className="font-bold text-gray-200">{label}</div>
          <div className="text-amber-400 font-mono">
            Shelf Life: {payload[0]?.value} Days
          </div>
          <div className="text-emerald-400 font-mono">
            Freshness: {payload[1]?.value} / 100
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 rounded-3xl bg-gray-900/70 border border-white/10 glass-panel space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <TrendingDown size={16} className="text-amber-400" />
          Projected Spoilage Trajectory (8-Day Temporal Model)
        </div>
        <span className="text-[10px] text-gray-400 font-mono">
          LSTM Sequence Progression
        </span>
      </div>

      <div className="h-56 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="freshGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="indexGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="remainingDays"
              stroke="#f59e0b"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#freshGlow)"
              name="Remaining Days"
            />
            <Area
              type="monotone"
              dataKey="freshnessIndex"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#indexGlow)"
              name="Freshness Index"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

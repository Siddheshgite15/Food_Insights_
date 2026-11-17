import React, { useEffect, useState, useMemo } from 'react';
import { predictionService } from '../services/predictionService';
import {
  History as HistoryIcon,
  Trash2,
  Thermometer,
  Droplets,
  TrendingDown,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

// ── Fruit config ──────────────────────────────────────────────────────────────
const FRUITS = [
  {
    key:    'Banana',
    emoji:  '🍌',
    color:  '#f59e0b',   // amber
    fresh:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
    badge:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    active: 'bg-amber-500 text-black',
    glow:   'shadow-amber-500/20',
  },
  {
    key:    'Bittergourd',
    emoji:  '🥬',
    color:  '#10b981',   // emerald
    fresh:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    badge:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    active: 'bg-emerald-500 text-black',
    glow:   'shadow-emerald-500/20',
  },
  {
    key:    'Tomato',
    emoji:  '🍅',
    color:  '#f43f5e',   // rose
    fresh:  'bg-rose-500/20 text-rose-300 border-rose-500/30',
    badge:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
    active: 'bg-rose-500 text-black',
    glow:   'shadow-rose-500/20',
  },
];

const FRUIT_MAP = Object.fromEntries(FRUITS.map((f) => [f.key, f]));

// Normalise whatever comes back from API → canonical key
const normaliseFruit = (raw) => {
  if (!raw) return 'Banana';
  const k = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (k === 'Bittergourd' || k === 'Bitter_gourd' || k === 'Bitter gourd') return 'Bittergourd';
  if (k === 'Tomato')      return 'Tomato';
  return 'Banana';
};

// ── Custom tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#090d16] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1 font-mono">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ── Per-fruit chart ───────────────────────────────────────────────────────────
function FruitChart({ fruit, records }) {
  const cfg = FRUIT_MAP[fruit];
  const data = useMemo(() =>
    [...records]
      .filter((r) => normaliseFruit(r.fruitType) === fruit)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((r, i) => ({
        scan: `#${i + 1}`,
        date: new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        freshness: +(r.freshnessIndex  || 0).toFixed(1),
        days:      +(r.adjustedRemainingDays || r.baseRemainingDays || 0).toFixed(1),
      })),
    [records, fruit]
  );

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-xs gap-2">
        <span className="text-3xl">{cfg.emoji}</span>
        Not enough {fruit} scans to plot a trend (need ≥ 2)
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} />
        <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone" dataKey="freshness" name="Freshness Index"
          stroke={cfg.color} strokeWidth={2.5}
          dot={{ fill: cfg.color, r: 3 }} activeDot={{ r: 5 }}
        />
        <Line
          type="monotone" dataKey="days" name="Remaining Days"
          stroke={cfg.color} strokeWidth={2} strokeDasharray="5 4"
          dot={false} strokeOpacity={0.5}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFruit, setActiveFruit] = useState('Banana');   // selected fruit tab

  useEffect(() => {
    (async () => {
      try {
        const res = await predictionService.getHistory();
        if (res.success && res.predictions) setRecords(res.predictions);
      } catch (e) {
        console.warn('History fetch error:', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this prediction record?')) return;
    try {
      await predictionService.deletePrediction(id);
      setRecords((prev) => prev.filter((r) => r._id !== id));
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Records filtered to the selected fruit tab
  const filteredRecords = useMemo(() =>
    records.filter((r) => normaliseFruit(r.fruitType) === activeFruit),
    [records, activeFruit]
  );

  // Count per fruit for badges
  const counts = useMemo(() => {
    const c = { Banana: 0, Bittergourd: 0, Tomato: 0 };
    records.forEach((r) => { c[normaliseFruit(r.fruitType)] = (c[normaliseFruit(r.fruitType)] || 0) + 1; });
    return c;
  }, [records]);

  const cfg = FRUIT_MAP[activeFruit];

  return (
    <div className="min-h-[calc(100vh-65px)] py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <HistoryIcon size={14} />
            Prediction Audit Trail
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Prediction <span className="gradient-text">History</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400">
            Per-fruit freshness trend charts and inspection records
          </p>
        </div>

        {/* Fruit type tabs — no "All" option */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-900 border border-white/5 self-start">
          {FRUITS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFruit(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFruit === f.key
                  ? `${f.active} shadow-md ${f.glow}`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{f.emoji}</span>
              {f.key}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeFruit === f.key ? 'bg-black/20' : 'bg-white/5 text-gray-500'}`}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Three per-fruit trend charts (always visible) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {FRUITS.map((f) => {
          const isActive = f.key === activeFruit;
          return (
            <div
              key={f.key}
              onClick={() => setActiveFruit(f.key)}
              className={`p-5 rounded-3xl border glass-panel cursor-pointer transition-all space-y-3 ${
                isActive
                  ? `bg-gray-900/80 border-${f.color.replace('#', '')}/30 ring-1 ring-${f.color.replace('#', '')}/20`
                  : 'bg-gray-900/40 border-white/5 hover:border-white/10'
              }`}
              style={{ borderColor: isActive ? f.color + '40' : undefined }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{f.emoji}</span>
                  <span className="text-sm font-bold text-white">{f.key}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${f.badge}`}>
                  {counts[f.key]} scans
                </span>
              </div>
              <FruitChart fruit={f.key} records={records} />
            </div>
          );
        })}
      </div>

      {/* ── Active fruit: big chart + table ── */}
      <div className="space-y-6">
        {/* Big chart */}
        {filteredRecords.length >= 2 && (
          <div className="p-6 rounded-3xl bg-gray-900/60 border border-white/10 glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                <TrendingDown size={16} style={{ color: cfg.color }} />
                {cfg.emoji} {activeFruit} — Freshness Trend
              </h3>
              <span className="text-[11px] text-gray-400 font-mono">
                {filteredRecords.length} measurements
              </span>
            </div>
            <div className="h-64 w-full">
              <FruitChart fruit={activeFruit} records={records} />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-3xl bg-gray-900/60 border border-white/10 glass-panel overflow-hidden shadow-2xl">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
            <span className="text-xl">{cfg.emoji}</span>
            <div>
              <h2 className="text-sm font-bold text-white">{activeFruit} Records</h2>
              <p className="text-[11px] text-gray-400">{filteredRecords.length} prediction{filteredRecords.length !== 1 ? 's' : ''} logged</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-black/40 border-b border-white/10 text-gray-400 uppercase tracking-wider font-mono text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Date</th>
                  <th className="py-3.5 px-4 font-semibold">Specimen</th>
                  <th className="py-3.5 px-4 font-semibold">Fruit</th>
                  <th className="py-3.5 px-4 font-semibold">Environment</th>
                  <th className="py-3.5 px-4 font-semibold">CNN Result</th>
                  <th className="py-3.5 px-4 font-semibold">Freshness</th>
                  <th className="py-3.5 px-4 font-semibold">Shelf Life</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-gray-500">
                      Loading records…
                    </td>
                  </tr>
                ) : filteredRecords.length > 0 ? (
                  filteredRecords.map((item) => {
                    const fruit  = normaliseFruit(item.fruitType);
                    const fc     = FRUIT_MAP[fruit] || cfg;
                    const isFresh = item.cnnClass?.toLowerCase() === 'fresh';
                    return (
                      <tr key={item._id} className="hover:bg-white/5 transition-colors">

                        {/* Date */}
                        <td className="py-4 px-4 font-mono text-gray-400 whitespace-nowrap text-[11px]">
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>

                        {/* Thumbnail */}
                        <td className="py-4 px-4">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="thumb"
                              className="w-10 h-10 rounded-xl object-cover border border-white/10 bg-black/40"
                              onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                              {fc.emoji}
                            </div>
                          )}
                        </td>

                        {/* Fruit type */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${fc.badge}`}>
                            {fc.emoji} {fruit}
                          </span>
                        </td>

                        {/* Env */}
                        <td className="py-4 px-4 font-mono text-gray-400 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-red-400">
                              <Thermometer size={11} />{item.temperature}°C
                            </span>
                            <span className="flex items-center gap-1 text-cyan-400">
                              <Droplets size={11} />{item.humidity}%
                            </span>
                          </div>
                        </td>

                        {/* CNN */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isFresh
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}>
                            {item.cnnClass} ({Math.round((item.cnnConfidence || 0) * 100)}%)
                          </span>
                        </td>

                        {/* Freshness */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${item.freshnessIndex || 0}%`, backgroundColor: cfg.color }} />
                            </div>
                            <span className="font-mono font-bold text-xs" style={{ color: cfg.color }}>
                              {(item.freshnessIndex || 0).toFixed(1)}
                            </span>
                          </div>
                        </td>

                        {/* Shelf life */}
                        <td className="py-4 px-4 font-mono font-black whitespace-nowrap text-sm"
                          style={{ color: cfg.color }}>
                          {item.adjustedRemainingDays || item.baseRemainingDays} d
                        </td>

                        {/* Delete */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <button onClick={() => handleDelete(item._id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-gray-500 space-y-2">
                      <div className="text-3xl">{cfg.emoji}</div>
                      <div>No {activeFruit} predictions yet.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

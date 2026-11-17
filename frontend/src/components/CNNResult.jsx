import React from 'react';
import { Eye, CheckCircle, AlertTriangle, XCircle, Leaf } from 'lucide-react';

// Fruit emoji map
const FRUIT_EMOJI = {
  Banana:      '🍌',
  Bittergourd: '🥬',
  Tomato:      '🍅',
  Unknown:     '❓',
};

export default function CNNResult({ cnnData }) {
  if (!cnnData) return null;

  const {
    class: cnnClass = 'Unknown',
    confidence = 0,
    probabilities = {},
    fruit_type = null,
    expiry_status = null,
    cnn_confidence = null,
  } = cnnData;

  const isInvalid = cnnClass.toLowerCase().includes('invalid') || cnnClass.toLowerCase().includes('not a');

  const freshProb  = Math.round((probabilities.Fresh  || 0) * 100);
  const rottenProb = Math.round((probabilities.Rotten || 0) * 100);

  // Determine status from whichever probability is highest
  const statusLabel = isInvalid ? cnnClass : (freshProb >= rottenProb ? 'Fresh' : 'Rotten');
  const isFresh     = statusLabel.toLowerCase() === 'fresh';

  const confPercent = cnn_confidence != null
    ? Math.round(cnn_confidence)
    : Math.round((confidence || 0) * 100);

  const fruitEmoji = FRUIT_EMOJI[fruit_type] || '🔍';

  return (
    <div className="p-5 rounded-3xl bg-gray-900/70 border border-white/10 glass-panel space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <Eye size={16} className="text-emerald-400" />
          ResNet50 Visual Classification
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
          {isInvalid ? 'Validation Filter' : '2048-D Features'}
        </span>
      </div>

      {/* Fruit type badge */}
      {fruit_type && !isInvalid && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit">
          <span className="text-lg">{fruitEmoji}</span>
          <div>
            <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Detected Fruit
            </div>
            <div className="text-sm font-extrabold text-white">{fruit_type}</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/5">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isInvalid
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : isFresh
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isInvalid ? (
              <XCircle size={20} />
            ) : isFresh ? (
              <CheckCircle size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
          </div>
          <div>
            <div className="text-base sm:text-lg font-bold text-white">
              {isInvalid
                ? cnnClass
                : `${statusLabel} ${fruit_type || ''}`}
            </div>
            <div className="text-xs text-gray-400">
              {isInvalid
                ? 'Unsupported specimen — rejected before inference'
                : 'Visual degradation state'}
            </div>
          </div>
        </div>

        {!isInvalid && (
          <div className="text-right">
            <div className="text-xl font-extrabold text-emerald-400 font-mono">{confPercent}%</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              Confidence
            </div>
          </div>
        )}
      </div>

      {/* Probability bars */}
      {!isInvalid ? (
        <div className="space-y-2 pt-1">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-emerald-400">Fresh Probability</span>
              <span className="font-mono text-gray-300">{freshProb}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${freshProb}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-rose-400">Rotten Probability</span>
              <span className="font-mono text-gray-300">{rottenProb}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-rose-500 to-amber-600 h-full rounded-full transition-all duration-700"
                style={{ width: `${rottenProb}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          ResNet50 classification skipped — unsupported specimen detected.
          Please upload a Banana, Bittergourd, or Tomato image.
        </div>
      )}
    </div>
  );
}

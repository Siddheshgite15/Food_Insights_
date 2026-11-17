
import React from 'react';
import { Eye } from 'lucide-react';

// Fruit emoji map
const FRUIT_EMOJI = {
  Banana: '🍌',
  Bittergourd: '🥬',
  Tomato: '🍅',
  Unknown: '❓',
};

export default function FreshnessGauge({
  score = 82,
  status = 'Fresh',
  cnnData,
}) {
  // Extract CNN fields
  const {
    class: cnnClass = 'Unknown',
    confidence = 0,
    probabilities = {},
    fruit_type = null,
    expiry_status = null,
    cnn_confidence = null,
  } = cnnData || {};

  const hasCnn = !!cnnData;

  // Normalize confidence/probability to percentage (0–100).
  // Supports both decimal values (0.95) and percentages (95).
  const normalizePercent = (value) => {
    if (
      value == null ||
      value === '' ||
      !Number.isFinite(Number(value))
    ) {
      return null;
    }

    const number = Number(value);

    return Math.max(
      0,
      Math.min(100, number <= 1 ? number * 100 : number)
    );
  };

  const confidencePercent =
    normalizePercent(cnn_confidence ?? confidence) ?? 0;

  const freshProb = normalizePercent(probabilities.Fresh);
  const rottenProb = normalizePercent(probabilities.Rotten);

  const cnnLabel = String(cnnClass || '').toLowerCase();
  const expiryLabel = String(expiry_status || '').toLowerCase();

  // Detect invalid input.
  const isInvalid =
    !hasCnn ||
    /invalid|not a|no banana/.test(cnnLabel) ||
    /invalid|not a|no banana/.test(expiryLabel);

  // Determine the CNN label.
  // Probabilities take priority when both are available.
  const predictedLabel = isInvalid
    ? null
    : freshProb != null && rottenProb != null
      ? freshProb >= rottenProb
        ? 'Fresh'
        : 'Rotten'
      : /\bfresh\b/.test(cnnLabel)
        ? 'Fresh'
        : /\brotten\b/.test(cnnLabel)
          ? 'Rotten'
          : /\bfresh\b/.test(expiryLabel)
            ? 'Fresh'
            : /\brotten\b/.test(expiryLabel)
              ? 'Rotten'
              : null;

  // Calculate freshness index from CNN output.
  //
  // If probabilities exist:
  // Freshness Index = Fresh probability
  //
  // Otherwise:
  // Fresh prediction  -> confidence
  // Rotten prediction -> 100 - confidence

  const calculatedScore =
    freshProb != null && rottenProb != null
      ? freshProb
      : predictedLabel === 'Fresh'
        ? confidencePercent
        : predictedLabel === 'Rotten'
          ? 100 - confidencePercent
          : score;

  const clampedScore =
    isInvalid || !predictedLabel
      ? 0
      : Math.round(
        Math.max(0, Math.min(100, calculatedScore))
      );

  const displayLabel = isInvalid
    ? 'Invalid'
    : predictedLabel || 'Unknown';

  const fruitEmoji = FRUIT_EMOJI[fruit_type] || '🔍';

  // Gauge colors: only Fresh and Rotten classifications.
  let color = '#10b981';
  let glow = 'rgba(16, 185, 129, 0.4)';
  let bgGradient = 'from-emerald-500/20 to-transparent';

  if (isInvalid || displayLabel === 'Unknown') {
    color = '#f59e0b';
    glow = 'rgba(245, 158, 11, 0.2)';
    bgGradient = 'from-amber-500/10 to-transparent';
  } else if (displayLabel === 'Rotten') {
    color = '#ef4444';
    glow = 'rgba(239, 68, 68, 0.4)';
    bgGradient = 'from-rose-500/20 to-transparent';
  }

  // SVG circular gauge calculations.
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;

  const strokeDashoffset =
    arcLength - (arcLength * clampedScore) / 100;

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-6 rounded-3xl bg-gradient-to-b ${bgGradient} border border-white/10 glass-panel shadow-2xl`}
    >
      {/* Circular Gauge */}
      <div className="relative w-52 h-52 flex items-center justify-center">
        <svg
          className="w-full h-full transform -rotate-135"
          viewBox="0 0 200 200"
        >
          {/* Background Arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="14"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Active Value Arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${glow})`,
              transition:
                'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>


        {/* Center Content — No Status Label Inside Circle */}
        <div className="absolute flex flex-col items-center justify-center text-center px-2">
          <span className="text-4xl font-black tracking-tight text-white font-mono">
            {isInvalid || displayLabel === 'Unknown'
              ? 'N/A'
              : clampedScore}
          </span>

          <span className="text-[11px] uppercase font-bold tracking-widest text-gray-400 mt-0.5">
            {isInvalid || displayLabel === 'Unknown'
              ? 'Invalid Specimen'
              : '/ 100 Index'}
          </span>
        </div>

      </div>


      {/* Freshness Index and Status */}
      <div className="text-center mt-2">
        <h3 className="text-sm font-semibold text-gray-200">
          Freshness Index
        </h3>

        <p className="text-xs text-gray-400 mt-0.5">
          {isInvalid || displayLabel === 'Unknown'
            ? 'No valid Fresh/Rotten prediction'
            : 'CNN-based freshness index'}
        </p>

        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-xs font-semibold text-gray-400">
            Status:
          </span>

          <span
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${color}20`,
              color,
              border: `1px solid ${color}40`,
            }}
          >
            {displayLabel}
          </span>
        </div>
      </div>


      {/* CNN Classification Results */}
      {hasCnn && (
        <div className="w-full mt-5 pt-4 border-t border-white/10 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <Eye size={13} className="text-emerald-400" />
              CNN Classification
            </div>

            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500">
              {isInvalid ? 'Rejected' : 'ResNet50'}
            </span>
          </div>

          {/* Detected Fruit */}
          {fruit_type && !isInvalid && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit">
              <span className="text-base">
                {fruitEmoji}
              </span>

              <div>
                <div className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">
                  Detected
                </div>

                <div className="text-xs font-extrabold text-white">
                  {fruit_type}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  ArrowRight, CheckCircle2, Cpu, Eye, GitBranch,
  Layers, Thermometer, Sparkles, ChevronDown, ChevronUp,
  AlertOctagon, HelpCircle,
} from 'lucide-react';

const FRUIT_EMOJI = { banana: '🍌', bittergourd: '🥬', tomato: '🍅' };

export default function StepByStepPipeline({ mlData, prediction }) {
  const [showInfo, setShowInfo] = useState(false);
  if (!mlData && !prediction) return null;

  const raw       = mlData ?? {};
  const isValid   = raw.isValidFruit ?? raw.isBanana ?? true;
  const validation = raw.validation ?? {};
  const topItem   = validation.top_prediction ?? validation.detected_fruit ?? 'unknown item';
  const fruitType  = raw.cnn?.fruit_type ?? null;
  const fruitKey  = (fruitType ?? '').toLowerCase();
  const emoji     = FRUIT_EMOJI[fruitKey] ?? '🔍';

  const cnnClass  = raw.cnn?.class ?? 'Unknown';
  const cnnConf   = ((raw.cnn?.cnn_confidence) ?? (raw.cnn?.confidence ?? 0) * 100).toFixed(1);
  const predClass = raw.cnn?.predicted_class ?? '';
  const baseDays  = raw.lstm?.baseRemainingDays ?? 0;
  const adjDays   = raw.finalPrediction?.remainingDays ?? 0;
  const freshIdx  = raw.finalPrediction?.freshnessIndex ?? 0;
  const status    = raw.finalPrediction?.status ?? '';
  const temp      = raw.environment?.temperature ?? 25;
  const hum       = raw.environment?.humidity ?? 60;
  const envFactor = raw.environment?.environmentalFactor ?? 1.0;

  const steps = isValid ? [
    {
      num: 1, icon: Eye, badge: 'MobileNetV3 + HSV heuristics',
      title: 'Specimen Validation',
      desc: `${fruitType ?? 'Fruit'} confirmed (${(validation.confidence ?? 1) * 100 > 1 ? ((validation.confidence ?? 1) * 100).toFixed(1) : (validation.banana_confidence ?? 1) * 100}% signal). Image resized to 224×224, ImageNet-normalised.`,
      flow: 'Input: uploaded image',
      out:  `Validation: PASSED  |  Tensor: (1, 3, 224, 224)`,
      color: 'emerald', status: 'ok',
    },
    {
      num: 2, icon: Cpu, badge: 'ResNet50 — 6 classes',
      title: 'ResNet50 Visual Classification',
      desc: `ResNet50 backbone extracts 2048-D features. Custom head classifies into 6 classes: fresh/rotten × banana/bittergourd/tomato.`,
      flow: 'From Step 1 tensor',
      out:  `Class: "${predClass}"  |  Status: ${cnnClass}  |  Confidence: ${cnnConf}%  |  2048-D features`,
      color: 'blue', status: 'ok',
    },
    {
      num: 3, icon: GitBranch, badge: '38-D fused vector',
      title: 'Feature Fusion',
      desc: '2048-D CNN features compressed to 16-D via chunk pooling, fused with 14 colour moments (RGB/HSV/Lab) and 8 GLCM texture metrics.',
      flow: 'From 2048-D CNN features + OpenCV analysis',
      out:  `Fused: 38-D  (16 CNN + 14 colour + 8 texture)`,
      color: 'purple', status: 'ok',
    },
    {
      num: 4, icon: Layers, badge: 'LSTM regressor',
      title: 'LSTM Shelf-Life Prediction',
      desc: '38-D vector expanded to (1, 8, 38) temporal sequence, scaled by StandardScaler, fed to LSTM for shelf-life regression.',
      flow: 'From 38-D fused vector → (1, 8, 38) scaled sequence',
      out:  `Base Shelf Life: ${baseDays} days  (at 25°C baseline)`,
      color: 'cyan', status: 'ok',
    },
    {
      num: 5, icon: Thermometer, badge: 'Arrhenius Q₁₀ kinetics',
      title: 'Environmental Adjustment',
      desc: `Arrhenius kinetic model adjusts for ${temp}°C, ${hum}% RH storage conditions (factor: ${envFactor}×).`,
      flow: 'From LSTM base days + environmental inputs',
      out:  `Final: ${adjDays} days  |  Freshness: ${freshIdx}%  |  Status: ${status}`,
      color: 'teal', status: 'ok',
    },
  ] : [
    {
      num: 1, icon: AlertOctagon, badge: 'MobileNetV3 + HSV heuristics',
      title: 'Specimen Validation — Rejected',
      desc: `Detected: "${topItem}". Only Banana, Bittergourd, and Tomato are supported. Pipeline halted.`,
      flow: 'Input: uploaded image',
      out:  `Validation: FAILED  |  Detected: "${topItem}"`,
      color: 'rose', status: 'error',
    },
    ...[
      ['ResNet50 Visual Classification', 'ResNet50 — 6 classes'],
      ['Feature Fusion', '38-D fused vector'],
      ['LSTM Shelf-Life Prediction', 'LSTM regressor'],
      ['Environmental Adjustment', 'Arrhenius Q₁₀ kinetics'],
    ].map(([title, badge], i) => ({
      num: i + 2, icon: [Cpu, GitBranch, Layers, Thermometer][i], badge,
      title, desc: 'Skipped — blocked at Step 1.',
      flow: 'Blocked at Step 1', out: 'SKIPPED',
      color: 'gray', status: 'skip',
    })),
  ];

  const colorMap = {
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    blue:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
    cyan:    'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    teal:    'bg-teal-500/20 text-teal-400 border-teal-500/30',
    rose:    'bg-rose-500/20 text-rose-400 border-rose-500/30',
    gray:    'bg-gray-700/40 text-gray-500 border-gray-600/30',
  };
  const outMap = {
    ok:    'bg-black/50 border-white/5 text-emerald-300',
    error: 'bg-rose-950/40 border-rose-500/30 text-rose-300',
    skip:  'bg-black/30 border-white/5 text-gray-500',
  };

  return (
    <div className="p-6 rounded-3xl bg-gray-900/70 border border-white/10 glass-panel shadow-2xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${isValid ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border-rose-500/20'}`}>
            {isValid ? <Sparkles size={20} /> : <AlertOctagon size={20} />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">AI Pipeline — Step by Step</h3>
            <p className="text-xs text-gray-400">
              {isValid
                ? `${emoji} ${fruitType} · ResNet50 → 38-D fusion → LSTM → Kinetics`
                : `Unsupported specimen filtered at Step 1`}
            </p>
          </div>
        </div>
        <span className={`self-start sm:self-center px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${isValid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
          {isValid ? <CheckCircle2 size={14} /> : <AlertOctagon size={14} />}
          {isValid ? 'Specimen Accepted' : 'Specimen Rejected'}
        </span>
      </div>

      {/* Info toggle */}
      {!isValid && (
        <div className="rounded-2xl border bg-amber-500/10 border-amber-500/20 p-3">
          <button onClick={() => setShowInfo(!showInfo)}
            className="w-full flex items-center justify-between text-xs font-semibold text-amber-300 hover:text-amber-200">
            <span className="flex items-center gap-2">
              <HelpCircle size={15} className="text-amber-400" />
              Why was this image rejected?
            </span>
            {showInfo ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
          {showInfo && (
            <p className="pt-2 text-xs text-gray-300 border-t border-white/10 mt-2 leading-relaxed">
              The validator detected <strong className="text-amber-300">"{topItem}"</strong> which is not
              in the supported set (Banana, Bittergourd, Tomato). Please upload a clear, well-lit
              photo of one of these three fruits.
            </p>
          )}
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isSkip = s.status === 'skip';
          return (
            <div key={s.num}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                s.status === 'error' ? 'bg-rose-500/[0.04] border-rose-500/20' :
                isSkip ? 'bg-white/[0.01] border-white/5 opacity-50' :
                'bg-white/[0.02] hover:bg-white/[0.04] border-white/5'}`}>
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm font-bold ${colorMap[s.color]}`}>
                  {s.num}
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-0.5 h-6 bg-gradient-to-b from-white/20 to-transparent mt-1" />
                )}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Icon size={14} className={colorMap[s.color].split(' ')[1]} />
                    {s.title}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                    {s.badge}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{s.desc}</p>
                <div className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                  <span className="text-emerald-400/70">↳</span> {s.flow}
                </div>
                <div className={`px-3 py-2 rounded-xl border text-[11px] font-mono flex items-center gap-2 ${outMap[s.status]}`}>
                  <ArrowRight size={12} />
                  <span className="truncate">{s.out}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

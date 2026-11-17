import React, { useState, useEffect } from 'react';
import ImageUpload from '../components/ImageUpload';
import EnvironmentInput from '../components/EnvironmentInput';
import FreshnessGauge from '../components/FreshnessGauge';
import CNNResult from '../components/CNNResult';
import ShelfLifeCard from '../components/ShelfLifeCard';
import PredictionChart from '../components/PredictionChart';
import Loading from '../components/Loading';
import { predictionService } from '../services/predictionService';
import confetti from 'canvas-confetti';
import { Sparkles, AlertCircle, RefreshCw, Cpu } from 'lucide-react';

// ── Fruit emoji map ────────────────────────────────────────────────────────────
const FRUIT_EMOJI = { Banana: '🍌', Bittergourd: '🥬', Tomato: '🍅' };

export default function Prediction() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [viewCount, setViewCountState] = useState(1);
  const [temperature, setTemperature] = useState(25.0);
  const [humidity, setHumidity] = useState(60.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showTechnicalDetails, setShowTechnical] = useState(false);

  // ── helpers to read the new unified response shape ─────────────────────────
  const getFromResult = (r) => {
    if (!r) return {};
    const raw = r.mlRaw ?? r;          // direct FastAPI payload or wrapped
    return {
      isValidFruit: raw.isValidFruit ?? raw.isBanana ?? true,
      fruitType: raw.cnn?.fruit_type ?? null,
      freshnessIndex: raw.finalPrediction?.freshnessIndex ?? r.prediction?.freshnessIndex ?? 0,
      remainingDays: raw.finalPrediction?.remainingDays ?? r.prediction?.adjustedRemainingDays ?? 0,
      baseDays: raw.lstm?.baseRemainingDays ?? r.prediction?.baseRemainingDays ?? 0,
      envFactor: raw.environment?.environmentalFactor ?? r.prediction?.environmentalFactor ?? 1.0,
      status: raw.finalPrediction?.status ?? r.prediction?.status ?? '',
      topPrediction: raw.validation?.top_prediction ?? 'unknown item',
      cnnData: raw.cnn,
    };
  };

  // ── run prediction ──────────────────────────────────────────────────────────
  const runPredictionForFiles = async (files, temp = temperature, hum = humidity) => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles(files);
    setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
    setError(null);
    setLoading(true);

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    formData.append('temperature', temp.toString());
    formData.append('humidity', hum.toString());

    try {
      const data = await predictionService.predict(formData);
      // Accept both wrapped (Express proxy) and direct (FastAPI) response shapes
      const payload = data.success ? data : { mlRaw: data, success: true };
      setResult(payload);

      const fi = payload.mlRaw?.finalPrediction?.freshnessIndex ?? payload.prediction?.freshnessIndex ?? 0;
      if (fi >= 70) {
        confetti({
          particleCount: 70, spread: 60, origin: { y: 0.7 },
          colors: ['#10b981', '#34d399', '#6ee7b7']
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.message ?? err.message ??
        'Failed to connect. Please ensure the Express & FastAPI services are running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImagesSelect = (files) => {
    const selected = files.slice(0, viewCount);
    if (selected.length !== viewCount) {
      setSelectedFiles(selected);
      setPreviewUrls(selected.map((file) => URL.createObjectURL(file)));
      setError(`Please select exactly ${viewCount} images from different angles.`);
      return;
    }
    runPredictionForFiles(selected, temperature, humidity);
  };

  const setViewCount = (count) => {
    setViewCountState(count);
    if (selectedFiles.length > count) handleClear();
  };

  const handleClear = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
    setResult(null);
    setError(null);
  };

  // ── webcam auto-capture polling ─────────────────────────────────────────────
  useEffect(() => {
    let lastFilename = null, isFetching = false, isMounted = true;
    const check = async (initial = false) => {
      if (isFetching || !isMounted) return;
      isFetching = true;
      try {
        const res = await fetch('/api/prediction/latest-capture-info');
        if (res.ok) {
          const info = await res.json();
          if (info.exists && info.filename && (info.filename !== lastFilename || initial)) {
            lastFilename = info.filename;
            const imgRes = await fetch('/api/prediction/latest-capture');
            if (imgRes.ok && isMounted) {
              const blob = await imgRes.blob();
              await runPredictionForFiles([new File([blob], info.filename, { type: 'image/jpeg' })]);
            }
          }
        }
      } catch (_) { /* silent */ } finally { isFetching = false; }
    };
    check(true);
    const iv = setInterval(() => check(false), 1500);
    return () => { isMounted = false; clearInterval(iv); };
  }, []);

  // ── extract display values ──────────────────────────────────────────────────
  const display = getFromResult(result);
  const raw = result?.mlRaw ?? result;
  const isValid = display.isValidFruit;
  const emoji = FRUIT_EMOJI[display.fruitType] ?? '🔍';

  return (
    <div className="relative min-h-[calc(100vh-65px)] py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      <div className="ambient-glow w-[400px] h-[400px] bg-emerald-500/10 top-10 left-10" />
      <div className="ambient-glow w-[350px] h-[350px] bg-teal-500/10 bottom-10 right-10" />

      {/* ── Header ── */}
      <div className="relative z-10 text-center space-y-2.5 max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles size={13} />
            ResNet50 CNN · LSTM (8×38) · Arrhenius Kinetics
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            Banana · Bittergourd · Tomato
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
          Fruit Freshness & <span className="gradient-text">Shelf-Life</span> Predictor
        </h1>
        <p className="text-sm sm:text-base text-gray-400">
          Upload a Banana, Bittergourd, or Tomato photo. Freshness and shelf-life are
          predicted automatically — no button click required.
        </p>
      </div>

      {/* ── Main grid ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left: inputs */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={(e) => { e.preventDefault(); if (selectedFiles.length) runPredictionForFiles(selectedFiles); }}
            className="p-6 rounded-3xl bg-gray-900/60 border border-white/10 glass-panel shadow-2xl space-y-6">

            <ImageUpload onImagesSelect={handleImagesSelect} selectedImages={selectedFiles}
              previewUrls={previewUrls} onClear={handleClear} viewCount={viewCount}
              setViewCount={setViewCount} />

            <EnvironmentInput temperature={temperature} setTemperature={setTemperature}
              humidity={humidity} setHumidity={setHumidity} />

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            {/* Status bar */}
            {loading ? (
              <div className="w-full py-3.5 px-6 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                <RefreshCw size={16} className="animate-spin" />
                Analysing specimen (ResNet50 + LSTM)…
              </div>
            ) : result ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs flex items-center gap-2">
                      {emoji && <span>{emoji}</span>}
                      {display.fruitType ?? 'Specimen'} · Shelf Life Calculated
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">LIVE</span>
                    </div>
                    <div className="text-[11px] text-emerald-400/80 truncate">
                      Syncs with Arduino DHT22 sensor readings
                    </div>
                  </div>
                </div>
                <button type="button"
                  onClick={() => selectedFiles.length && runPredictionForFiles(selectedFiles, temperature, humidity)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0">
                  <RefreshCw size={13} /> Re-Scan
                </button>
              </div>
            ) : (
              <div className="w-full py-3.5 px-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="shrink-0" />
                  Upload a fruit image to auto-predict
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 font-semibold shrink-0">
                  ⚡ Auto-Predict
                </span>
              </div>
            )}
          </form>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-7 space-y-6">
          {loading ? (
            <div className="p-12 rounded-3xl bg-gray-900/60 border border-white/10 glass-panel flex items-center justify-center min-h-[480px]">
              <Loading step="Running ResNet50 feature extraction and LSTM shelf-life regression…" />
            </div>

          ) : result ? (
            <div className="space-y-6 animate-fadeIn">

              {/* Invalid fruit warning */}
              {!isValid && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 flex items-start gap-3">
                  <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">Unsupported Item Detected</h4>
                    <p className="text-xs leading-relaxed">
                      The AI identified <strong className="text-amber-300">"{display.topPrediction}"</strong>.
                      Only <strong>Banana, Bittergourd</strong> and <strong>Tomato</strong> are supported.
                      Please upload a clear image of one of these fruits.
                    </p>
                  </div>
                </div>
              )}

              {/* Gauge + Shelf Life */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                <div className="md:col-span-5">
                  <FreshnessGauge score={display.freshnessIndex} status={display.status} cnnData={display.cnnData} />
                </div>
                <div className="md:col-span-7">
                  <ShelfLifeCard
                    baseDays={display.baseDays}
                    adjustedDays={display.remainingDays}
                    factor={display.envFactor}
                    temperature={temperature}
                    humidity={humidity}
                    isValidFruit={isValid}
                    fruitType={display.fruitType}
                  />
                </div>
              </div>

              {/* CNN result */}
              <CNNResult cnnData={display.cnnData} />

              {/* Degradation chart */}
              <PredictionChart
                currentDays={display.remainingDays}
                currentIndex={display.freshnessIndex}
              />

              {/* Raw JSON toggle */}
              <div className="p-4 rounded-2xl bg-gray-900/40 border border-white/5 space-y-3">
                <button type="button"
                  onClick={() => setShowTechnical(!showTechnicalDetails)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors">
                  <span className="flex items-center gap-2">
                    <Cpu size={14} className="text-emerald-400" />
                    Pipeline Diagnostics
                  </span>
                  <span className="text-[11px] text-emerald-400 underline">
                    {showTechnicalDetails ? 'Hide JSON' : 'View Model Output'}
                  </span>
                </button>
                {showTechnicalDetails && (
                  <div className="pt-2 text-xs font-mono border-t border-white/5 text-gray-300">
                    <div className="p-3 rounded-xl bg-black/60 border border-white/5 overflow-x-auto max-h-96">
                      <pre>{JSON.stringify(raw, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

          ) : (
            <div className="p-12 rounded-3xl bg-gray-900/40 border border-dashed border-white/10 glass-panel flex flex-col items-center justify-center text-center min-h-[480px] space-y-4">
              <div className="flex gap-3 text-4xl">🍌 🥬 🍅</div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-lg font-bold text-white">Food-Insights Ready</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Upload a Banana, Bittergourd, or Tomato photo. Freshness index, shelf-life days,
                  and degradation curve appear automatically.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-4 max-w-sm w-full text-center">
                {[['ResNet50', 'Visual CNN', 'emerald'], ['LSTM (8,38)', 'Time-Series', 'cyan'], ['Arrhenius Q₁₀', 'Kinetics', 'teal']].map(([title, sub, color]) => (
                  <div key={title} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] space-y-0.5">
                    <div className={`font-bold text-${color}-400`}>{title}</div>
                    <div className="text-gray-400">{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

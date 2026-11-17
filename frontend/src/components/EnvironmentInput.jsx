import React, { useState, useEffect, useRef } from 'react';
import { Thermometer, Droplets, Gauge, RefreshCw, Cpu, Activity } from 'lucide-react';

export default function EnvironmentInput({
  temperature,
  setTemperature,
  humidity,
  setHumidity,
}) {
  const [sensorStatus, setSensorStatus] = useState(null);
  const [syncingSensor, setSyncingSensor] = useState(false);
  const [autoLive, setAutoLive] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const isFetchingRef = useRef(false);

  const fetchArduinoSensor = async (manual = false) => {
    if (isFetchingRef.current && !manual) return;
    isFetchingRef.current = true;
    if (manual) setSyncingSensor(true);
    try {
      const res = await fetch('http://localhost:5000/api/prediction/sensor/latest');
      const data = await res.json();
      setSensorStatus(data);
      if (data && data.is_live && data.temperature !== undefined && data.humidity !== undefined) {
        if (autoLive || manual) {
          setTemperature(Math.round(data.temperature * 10) / 10);
          setHumidity(Math.round(data.humidity * 10) / 10);
        }
        setLastUpdateTime(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.warn('Could not read sensor:', e);
    } finally {
      isFetchingRef.current = false;
      if (manual) setSyncingSensor(false);
    }
  };

  useEffect(() => {
    fetchArduinoSensor(false);
    const interval = setInterval(() => {
      if (autoLive) {
        fetchArduinoSensor(false);
      }
    }, 1000); // 1-second real-time polling
    return () => clearInterval(interval);
  }, [autoLive]);

  const handleManualTemp = (val) => {
    setAutoLive(false);
    setTemperature(val);
  };

  const handleManualHum = (val) => {
    setAutoLive(false);
    setHumidity(val);
  };

  const handlePresetSelect = (tempVal, humVal) => {
    setAutoLive(false);
    setTemperature(tempVal);
    setHumidity(humVal);
  };

  const handleSyncClick = () => {
    setAutoLive(true);
    fetchArduinoSensor(true);
  };

  const presets = [
    { label: 'Baseline', temp: 25, hum: 60, desc: 'Standard Room' },
    { label: 'Refrigerated', temp: 12, hum: 75, desc: 'Cold Storage' },
    { label: 'Warm/Humid', temp: 32, hum: 80, desc: 'Accelerated Spoilage' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Gauge size={16} className="text-amber-400" />
          Environmental Storage Conditions
        </label>
        <span className="text-[11px] text-gray-400 font-mono">
          Kinetics: Arrhenius Q₁₀ Model
        </span>
      </div>

      {/* Arduino DHT22 Live Sensor Sync Bar */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5 text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${sensorStatus?.is_live && autoLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-gray-300 font-medium">Arduino DHT22:</span>
          <span className="font-mono text-emerald-400 font-semibold text-[11px]">
            {sensorStatus?.is_live
              ? autoLive
                ? `${sensorStatus.temperature}°C, ${sensorStatus.humidity}% RH [LIVE 1s]`
                : `${sensorStatus.temperature}°C, ${sensorStatus.humidity}% RH (Paused)`
              : 'COM3 (USB Serial)'}
          </span>
          {lastUpdateTime && autoLive && (
            <span className="text-[10px] text-gray-500 font-mono">
              ({lastUpdateTime})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoLive(!autoLive)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              autoLive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
            }`}
            title={autoLive ? 'Click to pause auto-sync' : 'Click to enable live auto-sync'}
          >
            {autoLive ? 'Auto Sync ON' : 'Manual Mode'}
          </button>
          <button
            type="button"
            onClick={handleSyncClick}
            disabled={syncingSensor}
            className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-[11px] transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={syncingSensor ? 'animate-spin' : ''} />
            {syncingSensor ? 'Reading...' : 'Sync DHT22'}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => {
          const isSelected = temperature === p.temp && humidity === p.hum && !autoLive;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePresetSelect(p.temp, p.hum)}
              className={`p-2.5 rounded-xl border text-left transition-all text-xs ${
                isSelected
                  ? 'border-amber-500 bg-amber-500/15 text-white shadow-sm shadow-amber-500/10'
                  : 'border-white/5 bg-gray-900/50 hover:bg-gray-900/80 text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="font-semibold text-gray-200">{p.label}</div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                {p.temp}°C · {p.hum}% RH
              </div>
            </button>
          );
        })}
      </div>

      {/* Temperature Slider & Input */}
      <div className="p-4 rounded-2xl bg-gray-900/60 border border-white/5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-300 font-medium">
            <Thermometer size={16} className="text-red-400" />
            Ambient Temperature
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={temperature !== undefined && temperature !== null ? temperature : ''}
              onChange={(e) => handleManualTemp(parseFloat(e.target.value) || 0)}
              className="w-20 px-2.5 py-1 rounded-lg bg-gray-950 border border-white/10 text-right font-mono text-amber-400 font-bold text-sm focus:outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-gray-400 text-xs font-semibold">°C</span>
          </div>
        </div>

        <input
          type="range"
          min="5"
          max="45"
          step="0.5"
          value={temperature}
          onChange={(e) => handleManualTemp(parseFloat(e.target.value))}
          className="w-full accent-amber-500 cursor-pointer h-2 bg-gray-800 rounded-lg"
        />

        <div className="flex justify-between text-[11px] text-gray-500 font-mono">
          <span>5°C (Cool)</span>
          <span className="text-amber-500/80">25°C (Standard Baseline)</span>
          <span>45°C (Hot)</span>
        </div>
      </div>

      {/* Humidity Slider & Input */}
      <div className="p-4 rounded-2xl bg-gray-900/60 border border-white/5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-300 font-medium">
            <Droplets size={16} className="text-blue-400" />
            Relative Humidity
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="10"
              max="100"
              step="0.1"
              value={humidity !== undefined && humidity !== null ? humidity : ''}
              onChange={(e) => handleManualHum(parseFloat(e.target.value) || 0)}
              className="w-20 px-2.5 py-1 rounded-lg bg-gray-950 border border-white/10 text-right font-mono text-cyan-400 font-bold text-sm focus:outline-none focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-gray-400 text-xs font-semibold">% RH</span>
          </div>
        </div>

        <input
          type="range"
          min="20"
          max="95"
          step="0.5"
          value={humidity}
          onChange={(e) => handleManualHum(parseFloat(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer h-2 bg-gray-800 rounded-lg"
        />

        <div className="flex justify-between text-[11px] text-gray-500 font-mono">
          <span>20% (Dry)</span>
          <span className="text-cyan-500/80">60% (Baseline RH)</span>
          <span>95% (High Moisture)</span>
        </div>
      </div>
    </div>
  );
}

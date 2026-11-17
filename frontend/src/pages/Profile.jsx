import React from 'react';
import { Shield, Cpu } from 'lucide-react';

export default function Profile() {
  return (
    <div className="min-h-[calc(100vh-65px)] py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          System <span className="gradient-text">Profile</span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-400">
          Active machine learning model telemetry and system information
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Identity card */}
        <div className="md:col-span-1 p-6 rounded-3xl bg-gray-900/60 border border-white/10 glass-panel text-center space-y-4 shadow-xl">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-600 flex items-center justify-center text-4xl mx-auto shadow-lg shadow-emerald-500/20">
            🥬
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Food Research Scientist</h3>
            <p className="text-xs text-gray-400">Food-Insights Platform</p>
          </div>
          <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <Shield size={14} />
            ML Investigator
          </div>
        </div>

        {/* Model architecture */}
        <div className="md:col-span-2 p-6 rounded-3xl bg-gray-900/60 border border-white/10 glass-panel space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu size={16} className="text-emerald-400" />
            AI Model Architecture
          </h3>
          <div className="space-y-3 text-xs">
            {[
              {
                title: 'Vision CNN Backbone',
                sub:   'ResNet50 — 6-class (fresh/rotten × banana/bittergourd/tomato)',
                badge: 'ResNet50',
                color: 'emerald',
              },
              {
                title: 'Time-Series Predictor',
                sub:   'LSTM (8 timesteps, 38 features) — shelf-life regression',
                badge: 'Regression',
                color: 'cyan',
              },
              {
                title: 'Environmental Decay Engine',
                sub:   'Arrhenius Q₁₀ kinetic model — temperature & humidity correction',
                badge: 'Q₁₀ = 2.0',
                color: 'teal',
              },
              {
                title: 'Supported Fruits',
                sub:   'Banana  ·  Bittergourd  ·  Tomato',
                badge: '3 classes',
                color: 'purple',
              },
              {
                title: 'IoT Sensor',
                sub:   'Arduino UNO + DHT22 (live temperature & humidity)',
                badge: 'COM3 / Auto',
                color: 'blue',
              },
              {
                title: 'Database Layer',
                sub:   'MongoDB / MongoDB Atlas — prediction history',
                badge: 'Active',
                color: 'gray',
              },
            ].map(({ title, sub, badge, color }) => (
              <div key={title}
                className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-gray-200">{title}</div>
                  <div className="text-[11px] text-gray-400 truncate">{sub}</div>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-lg bg-${color}-500/10 text-${color}-400 font-mono font-bold border border-${color}-500/20`}>
                  {badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

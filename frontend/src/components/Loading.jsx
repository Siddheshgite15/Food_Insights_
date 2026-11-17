import React from 'react';

export default function Loading({ step = 'Processing image...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-5">
      <div className="relative w-24 h-24">
        {/* Outer pulsing ring */}
        <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-ping opacity-50" />
        <div className="absolute inset-2 rounded-full border-2 border-amber-400/50 animate-spin border-t-transparent" />
        
        {/* Center Fruit Icon */}
        <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 border border-amber-500/30 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/20">
          🍌
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-white tracking-wide">
          Deep Neural Analysis in Progress
        </h3>
        <p className="text-xs text-amber-400/90 font-mono animate-pulse">
          {step}
        </p>
      </div>

      <div className="w-48 bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-yellow-300 h-full rounded-full w-2/3 animate-pulse" />
      </div>
    </div>
  );
}

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Prediction from './pages/Prediction';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Profile from './pages/Profile';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#090d16] text-gray-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Prediction />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>

          <footer className="border-t border-white/5 py-6 px-4 text-center text-xs text-gray-500 glass-panel mt-12">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🥬</span>
                <span className="font-bold text-gray-300">Food-Insights</span>
                <span>— Multi-Fruit AI Freshness Detection</span>
              </div>
              <div className="font-mono text-[11px] text-gray-400">
                ResNet50 · LSTM (8×38) · Arrhenius Kinetics
              </div>
            </div>
          </footer>
        </div>
      </Router>
  );
}

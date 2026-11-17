import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, History, LayoutDashboard, User } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  const navLinks = [
    { name: 'Predict', path: '/', icon: Sparkles },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'History', path: '/history', icon: History }
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-4 lg:px-8 py-3.5 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-300 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
            🥬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                Food-Insights
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                AI ResNet50
              </span>
            </div>
            <p className="text-xs text-gray-400">Multi-Fruit Freshness & Shelf-Life Intelligence</p>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="hidden md:flex items-center gap-1.5 bg-gray-900/60 p-1 rounded-2xl border border-white/5">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/20'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon size={16} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Mobile nav hint */}
        <div className="md:hidden flex items-center gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`p-2 rounded-xl text-sm transition-all ${isActive
                    ? 'bg-emerald-500 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon size={18} />
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

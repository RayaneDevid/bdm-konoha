import { NavLink } from 'react-router-dom';
import type { Role } from '../../types';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  RefreshCw,
  ShieldCheck,
  Gift,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/adherents', label: 'Adhérents', icon: Users },
  { to: '/rapports', label: 'Rapports BDM', icon: FileText },
  { to: '/recompenses', label: 'Récompenses', icon: Gift },
  { to: '/config-cartes', label: 'Config Cartes', icon: Settings, gerantOnly: true },
  { to: '/cycles', label: 'Cycles', icon: RefreshCw, gerantOnly: true },
  { to: '/administration', label: 'Administration', icon: ShieldCheck, adminOnly: true },
];

export default function Sidebar() {
  const role = 'gerant' as Role; // TODO: remplacer par le vrai role

  const visibleItems = navItems.filter((item) => {
    if (item.gerantOnly && role === 'membre_bdm') return false;
    if (item.adminOnly && role === 'membre_bdm') return false;
    return true;
  });

  return (
    <aside className="w-64 min-h-screen bg-[#3E2723] border-r-4 border-[#5D4037] flex flex-col">
      {/* Logo */}
      <div className="px-6 pt-6 pb-4 border-b-2 border-[#5D4037]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#8B0000] border-2 border-[#D4A017] flex items-center justify-center">
            <span className="text-[#D4A017] text-xl" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              忍
            </span>
          </div>
          <div>
            <h2
              className="text-[#D4A017] text-lg font-medium leading-tight"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Bureau
            </h2>
            <p className="text-[#FAF3E3] text-xs opacity-75">des Missions</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 h-12 rounded transition-colors ${
                isActive
                  ? 'bg-[#8B0000] text-[#FAF3E3] shadow-lg'
                  : 'text-[#FAF3E3] hover:bg-[#5D4037]/50'
              }`
            }
          >
            <item.icon size={20} />
            <span className="text-base">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Separateur decoratif */}
      <div className="mx-6 mb-4 h-px bg-gradient-to-r from-transparent via-[#D4A017] to-transparent" />
    </aside>
  );
}

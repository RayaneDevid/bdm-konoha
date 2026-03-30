import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  RefreshCw,
  ShieldCheck,
  Gift,
  UserSearch,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/adherents', label: 'Adhérents', icon: Users, gerantOnly: true },
  { to: '/rapports', label: 'Rapports BDM', icon: FileText },
  { to: '/fiche-membre', label: 'Fiche Membre BDM', icon: UserSearch },
  { to: '/recompenses', label: 'Récompenses', icon: Gift },
  { to: '/config-cartes', label: 'Config Cartes', icon: Settings, gerantOnly: true },
  { to: '/cycles', label: 'Cycles', icon: RefreshCw, gerantOnly: true },
  { to: '/administration', label: 'Administration', icon: ShieldCheck, adminOnly: true },
];

export default function Sidebar() {
  const { staffUser } = useAuth();
  const role = staffUser?.role ?? 'membre_bdm';

  const visibleItems = navItems.filter((item) => {
    if (role === 'superviseur') return true;
    if (item.gerantOnly && role === 'membre_bdm') return false;
    if (item.adminOnly && role === 'membre_bdm') return false;
    return true;
  });

  return (
    <aside className="w-64 min-h-screen bg-[var(--v-dark)] border-r-4 border-[var(--v-medium)] flex flex-col">
      {/* Logo */}
      <div className="px-6 pt-6 pb-4 border-b-2 border-[var(--v-medium)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--v-primary)] border-2 border-[var(--v-gold)] flex items-center justify-center">
            <span className="text-[var(--v-gold)] text-xl" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              忍
            </span>
          </div>
          <div>
            <h2
              className="text-[var(--v-gold)] text-lg font-medium leading-tight"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Bureau
            </h2>
            <p className="text-[var(--v-off-white)] text-xs opacity-75">des Missions</p>
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
                  ? 'bg-[var(--v-primary)] text-[var(--v-off-white)] shadow-lg'
                  : 'text-[var(--v-off-white)] hover:bg-[var(--v-medium)]/50'
              }`
            }
          >
            <item.icon size={20} />
            <span className="text-base">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Separateur decoratif */}
      <div className="mx-6 mb-4 h-px bg-gradient-to-r from-transparent via-[var(--v-gold)] to-transparent" />
    </aside>
  );
}

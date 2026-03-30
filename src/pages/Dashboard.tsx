import { useEffect, useState } from 'react';
import { Users, Target, Award, UserCheck, Clock, ArrowUpCircle, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Cycle } from '../types';

interface DashboardStats {
  totalAdherents: number;
  missionsCycle: number;
  pointsCycle: number;
  membresActifs: number;
}

interface ActivityItem {
  id: string;
  type: 'mission' | 'new_adherent' | 'evolution' | 'card';
  text: React.ReactNode;
  time: string;
  points?: number;
}

const STAT_CARDS = [
  { key: 'totalAdherents', label: 'Total adhérents', icon: Users },
  { key: 'missionsCycle', label: 'Missions ce cycle', icon: Target },
  { key: 'pointsCycle', label: 'Points distribués', icon: Award },
  { key: 'membresActifs', label: 'Membres BDM actifs', icon: UserCheck },
] as const;

const ACTIVITY_ICONS = {
  mission: Target,
  new_adherent: Users,
  evolution: ArrowUpCircle,
  card: CreditCard,
};

export default function Dashboard() {
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalAdherents: 0,
    missionsCycle: 0,
    pointsCycle: 0,
    membresActifs: 0,
  });
  const [activities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [cycleRes, adherentsRes, staffRes] = await Promise.all([
      supabase.from('cycles').select('*').eq('status', 'active').single(),
      supabase.from('adherents').select('id', { count: 'exact', head: true }),
      supabase.from('staff_users').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    const cycle = cycleRes.data;
    setActiveCycle(cycle);

    let missionCount = 0;
    let totalPoints = 0;

    if (cycle) {
      const missionsRes = await supabase
        .from('missions')
        .select('points')
        .eq('cycle_id', cycle.id);

      if (missionsRes.data) {
        missionCount = missionsRes.data.length;
        totalPoints = missionsRes.data.reduce((sum, m) => sum + m.points, 0);
      }
    }

    setStats({
      totalAdherents: adherentsRes.count ?? 0,
      missionsCycle: missionCount,
      pointsCycle: totalPoints,
      membresActifs: staffRes.count ?? 0,
    });
  }

  const cycleProgress = (() => {
    if (!activeCycle) return 0;
    const start = new Date(activeCycle.start_date).getTime();
    const end = new Date(activeCycle.end_date).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  })();

  const daysRemaining = (() => {
    if (!activeCycle) return 0;
    const end = new Date(activeCycle.end_date).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  })();

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div>
        <h1
          className="text-4xl font-medium text-[var(--v-primary)]"
          style={{ fontFamily: "'Noto Serif JP', serif" }}
        >
          Tableau de bord
        </h1>
        <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-secondary)] to-transparent rounded-full" />
      </div>

      {/* Banniere cycle actif */}
      <div className="bg-gradient-to-b from-[var(--v-cream)] to-[var(--v-light-beige)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />

        <div className="px-6 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2
                className="text-2xl font-medium text-[var(--v-dark)]"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Cycle Actif: {activeCycle?.name ?? 'Aucun cycle'}
              </h2>
              {activeCycle && (
                <p className="text-sm text-[var(--v-medium)] mt-1">
                  {formatDate(activeCycle.start_date)} - {formatDate(activeCycle.end_date)}
                </p>
              )}
            </div>
            {activeCycle && (
              <div className="bg-[var(--v-primary)] text-[var(--v-off-white)] px-4 py-2 rounded flex items-center gap-2 text-sm font-medium">
                <Clock size={14} />
                {daysRemaining} jours restants
              </div>
            )}
          </div>

          {activeCycle && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-[var(--v-medium)]">
                <span>Progression du cycle</span>
                <span>{cycleProgress}%</span>
              </div>
              <div className="w-full h-3 bg-[var(--v-off-white)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--v-primary)] rounded-full transition-all duration-500"
                  style={{ width: `${cycleProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="h-2 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => (
          <div
            key={stat.key}
            className="bg-[var(--v-cream)] border-2 border-[var(--v-medium)] rounded-[10px] shadow-lg px-6 py-6 flex items-start justify-between"
          >
            <div>
              <p className="text-sm text-[var(--v-medium)]">{stat.label}</p>
              <p className="text-3xl text-[var(--v-dark)] mt-1">
                {stats[stat.key].toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="w-[52px] h-[52px] bg-[var(--v-off-white)] border-2 border-[var(--v-medium)] rounded-md flex items-center justify-center">
              <stat.icon size={24} className="text-[var(--v-medium)]" />
            </div>
          </div>
        ))}
      </div>

      {/* Activite recente */}
      <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl">
        <div className="bg-[var(--v-light-beige)] border-b-2 border-[var(--v-medium)] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[var(--v-secondary)] rounded-full" />
            <h2
              className="text-2xl font-medium text-[var(--v-dark)]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Activité Récente
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {activities.length === 0 ? (
            <p className="text-[var(--v-medium)] text-sm text-center py-8">
              Aucune activité récente pour le moment.
            </p>
          ) : (
            activities.map((activity, index) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const isEven = index % 2 === 0;
              return (
                <div
                  key={activity.id}
                  className={`flex gap-4 px-4 py-4 rounded-md border-2 ${
                    isEven
                      ? 'bg-[var(--v-off-white)] border-[var(--v-light-beige)]'
                      : 'bg-[var(--v-light-beige)] border-[var(--v-off-white)]'
                  }`}
                >
                  <div className="w-9 h-9 bg-[var(--v-medium)] rounded-full flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-[var(--v-off-white)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--v-dark)]">{activity.text}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[var(--v-medium)]">{activity.time}</span>
                      {activity.points && (
                        <span className="bg-[#4A5D23] text-[var(--v-off-white)] text-xs font-medium px-2 py-0.5 rounded">
                          +{activity.points} pts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

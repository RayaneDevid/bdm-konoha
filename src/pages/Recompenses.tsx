import { useEffect, useState } from 'react';
import {
  Gift,
  Check,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Trophy,
  Coins,
  Sword,
  Shirt,
  Target,
  Medal,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { TIER_COLORS, TIER_LABELS, REWARD_TYPE_LABELS } from '../utils/constants';
import type { Cycle, CardTier, RewardType, CardMilestone } from '../types';

/* ------------------------------------------------------------------ */
/* Reward type → icon mapping                                         */
/* ------------------------------------------------------------------ */
const REWARD_ICONS: Record<RewardType, React.ComponentType<{ size?: number; className?: string }>> = {
  ryos: Coins,
  equipement: Sword,
  outfit: Shirt,
  kunais: Target,
  pieces_merite: Medal,
  autre: HelpCircle,
};

/* ------------------------------------------------------------------ */
/* Types locaux                                                       */
/* ------------------------------------------------------------------ */
interface NinjaRow {
  adherent_id: string;
  first_name: string;
  last_name: string;
  card_tier: CardTier;
  cycle_points: number;
  milestones: (CardMilestone & { claimed: boolean })[];
  all_claimed: boolean;
}

export default function Recompenses() {
  const { staffUser } = useAuth();

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [ninjas, setNinjas] = useState<NinjaRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'done'>('all');
  const [loading, setLoading] = useState(true);

  const canManage = staffUser && (staffUser.role === 'superviseur' || staffUser.role === 'gerant' || staffUser.role === 'co-gerant');

  /* ---- cycles ---- */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cycles')
        .select('*')
        .order('start_date', { ascending: false });
      if (data) {
        setCycles(data);
        const active = data.find((c) => c.status === 'active');
        setSelectedCycleId(active?.id ?? data[0]?.id ?? '');
      }
    })();
  }, []);

  /* ---- fetch ninjas for selected cycle ---- */
  useEffect(() => {
    if (selectedCycleId) fetchNinjas();
  }, [selectedCycleId]);

  async function fetchNinjas() {
    setLoading(true);

    // 1. Tous les adhérents ayant des points dans ce cycle
    const { data: pointsData } = await supabase
      .from('adherent_cycle_summary')
      .select('adherent_id, total_points')
      .eq('cycle_id', selectedCycleId);

    if (!pointsData || pointsData.length === 0) {
      setNinjas([]);
      setLoading(false);
      return;
    }

    const adherentIds = pointsData.map((p) => p.adherent_id);

    // 2. Info des adhérents
    const { data: adherentsData } = await supabase
      .from('adherents')
      .select('id, first_name, last_name, card_tier')
      .in('id', adherentIds);

    // 3. Milestones configurés
    const { data: milestonesData } = await supabase
      .from('card_milestones')
      .select('*')
      .order('pm_threshold', { ascending: true });

    // 4. Claimed rewards pour ce cycle
    const { data: claimedData } = await supabase
      .from('claimed_rewards')
      .select('adherent_id, milestone_id')
      .eq('cycle_id', selectedCycleId);

    const claimedSet = new Set(
      (claimedData ?? []).map((c) => `${c.adherent_id}::${c.milestone_id}`)
    );

    const allMilestones = (milestonesData ?? []) as CardMilestone[];

    const rows: NinjaRow[] = (adherentsData ?? []).map((a) => {
      const pts = pointsData.find((p) => p.adherent_id === a.id)?.total_points ?? 0;
      // Milestones de la carte de l'adhérent
      const tierMilestones = allMilestones.filter((m) => m.card_tier === a.card_tier);
      // Milestones atteints (points >= seuil)
      const reachable = tierMilestones
        .filter((m) => pts >= m.pm_threshold)
        .map((m) => ({
          ...m,
          claimed: claimedSet.has(`${a.id}::${m.id}`),
        }));

      return {
        adherent_id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        card_tier: a.card_tier as CardTier,
        cycle_points: pts,
        milestones: reachable,
        all_claimed: reachable.length > 0 && reachable.every((m) => m.claimed),
      };
    });

    // Trier : non-récompensés d'abord, puis par points décroissants
    rows.sort((a, b) => {
      if (a.all_claimed !== b.all_claimed) return a.all_claimed ? 1 : -1;
      return b.cycle_points - a.cycle_points;
    });

    setNinjas(rows);
    setLoading(false);
  }

  async function toggleClaimed(adherentId: string, milestoneId: string, currentlyClaimed: boolean) {
    if (!canManage || !staffUser) return;

    if (currentlyClaimed) {
      await supabase
        .from('claimed_rewards')
        .delete()
        .eq('adherent_id', adherentId)
        .eq('cycle_id', selectedCycleId)
        .eq('milestone_id', milestoneId);
    } else {
      await supabase.from('claimed_rewards').insert({
        adherent_id: adherentId,
        cycle_id: selectedCycleId,
        milestone_id: milestoneId,
        claimed_by: staffUser.id,
      });
    }
    fetchNinjas();
  }

  async function markAllClaimed(adherentId: string, milestones: (CardMilestone & { claimed: boolean })[]) {
    if (!canManage || !staffUser) return;

    const unclaimed = milestones.filter((m) => !m.claimed);
    if (unclaimed.length === 0) return;

    await supabase.from('claimed_rewards').insert(
      unclaimed.map((m) => ({
        adherent_id: adherentId,
        cycle_id: selectedCycleId,
        milestone_id: m.id,
        claimed_by: staffUser.id,
      }))
    );
    fetchNinjas();
  }

  /* ---- helpers ---- */
  const formatCycleLabel = (c: Cycle) => {
    const start = new Date(c.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const end = new Date(c.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${c.name} (${start} → ${end})`;
  };

  const filtered = ninjas.filter((n) => {
    const nameMatch = `${n.last_name} ${n.first_name}`.toLowerCase().includes(search.toLowerCase());
    if (!nameMatch) return false;
    if (filterStatus === 'pending') return !n.all_claimed && n.milestones.length > 0;
    if (filterStatus === 'done') return n.all_claimed;
    return true;
  });

  const stats = {
    total: ninjas.length,
    withRewards: ninjas.filter((n) => n.milestones.length > 0).length,
    allDone: ninjas.filter((n) => n.all_claimed && n.milestones.length > 0).length,
    pending: ninjas.filter((n) => !n.all_claimed && n.milestones.length > 0).length,
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-[#3E2723] border-4 border-[#5D4037] rounded-[10px] px-6 py-5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <Gift size={28} className="text-[#D4A017]" />
          <h1
            className="text-3xl font-medium text-[#D4A017]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            Récompenses
          </h1>
        </div>

        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded px-4 py-2 text-sm font-medium text-[#3E2723] w-80 focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {formatCycleLabel(c)}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Participants', value: stats.total, color: '#5D4037', icon: Trophy },
          { label: 'Éligibles', value: stats.withRewards, color: '#D4A017', icon: Gift },
          { label: 'En attente', value: stats.pending, color: '#C62828', icon: XCircle },
          { label: 'Récompensés', value: stats.allDone, color: '#4A5D23', icon: CheckCircle },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[#F5E6CA] border-2 border-[#5D4037] rounded-lg px-4 py-4 flex items-center gap-3"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: s.color }}
            >
              <s.icon size={20} className="text-[#FAF3E3]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#3E2723]">{s.value}</p>
              <p className="text-xs text-[#5D4037]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl">
        <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017] rounded-t-md" />

        <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-6 bg-[#C41E3A] rounded-full" />
              <h2
                className="text-2xl font-medium text-[#3E2723]"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Ninjas du Cycle
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5D4037]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un ninja..."
                  className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded pl-10 pr-4 py-2 text-sm text-[#3E2723] w-64 focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'done')}
                className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded px-3 py-2 text-sm text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
              >
                <option value="all">Tous</option>
                <option value="pending">En attente</option>
                <option value="done">Récompensés</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-2">
          {loading ? (
            <p className="text-[#5D4037] text-sm text-center py-8">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-[#5D4037] text-sm text-center py-8">
              {ninjas.length === 0 ? 'Aucun participant pour ce cycle.' : 'Aucun résultat.'}
            </p>
          ) : (
            filtered.map((ninja) => {
              const isExpanded = expandedId === ninja.adherent_id;
              const claimedCount = ninja.milestones.filter((m) => m.claimed).length;
              const totalMilestones = ninja.milestones.length;

              return (
                <div
                  key={ninja.adherent_id}
                  className={`border-2 border-[#5D4037] rounded-md ${
                    isExpanded ? 'bg-[#FAF3E3]' : 'bg-[#F5E6CA]'
                  }`}
                >
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : ninja.adherent_id)}
                    className="w-full px-4 py-4 flex items-center gap-4 cursor-pointer text-left"
                  >
                    {/* Name */}
                    <span className="text-[#3E2723] text-base font-medium w-[180px] shrink-0 truncate">
                      {ninja.last_name} {ninja.first_name}
                    </span>

                    {/* Card tier badge */}
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor: TIER_COLORS[ninja.card_tier],
                        color: ninja.card_tier === 'or' ? '#3E2723' : '#FAF3E3',
                      }}
                    >
                      {TIER_LABELS[ninja.card_tier]}
                    </span>

                    {/* Points */}
                    <span className="text-[#3E2723] text-sm w-[80px] shrink-0">
                      {ninja.cycle_points} PM
                    </span>

                    {/* Rewards progress */}
                    {totalMilestones > 0 ? (
                      <div className="flex items-center gap-2 w-[200px] shrink-0">
                        <span className="text-xs text-[#5D4037]">
                          {claimedCount}/{totalMilestones} récompenses
                        </span>
                        <div className="flex-1 h-2 bg-[#E8D5B7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round((claimedCount / totalMilestones) * 100)}%`,
                              backgroundColor: ninja.all_claimed ? '#4A5D23' : '#D4A017',
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[#5D4037]/60 w-[200px] shrink-0">
                        Aucun palier atteint
                      </span>
                    )}

                    {/* Status badge */}
                    {totalMilestones > 0 && (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded border shrink-0 ${
                          ninja.all_claimed
                            ? 'bg-[#4A5D23] text-[#FAF3E3] border-[#3E4F1A]'
                            : 'bg-[#C62828] text-[#FAF3E3] border-[#8B0000]'
                        }`}
                      >
                        {ninja.all_claimed ? 'Récompensé' : 'En attente'}
                      </span>
                    )}

                    <div className="ml-auto">
                      {isExpanded ? (
                        <ChevronUp size={20} className="text-[#5D4037]" />
                      ) : (
                        <ChevronDown size={20} className="text-[#5D4037]" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="bg-[#E8D5B7] border-t-2 border-[#5D4037] px-4 py-4">
                      {ninja.milestones.length === 0 ? (
                        <p className="text-sm text-[#5D4037] text-center py-4">
                          Ce ninja n'a atteint aucun palier de récompense pour ce cycle.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4
                              className="text-base font-medium text-[#8B0000]"
                              style={{ fontFamily: "'Noto Serif JP', serif" }}
                            >
                              Récompenses de {ninja.first_name} ({ninja.cycle_points} PM — Carte {TIER_LABELS[ninja.card_tier]})
                            </h4>
                            {canManage && !ninja.all_claimed && (
                              <button
                                type="button"
                                onClick={() => markAllClaimed(ninja.adherent_id, ninja.milestones)}
                                className="bg-[#D4A017] border border-[#8B0000] text-[#3E2723] text-xs font-medium px-3 py-1 rounded cursor-pointer hover:bg-[#C49515] transition-colors"
                              >
                                Tout marquer donné
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {ninja.milestones.map((m) => {
                              const Icon = REWARD_ICONS[m.reward_type] ?? HelpCircle;
                              return (
                                <div
                                  key={m.id}
                                  className={`bg-[#FAF3E3] border-2 rounded-md px-4 py-3 flex items-center gap-3 transition-all ${
                                    m.claimed
                                      ? 'border-[#4A5D23] opacity-70'
                                      : 'border-[#5D4037]'
                                  }`}
                                >
                                  {/* Checkbox */}
                                  <button
                                    type="button"
                                    onClick={() => toggleClaimed(ninja.adherent_id, m.id, m.claimed)}
                                    disabled={!canManage}
                                    className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                                      m.claimed
                                        ? 'bg-[#4A5D23] border-[#4A5D23]'
                                        : 'bg-[#FAF3E3] border-[#5D4037]'
                                    } ${canManage ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                  >
                                    {m.claimed && <Check size={14} className="text-white" />}
                                  </button>

                                  {/* Icon */}
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: TIER_COLORS[m.card_tier] }}
                                  >
                                    <Icon size={16} className={m.card_tier === 'or' ? 'text-[#3E2723]' : 'text-white'} />
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${m.claimed ? 'text-[#5D4037] line-through' : 'text-[#3E2723]'}`}>
                                      {m.reward_description}
                                    </p>
                                    <p className="text-xs text-[#5D4037]">
                                      {REWARD_TYPE_LABELS[m.reward_type]} — {m.pm_threshold} PM
                                    </p>
                                  </div>

                                  {/* Status icon */}
                                  {m.claimed ? (
                                    <CheckCircle size={18} className="text-[#4A5D23] shrink-0" />
                                  ) : (
                                    <XCircle size={18} className="text-[#C62828] shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

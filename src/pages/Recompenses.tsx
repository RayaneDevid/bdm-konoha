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

    // 2. Info des adhérents + tier cycle-spécifique + milestones + claimed
    const [adherentsRes, tiersRes, milestonesRes, claimedRes] = await Promise.all([
      supabase
        .from('adherents')
        .select('id, first_name, last_name')
        .in('id', adherentIds),
      supabase
        .from('adherent_card_tiers')
        .select('adherent_id, card_tier')
        .eq('cycle_id', selectedCycleId)
        .in('adherent_id', adherentIds),
      supabase
        .from('card_milestones')
        .select('*')
        .order('pm_threshold', { ascending: true }),
      supabase
        .from('claimed_rewards')
        .select('adherent_id, milestone_id')
        .eq('cycle_id', selectedCycleId),
    ]);

    const adherentsData = adherentsRes.data;
    const tierMap = new Map<string, CardTier>(
      (tiersRes.data ?? []).map((t) => [t.adherent_id, t.card_tier as CardTier])
    );
    const claimedSet = new Set(
      (claimedRes.data ?? []).map((c) => `${c.adherent_id}::${c.milestone_id}`)
    );

    const allMilestones = (milestonesRes.data ?? []) as CardMilestone[];

    const rows: NinjaRow[] = (adherentsData ?? []).map((a) => {
      const pts = pointsData.find((p) => p.adherent_id === a.id)?.total_points ?? 0;
      const cardTier = tierMap.get(a.id) ?? 'aucun' as CardTier;
      // Milestones de la carte de l'adhérent pour ce cycle
      const tierMilestones = allMilestones.filter((m) => m.card_tier === cardTier);
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
        card_tier: cardTier,
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
      <div className="bg-[var(--v-dark)] border-4 border-[var(--v-medium)] rounded-[10px] px-6 py-5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <Gift size={28} className="text-[var(--v-gold)]" />
          <h1
            className="text-3xl font-medium text-[var(--v-gold)]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            Récompenses
          </h1>
        </div>

        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="bg-[var(--v-off-white)] border-2 border-[var(--v-medium)] rounded px-4 py-2 text-sm font-medium text-[var(--v-dark)] w-80 focus:outline-none focus:ring-2 focus:ring-[var(--v-primary)]"
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
          { label: 'Participants', value: stats.total, color: 'var(--v-medium)', icon: Trophy },
          { label: 'Éligibles', value: stats.withRewards, color: 'var(--v-gold)', icon: Gift },
          { label: 'En attente', value: stats.pending, color: '#C62828', icon: XCircle },
          { label: 'Récompensés', value: stats.allDone, color: '#4A5D23', icon: CheckCircle },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[var(--v-cream)] border-2 border-[var(--v-medium)] rounded-lg px-4 py-4 flex items-center gap-3"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: s.color }}
            >
              <s.icon size={20} className="text-[var(--v-off-white)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--v-dark)]">{s.value}</p>
              <p className="text-xs text-[var(--v-medium)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl">
        <div className="h-2 bg-gradient-to-r from-[var(--v-gold)] via-[var(--v-primary)] to-[var(--v-gold)] rounded-t-md" />

        <div className="bg-[var(--v-light-beige)] border-b-2 border-[var(--v-medium)] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-6 bg-[var(--v-secondary)] rounded-full" />
              <h2
                className="text-2xl font-medium text-[var(--v-dark)]"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Ninjas du Cycle
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--v-medium)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un ninja..."
                  className="bg-[var(--v-off-white)] border-2 border-[var(--v-medium)] rounded pl-10 pr-4 py-2 text-sm text-[var(--v-dark)] w-64 focus:outline-none focus:ring-2 focus:ring-[var(--v-primary)]"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'done')}
                className="bg-[var(--v-off-white)] border-2 border-[var(--v-medium)] rounded px-3 py-2 text-sm text-[var(--v-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--v-primary)]"
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
            <p className="text-[var(--v-medium)] text-sm text-center py-8">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-[var(--v-medium)] text-sm text-center py-8">
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
                  className={`border-2 border-[var(--v-medium)] rounded-md ${
                    isExpanded ? 'bg-[var(--v-off-white)]' : 'bg-[var(--v-cream)]'
                  }`}
                >
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : ninja.adherent_id)}
                    className="w-full px-4 py-4 flex items-center gap-4 cursor-pointer text-left"
                  >
                    {/* Name */}
                    <span className="text-[var(--v-dark)] text-base font-medium w-[180px] shrink-0 truncate">
                      {ninja.last_name} {ninja.first_name}
                    </span>

                    {/* Card tier badge */}
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor: TIER_COLORS[ninja.card_tier],
                        color: ninja.card_tier === 'or' ? 'var(--v-dark)' : 'var(--v-off-white)',
                      }}
                    >
                      {TIER_LABELS[ninja.card_tier]}
                    </span>

                    {/* Points */}
                    <span className="text-[var(--v-dark)] text-sm w-[80px] shrink-0">
                      {ninja.cycle_points} PM
                    </span>

                    {/* Rewards progress */}
                    {totalMilestones > 0 ? (
                      <div className="flex items-center gap-2 w-[200px] shrink-0">
                        <span className="text-xs text-[var(--v-medium)]">
                          {claimedCount}/{totalMilestones} récompenses
                        </span>
                        <div className="flex-1 h-2 bg-[var(--v-light-beige)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round((claimedCount / totalMilestones) * 100)}%`,
                              backgroundColor: ninja.all_claimed ? '#4A5D23' : 'var(--v-gold)',
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--v-medium)]/60 w-[200px] shrink-0">
                        Aucun palier atteint
                      </span>
                    )}

                    {/* Status badge */}
                    {totalMilestones > 0 && (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded border shrink-0 ${
                          ninja.all_claimed
                            ? 'bg-[#4A5D23] text-[var(--v-off-white)] border-[#3E4F1A]'
                            : 'bg-[#C62828] text-[var(--v-off-white)] border-[var(--v-primary)]'
                        }`}
                      >
                        {ninja.all_claimed ? 'Récompensé' : 'En attente'}
                      </span>
                    )}

                    <div className="ml-auto">
                      {isExpanded ? (
                        <ChevronUp size={20} className="text-[var(--v-medium)]" />
                      ) : (
                        <ChevronDown size={20} className="text-[var(--v-medium)]" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="bg-[var(--v-light-beige)] border-t-2 border-[var(--v-medium)] px-4 py-4">
                      {ninja.milestones.length === 0 ? (
                        <p className="text-sm text-[var(--v-medium)] text-center py-4">
                          Ce ninja n'a atteint aucun palier de récompense pour ce cycle.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4
                              className="text-base font-medium text-[var(--v-primary)]"
                              style={{ fontFamily: "'Noto Serif JP', serif" }}
                            >
                              Récompenses de {ninja.first_name} ({ninja.cycle_points} PM — Carte {TIER_LABELS[ninja.card_tier]})
                            </h4>
                            {canManage && !ninja.all_claimed && (
                              <button
                                type="button"
                                onClick={() => markAllClaimed(ninja.adherent_id, ninja.milestones)}
                                className="bg-[var(--v-gold)] border border-[var(--v-primary)] text-[var(--v-dark)] text-xs font-medium px-3 py-1 rounded cursor-pointer hover:bg-[#C49515] transition-colors"
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
                                  className={`bg-[var(--v-off-white)] border-2 rounded-md px-4 py-3 flex items-center gap-3 transition-all ${
                                    m.claimed
                                      ? 'border-[#4A5D23] opacity-70'
                                      : 'border-[var(--v-medium)]'
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
                                        : 'bg-[var(--v-off-white)] border-[var(--v-medium)]'
                                    } ${canManage ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                  >
                                    {m.claimed && <Check size={14} className="text-white" />}
                                  </button>

                                  {/* Icon */}
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: TIER_COLORS[m.card_tier] }}
                                  >
                                    <Icon size={16} className={m.card_tier === 'or' ? 'text-[var(--v-dark)]' : 'text-white'} />
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${m.claimed ? 'text-[var(--v-medium)] line-through' : 'text-[var(--v-dark)]'}`}>
                                      {m.reward_description}
                                    </p>
                                    <p className="text-xs text-[var(--v-medium)]">
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

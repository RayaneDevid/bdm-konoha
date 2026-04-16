import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Scroll,
  Shield,
  Swords,
  ShoppingBasket,
  GraduationCap,
  Trophy,
  Ban,
  Coins,
  Sword,
  Shirt,
  Target,
  Medal,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  TIER_COLORS,
  TIER_LABELS,
  RANK_COLORS,
  MISSION_STATUS_COLORS,
  MISSION_STATUS_LABELS,
  VILLAGE_NAME,
} from '../utils/constants';
import type { CardTier, MissionRank, MissionType, MissionStatus, RewardType, Cycle } from '../types';

/* ------------------------------------------------------------------
   Types
------------------------------------------------------------------ */
interface AdherentPublic {
  id: string;
  first_name: string;
  last_name: string;
  card_tier: CardTier;
}

interface MissionRow {
  id: string;
  mission_date: string;
  mission_type: MissionType;
  rank: MissionRank;
  points: number;
  status: MissionStatus;
}

interface Milestone {
  id: string;
  card_tier: CardTier;
  pm_threshold: number;
  reward_type: RewardType;
  reward_description: string;
  sort_order: number;
}

/* ------------------------------------------------------------------
   Reward type → icon mapping
------------------------------------------------------------------ */
const REWARD_ICONS: Record<RewardType, React.ComponentType<{ size?: number; className?: string }>> = {
  ryos: Coins,
  equipement: Sword,
  outfit: Shirt,
  kunais: Target,
  pieces_merite: Medal,
  autre: HelpCircle,
};

/* ------------------------------------------------------------------
   Mission type icon
------------------------------------------------------------------ */
function MissionTypeIcon({ type }: { type: MissionType }) {
  if (type === 'recolte') return <ShoppingBasket size={16} className="text-[var(--v-medium)]" />;
  if (type === 'passation') return <GraduationCap size={16} className="text-[var(--v-medium)]" />;
  return <Swords size={16} className="text-[var(--v-medium)]" />;
}

/* ================================================================
   Main Component
================================================================ */
export default function AnnuaireAdherent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [adherent, setAdherent] = useState<AdherentPublic | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [cycleCardTier, setCycleCardTier] = useState<CardTier>('aucun');
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [totalMissions, setTotalMissions] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [cyclePoints, setCyclePoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missionsLoading, setMissionsLoading] = useState(false);

  /* ---- Réinitialiser les states cycle-spécifiques quand l'adhérent change */
  useEffect(() => {
    setCycleCardTier('aucun');
    setMissions([]);
    setMilestones([]);
    setCyclePoints(0);
    setSelectedCycleId('');
  }, [id]);

  /* ---- Load adherent + global stats + cycles -------------------- */
  useEffect(() => {
    if (!id) return;
    async function fetchBase() {
      setLoading(true);

      const [adherentRes, statsRes, cyclesRes] = await Promise.all([
        supabase
          .from('adherents')
          .select('id, first_name, last_name, card_tier')
          .eq('id', id)
          .single(),
        supabase
          .from('adherent_total_points')
          .select('total_missions, total_points')
          .eq('adherent_id', id)
          .single(),
        supabase
          .from('cycles')
          .select('*')
          .order('start_date', { ascending: false }),
      ]);

      if (adherentRes.data) setAdherent(adherentRes.data as AdherentPublic);
      if (statsRes.data) {
        setTotalMissions(Number(statsRes.data.total_missions) || 0);
        setTotalPoints(Number(statsRes.data.total_points) || 0);
      }

      if (cyclesRes.data && cyclesRes.data.length > 0) {
        setCycles(cyclesRes.data as Cycle[]);
        const cycleParam = searchParams.get('cycle');
        const today = new Date().toISOString().split('T')[0];
        const active = cyclesRes.data.find(
          (c) => c.start_date <= today && today <= c.end_date,
        );
        // Respecter le cycle venant de l'annuaire, sinon fallback sur le cycle actif
        const preferred = cycleParam && cyclesRes.data.find((c) => c.id === cycleParam)
          ? cycleParam
          : (active?.id ?? cyclesRes.data[0].id);
        setSelectedCycleId(preferred);
      }

      setLoading(false);
    }
    fetchBase();
  }, [id]);

  /* ---- Load missions + cycle points + milestones when cycle changes */
  useEffect(() => {
    if (!id || !selectedCycleId) return;
    async function fetchCycleData() {
      setMissionsLoading(true);

      // Adherent's missions this cycle (via mission_ninjas)
      const [cyclePointsRes, missionsNinjasRes, milestonesRes, tierRes] = await Promise.all([
        supabase
          .from('adherent_cycle_summary')
          .select('total_points')
          .eq('adherent_id', id)
          .eq('cycle_id', selectedCycleId)
          .single(),
        supabase
          .from('mission_ninjas')
          .select('mission_id')
          .eq('adherent_id', id),
        supabase
          .from('card_milestones')
          .select('id, card_tier, pm_threshold, reward_type, reward_description, sort_order')
          .eq('cycle_id', selectedCycleId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('adherent_card_tiers')
          .select('card_tier')
          .eq('adherent_id', id)
          .eq('cycle_id', selectedCycleId)
          .maybeSingle(),
      ]);

      setCycleCardTier((tierRes.data?.card_tier ?? 'aucun') as CardTier);

      setCyclePoints(Number(cyclePointsRes.data?.total_points) || 0);

      const ninjasMissionIds =
        (missionsNinjasRes.data ?? []).map((n) => n.mission_id);

      let missionRows: MissionRow[] = [];
      if (ninjasMissionIds.length > 0) {
        const { data: missionsData } = await supabase
          .from('missions')
          .select('id, mission_date, mission_type, rank, points, status')
          .eq('cycle_id', selectedCycleId)
          .in('id', ninjasMissionIds)
          .order('mission_date', { ascending: false });

        missionRows = (missionsData ?? []) as MissionRow[];
      }

      setMissions(missionRows);
      setMilestones((milestonesRes.data ?? []) as Milestone[]);
      setMissionsLoading(false);
    }
    fetchCycleData();
  }, [id, selectedCycleId]);

  /* ---- Handle not found ----------------------------------------- */
  if (!loading && !adherent) {
    return (
      <div className="min-h-screen bg-[var(--v-off-white)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[var(--v-primary)] text-xl" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            Ninja introuvable
          </p>
          <button
            onClick={() => navigate('/annuaire')}
            className="text-sm text-[var(--v-medium)] underline cursor-pointer hover:text-[var(--v-dark)]"
          >
            Retour à l'annuaire
          </button>
        </div>
      </div>
    );
  }

  const cycleMilestonesForTier = adherent
    ? milestones
        .filter((m: any) => m.card_tier === cycleCardTier)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

  const formatCycleLabel = (c: Cycle) => {
    const s = new Date(c.start_date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const e = new Date(c.end_date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${c.name} — ${s} au ${e}`;
  };

  return (
    <div className="min-h-screen bg-[var(--v-off-white)]">
      {/* Header */}
      <div className="bg-[var(--v-dark)] border-b-4 border-[var(--v-gold)] shadow-xl">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/annuaire')}
              className="flex items-center gap-2 text-[var(--v-gold)] text-sm hover:text-[var(--v-off-white)] transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              Annuaire
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--v-gold)] rounded-full border-2 border-[var(--v-off-white)] flex items-center justify-center">
                <Scroll size={16} className="text-[var(--v-dark)]" />
              </div>
              <span
                className="text-[var(--v-off-white)] text-base font-medium"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Bureau des Missions de {VILLAGE_NAME}
              </span>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 text-[var(--v-gold)] text-sm hover:text-[var(--v-off-white)] transition-colors cursor-pointer"
            >
              <Shield size={16} />
              Accès Staff
            </button>
          </div>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-16 text-[var(--v-medium)] text-sm">Chargement...</div>
        ) : adherent ? (
          <>
            {/* Profile header card */}
            <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
              <div
                className="h-2"
                style={{
                  background: `linear-gradient(to right, var(--v-primary), ${TIER_COLORS[cycleCardTier]}, var(--v-primary))`,
                }}
              />
              <div className="px-8 py-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Avatar circle */}
                  <div
                    className="w-20 h-20 rounded-full border-4 border-[var(--v-medium)] flex items-center justify-center text-2xl font-bold text-white shadow-lg shrink-0"
                    style={{ backgroundColor: TIER_COLORS[cycleCardTier] }}
                  >
                    {adherent.last_name[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2
                        className="text-3xl font-medium text-[var(--v-dark)]"
                        style={{ fontFamily: "'Noto Serif JP', serif" }}
                      >
                        {adherent.last_name} {adherent.first_name}
                      </h2>
                      <span
                        className="text-sm font-medium px-3 py-1 rounded-full border-2"
                        style={{
                          backgroundColor: TIER_COLORS[cycleCardTier] + '22',
                          borderColor: TIER_COLORS[cycleCardTier],
                          color: cycleCardTier === 'vip'
                            ? '#7B1FA2'
                            : cycleCardTier === 'or'
                            ? '#8B6914'
                            : cycleCardTier === 'argent'
                            ? '#5A5A5A'
                            : cycleCardTier === 'aucun'
                            ? '#616161'
                            : '#8B5E1D',
                        }}
                      >
                        Carte {TIER_LABELS[cycleCardTier]}
                      </span>
                    </div>
                  </div>

                  {/* Stats boxes */}
                  <div className="flex gap-4 shrink-0">
                    <div className="bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded-md px-5 py-3 text-center">
                      <p className="text-2xl font-bold text-[var(--v-dark)]">
                        {totalMissions.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-xs text-[var(--v-medium)] mt-0.5">Missions totales</p>
                    </div>
                    <div className="bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded-md px-5 py-3 text-center">
                      <p className="text-2xl font-bold text-[var(--v-gold)]">
                        {totalPoints.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-xs text-[var(--v-medium)] mt-0.5">Points totaux</p>
                    </div>
                    <div className="bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded-md px-5 py-3 text-center">
                      <p className="text-2xl font-bold text-[var(--v-primary)]">
                        {cyclePoints.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-xs text-[var(--v-medium)] mt-0.5">PM ce cycle</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cycle selector */}
            <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-md px-6 py-4">
              <div className="flex items-center gap-4">
                <span
                  className="text-sm font-bold text-[var(--v-medium)] whitespace-nowrap"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Cycle :
                </span>
                {cycles.length === 0 ? (
                  <span className="text-sm text-[var(--v-medium)]">Aucun cycle disponible</span>
                ) : (
                  <div className="relative max-w-xs flex-1">
                    <select
                      value={selectedCycleId}
                      onChange={(e) => setSelectedCycleId(e.target.value)}
                      className="w-full h-9 px-3 pr-8 bg-[var(--v-off-white)] border-2 border-[var(--v-medium)] rounded text-sm font-medium text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] appearance-none cursor-pointer"
                      style={{ fontFamily: "'Noto Serif JP', serif" }}
                    >
                      {cycles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatCycleLabel(c)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--v-medium)] pointer-events-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Reward track */}
            {cycleMilestonesForTier.length > 0 && (
              <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />
                <div className="bg-[var(--v-light-beige)] border-b-2 border-[var(--v-medium)] px-6 py-4">
                  <h3
                    className="text-xl font-medium text-[var(--v-dark)]"
                    style={{ fontFamily: "'Noto Serif JP', serif" }}
                  >
                    Progression — Carte {TIER_LABELS[cycleCardTier]}
                  </h3>
                </div>
                <div className="p-6 overflow-x-auto">
                  <div className="flex items-start gap-6 min-w-max pb-2">
                    {cycleMilestonesForTier.map((m, i) => {
                      const reached = cyclePoints >= m.pm_threshold;
                      const Icon = REWARD_ICONS[m.reward_type];
                      const connectorWidth = 96;

                      return (
                        <div key={m.id} className="flex flex-col items-center w-[120px] shrink-0">
                          {/* Node */}
                          <div className="relative mb-3">
                            <div
                              className={`relative z-10 w-14 h-14 rounded-full border-4 flex items-center justify-center shadow-lg transition-all ${
                                reached
                                  ? 'bg-gradient-to-b from-[var(--v-gold)] to-[var(--v-gold-dark)] border-[var(--v-medium)]'
                                  : 'bg-[var(--v-light-beige)] border-[var(--v-medium)]/50'
                              }`}
                            >
                              <Icon
                                size={26}
                                className={reached ? 'text-white' : 'text-[var(--v-medium)]/40'}
                              />
                            </div>

                            {/* Left connector */}
                            {i > 0 && (
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 h-1 rounded-full`}
                                style={{
                                  right: '100%',
                                  width: connectorWidth,
                                  background: reached
                                    ? 'linear-gradient(to right, var(--v-gold), var(--v-primary))'
                                    : 'var(--v-light-beige)',
                                }}
                              />
                            )}
                            {/* Right connector */}
                            {i < cycleMilestonesForTier.length - 1 && (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 h-1 bg-[var(--v-light-beige)] rounded-full"
                                style={{ left: '100%', width: connectorWidth }}
                              />
                            )}
                          </div>

                          {/* Threshold */}
                          <span
                            className={`text-sm font-bold ${reached ? 'text-[var(--v-gold)]' : 'text-[var(--v-medium)]/50'}`}
                          >
                            {m.pm_threshold} PM
                          </span>

                          {/* Description */}
                          <p
                            className={`text-[11px] text-center leading-tight mt-1 ${
                              reached ? 'text-[var(--v-dark)]' : 'text-[var(--v-medium)]/50'
                            }`}
                          >
                            {m.reward_description}
                          </p>

                          {/* Reached badge */}
                          {reached && (
                            <span className="mt-1 text-[10px] font-medium text-[#4A5D23] bg-[#4A5D23]/10 border border-[#4A5D23]/30 rounded-full px-2 py-0.5">
                              Atteint
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Mission history */}
            <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />
              <div className="bg-[var(--v-light-beige)] border-b-2 border-[var(--v-medium)] px-6 py-4 flex items-center justify-between">
                <h3
                  className="text-xl font-medium text-[var(--v-dark)]"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Missions du cycle
                </h3>
                {missions.length > 0 && (
                  <span className="text-sm font-medium text-[var(--v-medium)]">
                    {missions.length} mission{missions.length > 1 ? 's' : ''}
                    {' — '}
                    <span className="text-[var(--v-gold)] font-bold">
                      {missions
                        .filter((m) => m.status === 'reussi')
                        .reduce((s, m) => s + m.points, 0)
                        .toLocaleString('fr-FR')}{' '}
                      pts gagnés
                    </span>
                  </span>
                )}
              </div>

              <div className="p-6">
                {missionsLoading ? (
                  <p className="text-center text-sm text-[var(--v-medium)] py-8">Chargement...</p>
                ) : missions.length === 0 ? (
                  <p className="text-center text-sm text-[var(--v-medium)] italic py-8">
                    Aucune mission enregistrée pour ce cycle.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-[var(--v-medium)]">
                          <th className="text-left text-xs font-medium text-[var(--v-medium)] px-3 py-2 uppercase tracking-wide">
                            Date
                          </th>
                          <th className="text-left text-xs font-medium text-[var(--v-medium)] px-3 py-2 uppercase tracking-wide">
                            Type
                          </th>
                          <th className="text-left text-xs font-medium text-[var(--v-medium)] px-3 py-2 uppercase tracking-wide">
                            Rang
                          </th>
                          <th className="text-left text-xs font-medium text-[var(--v-medium)] px-3 py-2 uppercase tracking-wide">
                            Points
                          </th>
                          <th className="text-left text-xs font-medium text-[var(--v-medium)] px-3 py-2 uppercase tracking-wide">
                            Statut
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {missions.map((m) => (
                          <tr key={m.id} className="border-b border-[var(--v-light-beige)] hover:bg-[var(--v-light-beige)]/40 transition-colors">
                            <td className="px-3 py-3 text-sm text-[var(--v-medium)]">
                              {formatDate(m.mission_date)}
                            </td>
                            <td className="px-3 py-3">
                              <MissionTypeIcon type={m.mission_type} />
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className="inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold"
                                style={{ backgroundColor: RANK_COLORS[m.rank] }}
                              >
                                {m.rank}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm font-bold text-[var(--v-gold)]">
                              {m.status === 'echec' ? (
                                <span className="text-[#C62828]/60 line-through">
                                  {m.points} pts
                                </span>
                              ) : (
                                `+${m.points} pts`
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor: MISSION_STATUS_COLORS[m.status].bg + '22',
                                  color: MISSION_STATUS_COLORS[m.status].bg,
                                  border: `1px solid ${MISSION_STATUS_COLORS[m.status].bg}55`,
                                }}
                              >
                                {m.status === 'reussi' ? (
                                  <Trophy size={12} />
                                ) : (
                                  <Ban size={12} />
                                )}
                                {MISSION_STATUS_LABELS[m.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t-2 border-[var(--v-medium)]/30 py-6 text-center">
        <p className="text-xs text-[var(--v-medium)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          Bureau des Missions de {VILLAGE_NAME} — Annuaire public
        </p>
      </footer>
    </div>
  );
}

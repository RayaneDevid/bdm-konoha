import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  if (type === 'recolte') return <ShoppingBasket size={16} className="text-[#5D4037]" />;
  if (type === 'passation') return <GraduationCap size={16} className="text-[#5D4037]" />;
  return <Swords size={16} className="text-[#5D4037]" />;
}

/* ================================================================
   Main Component
================================================================ */
export default function AnnuaireAdherent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [adherent, setAdherent] = useState<AdherentPublic | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [totalMissions, setTotalMissions] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [cyclePoints, setCyclePoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missionsLoading, setMissionsLoading] = useState(false);

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
        const today = new Date().toISOString().split('T')[0];
        const active = cyclesRes.data.find(
          (c) => c.start_date <= today && today <= c.end_date,
        );
        setSelectedCycleId(active?.id ?? cyclesRes.data[0].id);
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
      const [cyclePointsRes, missionsNinjasRes, milestonesRes] = await Promise.all([
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
      ]);

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
      <div className="min-h-screen bg-[#FAF3E3] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[#8B0000] text-xl" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            Ninja introuvable
          </p>
          <button
            onClick={() => navigate('/annuaire')}
            className="text-sm text-[#5D4037] underline cursor-pointer hover:text-[#3E2723]"
          >
            Retour à l'annuaire
          </button>
        </div>
      </div>
    );
  }

  const cycleMilestonesForTier = adherent
    ? milestones
        .filter((m: any) => m.card_tier === adherent.card_tier)
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
    <div className="min-h-screen bg-[#FAF3E3]">
      {/* Header */}
      <div className="bg-[#3E2723] border-b-4 border-[#D4A017] shadow-xl">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/annuaire')}
              className="flex items-center gap-2 text-[#D4A017] text-sm hover:text-[#FAF3E3] transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              Annuaire
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#D4A017] rounded-full border-2 border-[#FAF3E3] flex items-center justify-center">
                <Scroll size={16} className="text-[#3E2723]" />
              </div>
              <span
                className="text-[#FAF3E3] text-base font-medium"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Bureau des Missions de Konoha
              </span>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 text-[#D4A017] text-sm hover:text-[#FAF3E3] transition-colors cursor-pointer"
            >
              <Shield size={16} />
              Accès Staff
            </button>
          </div>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-16 text-[#5D4037] text-sm">Chargement...</div>
        ) : adherent ? (
          <>
            {/* Profile header card */}
            <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
              <div
                className="h-2"
                style={{
                  background: `linear-gradient(to right, #8B0000, ${TIER_COLORS[adherent.card_tier]}, #8B0000)`,
                }}
              />
              <div className="px-8 py-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Avatar circle */}
                  <div
                    className="w-20 h-20 rounded-full border-4 border-[#5D4037] flex items-center justify-center text-2xl font-bold text-white shadow-lg shrink-0"
                    style={{ backgroundColor: TIER_COLORS[adherent.card_tier] }}
                  >
                    {adherent.last_name[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2
                        className="text-3xl font-medium text-[#3E2723]"
                        style={{ fontFamily: "'Noto Serif JP', serif" }}
                      >
                        {adherent.last_name} {adherent.first_name}
                      </h2>
                      <span
                        className="text-sm font-medium px-3 py-1 rounded-full border-2"
                        style={{
                          backgroundColor: TIER_COLORS[adherent.card_tier] + '22',
                          borderColor: TIER_COLORS[adherent.card_tier],
                          color: adherent.card_tier === 'vip'
                            ? '#7B1FA2'
                            : adherent.card_tier === 'or'
                            ? '#8B6914'
                            : adherent.card_tier === 'argent'
                            ? '#5A5A5A'
                            : '#8B5E1D',
                        }}
                      >
                        Carte {TIER_LABELS[adherent.card_tier]}
                      </span>
                    </div>
                  </div>

                  {/* Stats boxes */}
                  <div className="flex gap-4 shrink-0">
                    <div className="bg-[#FAF3E3] border border-[#5D4037] rounded-md px-5 py-3 text-center">
                      <p className="text-2xl font-bold text-[#3E2723]">
                        {totalMissions.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-xs text-[#5D4037] mt-0.5">Missions totales</p>
                    </div>
                    <div className="bg-[#FAF3E3] border border-[#5D4037] rounded-md px-5 py-3 text-center">
                      <p className="text-2xl font-bold text-[#D4A017]">
                        {totalPoints.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-xs text-[#5D4037] mt-0.5">Points totaux</p>
                    </div>
                    <div className="bg-[#FAF3E3] border border-[#5D4037] rounded-md px-5 py-3 text-center">
                      <p className="text-2xl font-bold text-[#8B0000]">
                        {cyclePoints.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-xs text-[#5D4037] mt-0.5">PM ce cycle</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cycle selector */}
            <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-md px-6 py-4">
              <div className="flex items-center gap-4">
                <span
                  className="text-sm font-bold text-[#5D4037] whitespace-nowrap"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Cycle :
                </span>
                {cycles.length === 0 ? (
                  <span className="text-sm text-[#5D4037]">Aucun cycle disponible</span>
                ) : (
                  <div className="relative max-w-xs flex-1">
                    <select
                      value={selectedCycleId}
                      onChange={(e) => setSelectedCycleId(e.target.value)}
                      className="w-full h-9 px-3 pr-8 bg-[#FAF3E3] border-2 border-[#5D4037] rounded text-sm font-medium text-[#3E2723] outline-none focus:border-[#D4A017] appearance-none cursor-pointer"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5D4037] pointer-events-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Reward track */}
            {cycleMilestonesForTier.length > 0 && (
              <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />
                <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-4">
                  <h3
                    className="text-xl font-medium text-[#3E2723]"
                    style={{ fontFamily: "'Noto Serif JP', serif" }}
                  >
                    Progression — Carte {TIER_LABELS[adherent.card_tier]}
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
                                  ? 'bg-gradient-to-b from-[#D4A017] to-[#B8860B] border-[#5D4037]'
                                  : 'bg-[#E8D5B7] border-[#5D4037]/50'
                              }`}
                            >
                              <Icon
                                size={26}
                                className={reached ? 'text-white' : 'text-[#5D4037]/40'}
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
                                    ? 'linear-gradient(to right, #D4A017, #8B0000)'
                                    : '#E8D5B7',
                                }}
                              />
                            )}
                            {/* Right connector */}
                            {i < cycleMilestonesForTier.length - 1 && (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 h-1 bg-[#E8D5B7] rounded-full"
                                style={{ left: '100%', width: connectorWidth }}
                              />
                            )}
                          </div>

                          {/* Threshold */}
                          <span
                            className={`text-sm font-bold ${reached ? 'text-[#D4A017]' : 'text-[#5D4037]/50'}`}
                          >
                            {m.pm_threshold} PM
                          </span>

                          {/* Description */}
                          <p
                            className={`text-[11px] text-center leading-tight mt-1 ${
                              reached ? 'text-[#3E2723]' : 'text-[#5D4037]/50'
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
            <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />
              <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-4 flex items-center justify-between">
                <h3
                  className="text-xl font-medium text-[#3E2723]"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Missions du cycle
                </h3>
                {missions.length > 0 && (
                  <span className="text-sm font-medium text-[#5D4037]">
                    {missions.length} mission{missions.length > 1 ? 's' : ''}
                    {' — '}
                    <span className="text-[#D4A017] font-bold">
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
                  <p className="text-center text-sm text-[#5D4037] py-8">Chargement...</p>
                ) : missions.length === 0 ? (
                  <p className="text-center text-sm text-[#5D4037] italic py-8">
                    Aucune mission enregistrée pour ce cycle.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-[#5D4037]">
                          <th className="text-left text-xs font-medium text-[#5D4037] px-3 py-2 uppercase tracking-wide">
                            Date
                          </th>
                          <th className="text-left text-xs font-medium text-[#5D4037] px-3 py-2 uppercase tracking-wide">
                            Type
                          </th>
                          <th className="text-left text-xs font-medium text-[#5D4037] px-3 py-2 uppercase tracking-wide">
                            Rang
                          </th>
                          <th className="text-left text-xs font-medium text-[#5D4037] px-3 py-2 uppercase tracking-wide">
                            Points
                          </th>
                          <th className="text-left text-xs font-medium text-[#5D4037] px-3 py-2 uppercase tracking-wide">
                            Statut
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {missions.map((m) => (
                          <tr key={m.id} className="border-b border-[#E8D5B7] hover:bg-[#E8D5B7]/40 transition-colors">
                            <td className="px-3 py-3 text-sm text-[#5D4037]">
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
                            <td className="px-3 py-3 text-sm font-bold text-[#D4A017]">
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
      <footer className="mt-12 border-t-2 border-[#5D4037]/30 py-6 text-center">
        <p className="text-xs text-[#5D4037]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          Bureau des Missions de Konoha — Annuaire public
        </p>
      </footer>
    </div>
  );
}

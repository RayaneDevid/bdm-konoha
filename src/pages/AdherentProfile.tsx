import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Target, Zap, Gift, Swords, ShoppingBasket, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TIER_COLORS, TIER_LABELS, RANK_COLORS } from '../utils/constants';
import type { Adherent, Cycle, CardEvolution, CardMilestone, CardTier, MissionRank } from '../types';

interface MissionRow {
  mission_id: string;
  mission_date: string;
  mission_type: string;
  passation_type: string | null;
  rank: MissionRank;
  points: number;
}

interface EvolutionRow extends CardEvolution {
  staff_name?: string;
}

export default function AdherentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [adherent, setAdherent] = useState<Adherent | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [totalMissions, setTotalMissions] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [cyclePoints, setCyclePoints] = useState(0);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [evolutions, setEvolutions] = useState<EvolutionRow[]>([]);
  const [milestones, setMilestones] = useState<CardMilestone[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  useEffect(() => {
    if (id && selectedCycleId) {
      fetchCycleMissions(selectedCycleId);
      fetchCyclePoints(selectedCycleId);
      fetchClaimedRewards(selectedCycleId);
    }
  }, [id, selectedCycleId]);

  async function fetchAll() {
    const [adherentRes, cyclesRes, totalRes, evolutionsRes] = await Promise.all([
      supabase.from('adherents').select('*').eq('id', id!).single(),
      supabase.from('cycles').select('*').order('start_date', { ascending: false }),
      supabase.from('adherent_total_points').select('*').eq('adherent_id', id!).single(),
      supabase
        .from('card_evolutions')
        .select('*, staff:evolved_by(first_name, last_name)')
        .eq('adherent_id', id!)
        .order('created_at', { ascending: false }),
    ]);

    const adh = adherentRes.data;
    setAdherent(adh);

    if (cyclesRes.data) {
      setCycles(cyclesRes.data);
      const today = new Date().toISOString().split('T')[0];
      const active = cyclesRes.data.find((c) => c.start_date <= today && today <= c.end_date);
      setActiveCycle(active ?? null);
      setSelectedCycleId(active?.id ?? cyclesRes.data[0]?.id ?? '');
    }

    setTotalMissions(totalRes.data?.total_missions ?? 0);
    setTotalPoints(totalRes.data?.total_points ?? 0);

    if (evolutionsRes.data) {
      setEvolutions(
        evolutionsRes.data.map((e: any) => ({
          ...e,
          staff_name: e.staff
            ? `${e.staff.first_name} ${e.staff.last_name}`
            : 'Inconnu',
        }))
      );
    }

    if (adh) {
      const milestonesRes = await supabase
        .from('card_milestones')
        .select('*')
        .eq('card_tier', adh.card_tier)
        .order('sort_order');
      if (milestonesRes.data) setMilestones(milestonesRes.data);
    }
  }

  async function fetchCycleMissions(cycleId: string) {
    // Missions où l'adhérent a gagné des points (ninja payé+réussi, exécutant/intervenant payé)
    const { data: pointsData } = await supabase
      .from('adherent_cycle_points')
      .select('mission_id, points')
      .eq('adherent_id', id!)
      .eq('cycle_id', cycleId);

    // Missions de passation où l'adhérent est ninja (pas de points mais à afficher quand même)
    const { data: ninjaMissionsData } = await supabase
      .from('mission_ninjas')
      .select('mission_id')
      .eq('adherent_id', id!);

    // Map mission_id → points gagnés
    const earnedByMissionId = new Map<string, number>();
    (pointsData ?? []).forEach((d: any) => {
      earnedByMissionId.set(d.mission_id, (earnedByMissionId.get(d.mission_id) ?? 0) + d.points);
    });

    // Union de tous les mission_ids connus
    const allMissionIds = new Set([
      ...(pointsData ?? []).map((d: any) => d.mission_id as string),
      ...(ninjaMissionsData ?? []).map((n: any) => n.mission_id as string),
    ]);

    if (allMissionIds.size === 0) {
      setMissions([]);
      return;
    }

    // Détails des missions, filtrés par cycle_id pour ne garder que celles du bon cycle
    const { data: missionDetails } = await supabase
      .from('missions')
      .select('id, mission_date, mission_type, passation_type, rank, points')
      .in('id', [...allMissionIds])
      .eq('cycle_id', cycleId)
      .order('mission_date', { ascending: false });

    setMissions(
      (missionDetails ?? []).map((m: any) => ({
        mission_id: m.id,
        mission_date: m.mission_date,
        mission_type: m.mission_type,
        passation_type: m.passation_type ?? null,
        rank: m.rank,
        points: earnedByMissionId.get(m.id) ?? 0,
      }))
    );
  }

  async function fetchCyclePoints(cycleId: string) {
    const { data } = await supabase
      .from('adherent_cycle_summary')
      .select('*')
      .eq('adherent_id', id!)
      .eq('cycle_id', cycleId)
      .single();

    setCyclePoints(data?.total_points ?? 0);
  }

  async function fetchClaimedRewards(cycleId: string) {
    const { data } = await supabase
      .from('claimed_rewards')
      .select('milestone_id')
      .eq('adherent_id', id!)
      .eq('cycle_id', cycleId);

    if (data) {
      setClaimedIds(new Set(data.map((d) => d.milestone_id)));
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const tierBadge = (tier: CardTier) => (
    <span
      className="px-3 py-1 rounded text-white text-sm font-medium"
      style={{ backgroundColor: TIER_COLORS[tier] }}
    >
      {TIER_LABELS[tier]}
    </span>
  );

  const rankBadge = (rank: MissionRank) => (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded text-white text-sm font-bold"
      style={{ backgroundColor: RANK_COLORS[rank] }}
    >
      {rank}
    </span>
  );

  if (!adherent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#8B0000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstInitial = adherent.last_name.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Retour + titre */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/adherents')}
          className="flex items-center gap-2 text-[#5D4037] hover:text-[#3E2723] transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">Retour</span>
        </button>
        <div>
          <h1
            className="text-4xl font-medium text-[#8B0000]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            Fiche Adherent
          </h1>
          <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[#8B0000] via-[#C41E3A] to-transparent rounded-full" />
        </div>
      </div>

      {/* En-tete profil */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />
        <div className="px-6 py-6 flex items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-[#3E2723] border-3 border-[#D4A017] flex items-center justify-center shrink-0">
            <span
              className="text-[#D4A017] text-3xl"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              {firstInitial}
            </span>
          </div>

          {/* Nom + badge */}
          <div className="flex-1">
            <h2
              className="text-2xl font-medium text-[#3E2723]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              {adherent.last_name} {adherent.first_name}
            </h2>
            <div className="mt-2">{tierBadge(adherent.card_tier)}</div>
          </div>

          {/* 3 boites stats */}
          <div className="flex gap-4">
            <div className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md px-5 py-3 text-center min-w-[120px]">
              <Target size={18} className="text-[#5D4037] mx-auto mb-1" />
              <p className="text-2xl font-medium text-[#3E2723]">{totalMissions}</p>
              <p className="text-xs text-[#5D4037]">Total missions</p>
            </div>
            <div className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md px-5 py-3 text-center min-w-[120px]">
              <Award size={18} className="text-[#5D4037] mx-auto mb-1" />
              <p className="text-2xl font-medium text-[#3E2723]">{totalPoints}</p>
              <p className="text-xs text-[#5D4037]">Total points</p>
            </div>
            <div className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md px-5 py-3 text-center min-w-[120px]">
              <Zap size={18} className="text-[#8B0000] mx-auto mb-1" />
              <p className="text-2xl font-medium text-[#8B0000]">{cyclePoints}</p>
              <p className="text-xs text-[#5D4037]">Points cycle actuel</p>
            </div>
          </div>
        </div>
        <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />
      </div>

      {/* Progression des recompenses (battle pass) */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl">
        <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[#D4A017] rounded-full" />
            <h2
              className="text-2xl font-medium text-[#3E2723]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Progression des Recompenses
            </h2>
            <span className="text-sm text-[#5D4037] ml-auto">
              {cyclePoints} PM — {activeCycle?.name ?? 'Aucun cycle'}
            </span>
          </div>
        </div>

        <div className="p-6 overflow-x-auto">
          {milestones.length === 0 ? (
            <p className="text-[#5D4037] text-sm text-center py-4">
              Aucun palier configure pour cette carte.
            </p>
          ) : (
            <div className="flex items-start gap-0 min-w-max">
              {milestones.map((ms, idx) => {
                const reached = cyclePoints >= ms.pm_threshold;
                const claimed = claimedIds.has(ms.id);
                const isLast = idx === milestones.length - 1;

                return (
                  <div key={ms.id} className="flex items-start">
                    {/* Node */}
                    <div className="flex flex-col items-center" style={{ width: 80 }}>
                      {/* Circle */}
                      <div
                        className={`w-10 h-10 rounded-full border-3 flex items-center justify-center ${
                          reached
                            ? 'bg-[#D4A017] border-[#B8860B] shadow-md'
                            : 'bg-[#E8D5B7] border-[#5D4037]'
                        }`}
                      >
                        <Gift
                          size={18}
                          className={reached ? 'text-white' : 'text-[#5D4037] opacity-50'}
                        />
                      </div>
                      {/* Threshold label */}
                      <span
                        className={`text-xs mt-2 font-medium ${
                          reached ? 'text-[#D4A017]' : 'text-[#5D4037]'
                        }`}
                      >
                        {ms.pm_threshold} PM
                      </span>
                      {/* Reward description */}
                      <span className="text-[10px] text-[#5D4037] text-center mt-1 leading-tight max-w-[75px]">
                        {ms.reward_description}
                      </span>
                      {/* Claimed indicator */}
                      {claimed && (
                        <span className="text-[10px] text-[#4A5D23] font-medium mt-1">
                          Reclame
                        </span>
                      )}
                    </div>

                    {/* Connector line */}
                    {!isLast && (
                      <div className="flex items-start pt-5">
                        <div
                          className={`h-1 w-8 rounded-full ${
                            reached ? 'bg-[#D4A017]' : 'bg-[#E8D5B7] border border-[#5D4037]/20'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Deux sections cote a cote */}
      <div className="grid grid-cols-2 gap-4">
        {/* Historique Missions */}
        <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl">
          <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-1 h-6 bg-[#C41E3A] rounded-full" />
                <h2
                  className="text-xl font-medium text-[#3E2723]"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Historique Missions
                </h2>
              </div>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded px-3 py-1.5 text-sm text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4">
            {missions.length === 0 ? (
              <p className="text-[#5D4037] text-sm text-center py-8">
                Aucune mission pour ce cycle.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#5D4037]">
                    <th className="text-left text-sm text-[#5D4037] py-2 px-2">Date</th>
                    <th className="text-left text-sm text-[#5D4037] py-2 px-2">Type</th>
                    <th className="text-center text-sm text-[#5D4037] py-2 px-2">Rang</th>
                    <th className="text-right text-sm text-[#5D4037] py-2 px-2">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {missions.map((m, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-[#E8D5B7] ${
                        idx % 2 === 0 ? 'bg-[#FAF3E3]' : 'bg-[#E8D5B7]'
                      }`}
                    >
                      <td className="text-sm text-[#3E2723] py-3 px-2">
                        {formatDate(m.mission_date)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5">
                          {m.mission_type === 'ninja' ? (
                            <Swords size={15} className="text-[#5D4037] shrink-0" />
                          ) : m.mission_type === 'recolte' ? (
                            <ShoppingBasket size={15} className="text-[#5D4037] shrink-0" />
                          ) : (
                            <GraduationCap size={15} className="text-[#5D4037] shrink-0" />
                          )}
                          <span className="text-sm text-[#3E2723]">
                            {m.mission_type === 'ninja'
                              ? 'Ninja'
                              : m.mission_type === 'recolte'
                              ? 'Récolte'
                              : 'Passation'}
                          </span>
                          {m.mission_type === 'passation' && m.passation_type && (
                            <span className="text-[10px] font-medium text-[#5D4037] bg-[#E8D5B7] border border-[#5D4037]/40 px-1.5 py-0.5 rounded leading-none">
                              {m.passation_type === 'chunin' ? 'Chunin' : 'Genin conf.'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">{rankBadge(m.rank)}</td>
                      <td className="text-sm py-3 px-2 text-right font-medium">
                        {m.points > 0 ? (
                          <span className="text-[#3E2723]">+{m.points}</span>
                        ) : (
                          <span className="text-[#5D4037] italic text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Historique Evolution Carte */}
        <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl">
          <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-1 h-6 bg-[#D4A017] rounded-full" />
              <h2
                className="text-xl font-medium text-[#3E2723]"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Evolution de Carte
              </h2>
            </div>
          </div>

          <div className="p-6">
            {evolutions.length === 0 ? (
              <p className="text-[#5D4037] text-sm text-center py-8">
                Aucune evolution pour le moment.
              </p>
            ) : (
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-[#D4A017]" />

                <div className="space-y-6">
                  {evolutions.map((evo) => (
                    <div key={evo.id} className="flex gap-4 relative">
                      {/* Timeline dot */}
                      <div className="w-8 h-8 rounded-full bg-[#D4A017] border-2 border-[#B8860B] flex items-center justify-center shrink-0 z-10">
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-[#FAF3E3] border-2 border-[#E8D5B7] rounded-md px-4 py-3">
                        <p className="text-xs text-[#5D4037] mb-2">
                          {formatDate(evo.created_at)}
                        </p>
                        <div className="flex items-center gap-2 mb-2">
                          {tierBadge(evo.old_tier)}
                          <span className="text-[#5D4037]">→</span>
                          {tierBadge(evo.new_tier)}
                        </div>
                        <p className="text-xs text-[#5D4037]">
                          Par <span className="font-medium text-[#3E2723]">{evo.staff_name}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, ArrowUp, ChevronDown, X, Trash2, Check, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { TIER_LABELS } from '../utils/constants';
import type { Adherent, CardTier, MissionType, MissionRank, MissionStatus } from '../types';

const TIER_BADGE_STYLES: Record<CardTier, string> = {
  aucun: 'bg-[#9E9E9E] border-[#757575] text-white',
  bronze: 'bg-[#CD7F32] border-[#8B4513] text-white',
  argent: 'bg-[#A8A9AD] border-[#808080] text-[var(--v-dark)]',
  or: 'bg-[var(--v-gold)] border-[var(--v-gold-dark)] text-[var(--v-dark)]',
  vip: 'bg-[#7B1FA2] border-[#4A148C] text-white',
};

interface AdherentWithStaff extends Adherent {
  staff_users: { first_name: string; last_name: string } | null;
  cycle_points?: number;
}

type UnpaidRole = 'ninja' | 'executant' | 'intervenant';

interface UnpaidMissionItem {
  row_id: string;
  mission_id: string;
  mission_date: string;
  mission_type: MissionType;
  rank: MissionRank;
  status: MissionStatus;
  mission_link: string;
  cycle_name: string;
  role: UnpaidRole;
}

const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  ninja: 'Ninja',
  recolte: 'Récolte',
  passation: 'Passation',
};

export default function Adherents() {
  const navigate = useNavigate();
  const { staffUser } = useAuth();
  const [adherents, setAdherents] = useState<AdherentWithStaff[]>([]);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState<CardTier | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [unpaidCountMap, setUnpaidCountMap] = useState<Record<string, number>>({});
  const [unpaidTarget, setUnpaidTarget] = useState<AdherentWithStaff | null>(null);
  const [unpaidMissions, setUnpaidMissions] = useState<UnpaidMissionItem[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);
  const [markingPaidRowId, setMarkingPaidRowId] = useState<string | null>(null);

  const canManage = staffUser && (staffUser.role === 'superviseur' || staffUser.role === 'gerant' || staffUser.role === 'co-gerant');

  // Form state
  const [formNom, setFormNom] = useState('');
  const [formPrenom, setFormPrenom] = useState('');
  const [formTier, setFormTier] = useState<CardTier>('bronze');
  const [submitting, setSubmitting] = useState(false);

  // Evolution modal
  const [evolTarget, setEvolTarget] = useState<AdherentWithStaff | null>(null);
  const [evolNewTier, setEvolNewTier] = useState<CardTier>('or');

  useEffect(() => {
    fetchAdherents();
  }, []);

  async function fetchAdherents() {
    const { data, error } = await supabase
      .from('adherents')
      .select('*, staff_users!distributed_by(first_name, last_name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement adhérents:', error);
    }

    if (data) {
      // Fetch cycle points for each adherent
      const today = new Date().toISOString().split('T')[0];
      const cycleRes = await supabase
        .from('cycles')
        .select('id')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      let pointsMap: Record<string, number> = {};

      if (cycleRes.data) {
        const { data: pointsData } = await supabase
          .from('adherent_cycle_summary')
          .select('adherent_id, total_points')
          .eq('cycle_id', cycleRes.data.id);

        if (pointsData) {
          pointsMap = Object.fromEntries(pointsData.map((p) => [p.adherent_id, Number(p.total_points)]));
        }
      }

      const mappedAdherents = data.map((a) => ({ ...a, cycle_points: pointsMap[a.id] ?? 0 }));
      setAdherents(mappedAdherents);

      // Compte les missions non payées pour tous les rôles (ninja, exécutant, intervenant).
      const adherentIds = mappedAdherents.map((a) => a.id);
      let unpaidCounts: Record<string, number> = {};

      if (adherentIds.length > 0) {
        const [ninjaRes, executorRes, intervenantRes] = await Promise.all([
          supabase
            .from('mission_ninjas')
            .select('adherent_id, mission:missions!inner(status, mission_type)')
            .eq('is_paid', false)
            .in('adherent_id', adherentIds),
          supabase
            .from('missions')
            .select('executor_adherent_id, mission_type')
            .eq('executor_is_paid', false)
            .in('mission_type', ['ninja', 'passation'])
            .in('executor_adherent_id', adherentIds),
          supabase
            .from('mission_intervenants')
            .select('adherent_id, mission:missions!inner(mission_type)')
            .eq('is_paid', false)
            .eq('is_external', false)
            .in('adherent_id', adherentIds),
        ]);

        for (const row of ninjaRes.data ?? []) {
          const mission = Array.isArray((row as any).mission) ? (row as any).mission[0] : (row as any).mission;
          if (!mission) continue;
          if (mission.status !== 'reussi' || mission.mission_type === 'passation') continue;
          unpaidCounts[row.adherent_id] = (unpaidCounts[row.adherent_id] ?? 0) + 1;
        }

        for (const row of executorRes.data ?? []) {
          if (!row.executor_adherent_id) continue;
          unpaidCounts[row.executor_adherent_id] = (unpaidCounts[row.executor_adherent_id] ?? 0) + 1;
        }

        for (const row of intervenantRes.data ?? []) {
          if (!row.adherent_id) continue;
          const mission = Array.isArray((row as any).mission) ? (row as any).mission[0] : (row as any).mission;
          if (!mission || !['ninja', 'passation'].includes(mission.mission_type)) continue;
          unpaidCounts[row.adherent_id] = (unpaidCounts[row.adherent_id] ?? 0) + 1;
        }
      }

      setUnpaidCountMap(unpaidCounts);
    }
    setLoading(false);
  }

  async function openUnpaidMissions(a: AdherentWithStaff) {
    setUnpaidTarget(a);
    setLoadingUnpaid(true);
    setUnpaidMissions([]);

    const [ninjaRes, executorRes, intervenantRes] = await Promise.all([
      supabase
        .from('mission_ninjas')
        .select('id, mission_id, mission:missions!inner(id, mission_date, mission_type, rank, status, mission_link, cycles(name))')
        .eq('adherent_id', a.id)
        .eq('is_paid', false),
      supabase
        .from('missions')
        .select('id, mission_date, mission_type, rank, status, mission_link, cycles(name)')
        .eq('executor_adherent_id', a.id)
        .eq('executor_is_paid', false)
        .in('mission_type', ['ninja', 'passation']),
      supabase
        .from('mission_intervenants')
        .select('id, mission:missions!inner(id, mission_date, mission_type, rank, status, mission_link, cycles(name))')
        .eq('adherent_id', a.id)
        .eq('is_paid', false)
        .eq('is_external', false),
    ]);

    const items: UnpaidMissionItem[] = [];

    // Ninjas
    for (const row of ninjaRes.data ?? []) {
      const mission = Array.isArray((row as any).mission) ? (row as any).mission[0] : (row as any).mission;
      if (!mission) continue;
      if (mission.status !== 'reussi' || mission.mission_type === 'passation') continue;
      const cycleRel = Array.isArray(mission.cycles) ? mission.cycles[0] : mission.cycles;
      items.push({
        row_id: row.id,
        mission_id: mission.id,
        mission_date: mission.mission_date,
        mission_type: mission.mission_type,
        rank: mission.rank,
        status: mission.status,
        mission_link: mission.mission_link,
        cycle_name: cycleRel?.name ?? 'Cycle inconnu',
        role: 'ninja',
      });
    }

    // Exécutants
    for (const row of executorRes.data ?? []) {
      const cycleRel = Array.isArray((row as any).cycles) ? (row as any).cycles[0] : (row as any).cycles;
      items.push({
        row_id: row.id,
        mission_id: row.id,
        mission_date: row.mission_date,
        mission_type: row.mission_type as MissionType,
        rank: row.rank as MissionRank,
        status: row.status as MissionStatus,
        mission_link: row.mission_link,
        cycle_name: cycleRel?.name ?? 'Cycle inconnu',
        role: 'executant',
      });
    }

    // Intervenants
    for (const row of intervenantRes.data ?? []) {
      const mission = Array.isArray((row as any).mission) ? (row as any).mission[0] : (row as any).mission;
      if (!mission) continue;
      if (!['ninja', 'passation'].includes(mission.mission_type)) continue;
      const cycleRel = Array.isArray(mission.cycles) ? mission.cycles[0] : mission.cycles;
      items.push({
        row_id: row.id,
        mission_id: mission.id,
        mission_date: mission.mission_date,
        mission_type: mission.mission_type,
        rank: mission.rank,
        status: mission.status,
        mission_link: mission.mission_link,
        cycle_name: cycleRel?.name ?? 'Cycle inconnu',
        role: 'intervenant',
      });
    }

    items.sort((a, b) => b.mission_date.localeCompare(a.mission_date));
    setUnpaidMissions(items);
    setLoadingUnpaid(false);
  }

  async function markMissionAsPaid(item: UnpaidMissionItem) {
    if (!canManage) return;

    setMarkingPaidRowId(item.row_id);
    let error: any = null;

    if (item.role === 'ninja') {
      ({ error } = await supabase
        .from('mission_ninjas')
        .update({ is_paid: true, paid_marked_by: staffUser?.id ?? null })
        .eq('id', item.row_id));
    } else if (item.role === 'executant') {
      ({ error } = await supabase
        .from('missions')
        .update({ executor_is_paid: true, executor_paid_marked_by: staffUser?.id ?? null })
        .eq('id', item.row_id));
    } else if (item.role === 'intervenant') {
      ({ error } = await supabase
        .from('mission_intervenants')
        .update({ is_paid: true, paid_marked_by: staffUser?.id ?? null })
        .eq('id', item.row_id));
    }

    if (error) {
      console.error('Erreur marquage mission payée:', error);
      alert(`Erreur: ${error.message}`);
      setMarkingPaidRowId(null);
      return;
    }

    setUnpaidMissions((prev) => prev.filter((m) => m.row_id !== item.row_id));
    if (unpaidTarget) {
      setUnpaidCountMap((prev) => ({
        ...prev,
        [unpaidTarget.id]: Math.max((prev[unpaidTarget.id] ?? 1) - 1, 0),
      }));
    }

    setMarkingPaidRowId(null);
    fetchAdherents();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formNom.trim() || !formPrenom.trim() || !canManage) return;
    setSubmitting(true);

    const { error } = await supabase.from('adherents').insert({
      last_name: formNom.trim(),
      first_name: formPrenom.trim(),
      card_tier: formTier,
      distributed_by: staffUser?.id ?? null,
    });

    if (error) {
      console.error('Erreur ajout adherent:', error);
      alert(`Erreur: ${error.message}`);
    }

    setFormNom('');
    setFormPrenom('');
    setFormTier('bronze');
    setSubmitting(false);
    fetchAdherents();
  }

  async function handleEvolution() {
    if (!evolTarget || !canManage) return;

    await supabase.from('card_evolutions').insert({
      adherent_id: evolTarget.id,
      old_tier: evolTarget.card_tier,
      new_tier: evolNewTier,
      evolved_by: staffUser?.id ?? null,
    });

    await supabase
      .from('adherents')
      .update({ card_tier: evolNewTier })
      .eq('id', evolTarget.id);

    setEvolTarget(null);
    fetchAdherents();
  }

  const getUpgradeTiers = (current: CardTier): CardTier[] => {
    if (current === 'aucun') return ['bronze', 'argent', 'or', 'vip'];
    if (current === 'bronze') return ['argent', 'or', 'vip'];
    if (current === 'argent') return ['or', 'vip'];
    if (current === 'or') return ['vip'];
    return [];
  };

  const filtered = adherents.filter((a) => {
    const matchSearch =
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchTier = filterTier === 'all' || a.card_tier === filterTier;
    return matchSearch && matchTier;
  });

  const staffName = (a: AdherentWithStaff) =>
    a.staff_users ? `${a.staff_users.first_name} ${a.staff_users.last_name}` : '—';

  async function handleDelete(id: string, name: string) {
    if (!canManage) return;
    if (!confirm(`Supprimer l'adhérent "${name}" ? Cette action est irréversible.`)) return;
    setDeleting(id);
    await supabase.from('adherents').update({ is_active: false }).eq('id', id);
    setDeleting(null);
    fetchAdherents();
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div>
        <h1 className="text-4xl font-medium text-[var(--v-primary)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          Adhérents
        </h1>
        <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-secondary)] to-transparent rounded-full" />
      </div>

      {/* Formulaire Nouvel Adherent */}
      {canManage && (
      <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[var(--v-gold)] via-[var(--v-primary)] to-[var(--v-gold)]" />
        <div className="bg-[var(--v-light-beige)] border-b-2 border-[var(--v-medium)] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[var(--v-secondary)] rounded-full" />
            <h2 className="text-2xl font-medium text-[var(--v-dark)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              Nouvel Adhérent
            </h2>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--v-dark)]">Prénom</label>
              <input
                type="text"
                placeholder="Saki"
                value={formPrenom}
                onChange={(e) => setFormPrenom(e.target.value)}
                required
                className="w-full h-9 px-3 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--v-dark)]">Nom</label>
              <input
                type="text"
                placeholder="Sato"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                required
                className="w-full h-9 px-3 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--v-dark)]">Niveau de carte</label>
              <div className="relative">
                <select
                  value={formTier}
                  onChange={(e) => setFormTier(e.target.value as CardTier)}
                  className="w-full h-9 px-3 pr-8 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] appearance-none cursor-pointer"
                >
                  <option value="aucun">Aucun</option>
                  <option value="bronze">Bronze</option>
                  <option value="argent">Argent</option>
                  <option value="or">Or</option>
                  <option value="vip">VIP</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--v-medium)] pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--v-dark)]">Distribué par</label>
              <div className="w-full h-9 px-3 bg-[var(--v-light-beige)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-medium)] flex items-center">
                {staffUser ? `${staffUser.first_name} ${staffUser.last_name}` : '—'}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-9 px-8 bg-[var(--v-medium)] border-2 border-[var(--v-dark)] rounded text-[var(--v-off-white)] text-sm font-medium shadow-lg hover:bg-[var(--v-medium-dark)] transition-colors cursor-pointer disabled:opacity-60"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
      )}

      {/* Barre de recherche + filtre */}
      <div className="bg-[var(--v-cream)] border-2 border-[var(--v-medium)] rounded-[10px] shadow-lg px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--v-medium)]" />
            <input
              type="text"
              placeholder="Rechercher un adhérent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-10 pr-3 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] placeholder-[var(--v-medium)] outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
            />
          </div>
          <Filter size={20} className="text-[var(--v-medium)]" />
          <div className="relative">
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value as CardTier | 'all')}
              className="h-9 px-3 pr-8 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm font-medium text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] appearance-none cursor-pointer"
            >
              <option value="all">Tous les niveaux</option>
              <option value="aucun">Aucun</option>
              <option value="bronze">Bronze</option>
              <option value="argent">Argent</option>
              <option value="or">Or</option>
              <option value="vip">VIP</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--v-medium)] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tableau des adherents */}
      <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />
        <div className="bg-[var(--v-light-beige)] border-b-2 border-[var(--v-medium)] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[var(--v-secondary)] rounded-full" />
            <h2 className="text-2xl font-medium text-[var(--v-dark)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              Liste des Adhérents ({filtered.length})
            </h2>
          </div>
        </div>

        <div className="p-6">
          <div className="border-2 border-[var(--v-medium)] rounded-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--v-light-beige)] border-b border-[var(--v-medium)]">
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[var(--v-dark)]">Prénom & Nom</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[var(--v-dark)]">Niveau de carte</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[var(--v-dark)]">Distribué par</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[var(--v-dark)]">Date inscription</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[var(--v-dark)]">Points Missions</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[var(--v-dark)]">Missions non payées</th>
                  <th className="text-right px-3 py-2.5 text-sm font-medium text-[var(--v-dark)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[var(--v-medium)] text-sm">Chargement...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[var(--v-medium)] text-sm">Aucun adhérent trouvé.</td>
                  </tr>
                ) : (
                  filtered.map((a, i) => {
                    const upgrades = getUpgradeTiers(a.card_tier);
                    const unpaidCount = unpaidCountMap[a.id] ?? 0;
                    return (
                      <tr
                        key={a.id}
                        className={`border-b border-[var(--v-light-beige)] ${i % 2 === 0 ? 'bg-[var(--v-off-white)]' : 'bg-[var(--v-cream)]'}`}
                      >
                        <td className="px-3 py-3 text-sm text-[var(--v-dark)]">
                          {a.first_name} {a.last_name}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded border-2 text-xs font-medium ${TIER_BADGE_STYLES[a.card_tier]}`}>
                            {TIER_LABELS[a.card_tier]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-[var(--v-medium)]">{staffName(a)}</td>
                        <td className="px-3 py-3 text-sm text-[var(--v-medium)]">{formatDate(a.created_at)}</td>
                        <td className="px-3 py-3 text-sm text-[var(--v-dark)]">
                          {(a.cycle_points ?? 0).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => openUnpaidMissions(a)}
                            className={`h-8 px-3 border rounded text-xs font-medium transition-colors cursor-pointer ${
                              unpaidCount > 0
                                ? 'bg-[#C62828] border-[var(--v-primary)] text-white hover:bg-[#B71C1C]'
                                : 'bg-[var(--v-off-white)] border-[var(--v-medium)] text-[var(--v-medium)] hover:bg-[var(--v-light-beige)]'
                            }`}
                            title="Voir les missions ninja non payées"
                          >
                            {unpaidCount > 0 ? `${unpaidCount} à payer` : 'Aucune'}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/adherents/${a.id}`)}
                              className="w-[38px] h-8 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded flex items-center justify-center hover:bg-[var(--v-light-beige)] transition-colors cursor-pointer"
                              title="Voir fiche"
                            >
                              <Eye size={16} className="text-[var(--v-medium)]" />
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={() => {
                                    if (upgrades.length > 0) {
                                      setEvolTarget(a);
                                      setEvolNewTier(upgrades[0]);
                                    }
                                  }}
                                  disabled={upgrades.length === 0}
                                  className={`w-[38px] h-8 bg-[var(--v-gold)] border border-[var(--v-primary)] rounded flex items-center justify-center transition-colors cursor-pointer ${upgrades.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#C49000]'
                                    }`}
                                  title="Évolution"
                                >
                                  <ArrowUp size={16} className="text-white" />
                                </button>
                                <button
                                  onClick={() => handleDelete(a.id, `${a.first_name} ${a.last_name}`)}
                                  disabled={deleting === a.id}
                                  className="w-[38px] h-8 bg-[#C62828] border border-[var(--v-primary)] rounded flex items-center justify-center hover:bg-[#B71C1C] transition-colors cursor-pointer disabled:opacity-50"
                                  title="Supprimer"
                                >
                                  <Trash2 size={16} className="text-white" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modale evolution */}
      {evolTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[var(--v-gold)] via-[var(--v-primary)] to-[var(--v-gold)]" />
            <div className="px-6 pt-5 flex items-start justify-between">
              <h3 className="text-2xl font-medium text-[var(--v-primary)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                Évolution de Carte
              </h3>
              <button onClick={() => setEvolTarget(null)} className="text-[var(--v-medium)] hover:text-[var(--v-dark)] cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-6 pt-4 space-y-5">
              <div className="text-center">
                <p className="text-xs text-[var(--v-medium)]">Adhérent</p>
                <p className="text-base font-medium text-[var(--v-dark)]">{evolTarget.first_name} {evolTarget.last_name}</p>
              </div>

              {/* Niveau actuel -> Nouveau niveau */}
              <div className="flex items-center justify-center gap-6">
                <div className="text-center space-y-2">
                  <p className="text-xs text-[var(--v-medium)]">Niveau actuel</p>
                  <span className={`inline-flex items-center justify-center px-4 py-1.5 rounded border-2 text-sm font-medium ${TIER_BADGE_STYLES[evolTarget.card_tier]}`}>
                    {TIER_LABELS[evolTarget.card_tier]}
                  </span>
                </div>
                <ArrowUp size={24} className="text-[var(--v-gold)] mt-4" />
                <div className="text-center space-y-2">
                  <p className="text-xs text-[var(--v-medium)]">Nouveau niveau</p>
                  <div className="relative">
                    <select
                      value={evolNewTier}
                      onChange={(e) => setEvolNewTier(e.target.value as CardTier)}
                      className="h-9 px-3 pr-8 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none appearance-none cursor-pointer"
                    >
                      {getUpgradeTiers(evolTarget.card_tier).map((t) => (
                        <option key={t} value={t}>{TIER_LABELS[t]}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--v-medium)] pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--v-dark)]">Évolution réalisée par</label>
                <div className="w-full h-9 px-3 bg-[var(--v-light-beige)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-medium)] flex items-center">
                  {staffUser ? `${staffUser.first_name} ${staffUser.last_name}` : '—'}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEvolTarget(null)}
                  className="flex-1 h-9 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] hover:bg-[var(--v-light-beige)] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleEvolution}
                  className="flex-1 h-9 bg-[var(--v-primary)] border border-[#6B0000] rounded text-sm text-[var(--v-off-white)] font-medium hover:bg-[#7A0000] transition-colors cursor-pointer"
                >
                  Confirmer l'évolution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale missions non payées */}
      {unpaidTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[var(--v-gold)] via-[var(--v-primary)] to-[var(--v-gold)]" />
            <div className="px-6 pt-5 flex items-start justify-between">
              <h3 className="text-2xl font-medium text-[var(--v-primary)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                Missions non payées - {unpaidTarget.first_name} {unpaidTarget.last_name}
              </h3>
              <button onClick={() => setUnpaidTarget(null)} className="text-[var(--v-medium)] hover:text-[var(--v-dark)] cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              {loadingUnpaid ? (
                <div className="py-10 text-center text-sm text-[var(--v-medium)]">Chargement...</div>
              ) : unpaidMissions.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--v-medium)]">
                  Aucune mission non payée.
                </div>
              ) : (
                <div className="border-2 border-[var(--v-medium)] rounded-md overflow-hidden max-h-[420px] overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--v-light-beige)] border-b border-[var(--v-medium)]">
                        <th className="text-left px-3 py-2 text-xs font-medium text-[var(--v-dark)]">Date mission</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[var(--v-dark)]">Cycle</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[var(--v-dark)]">Type</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[var(--v-dark)]">Rang</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[var(--v-dark)]">Rôle</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[var(--v-dark)]">Lien</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-[var(--v-dark)]">Marquer payé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidMissions.map((m, index) => (
                        <tr key={m.row_id} className={`border-b border-[var(--v-light-beige)] ${index % 2 === 0 ? 'bg-[var(--v-off-white)]' : 'bg-[var(--v-cream)]'}`}>
                          <td className="px-3 py-2 text-sm text-[var(--v-dark)]">{formatDate(m.mission_date)}</td>
                          <td className="px-3 py-2 text-sm text-[var(--v-medium)]">{m.cycle_name}</td>
                          <td className="px-3 py-2 text-sm text-[var(--v-medium)]">{MISSION_TYPE_LABELS[m.mission_type]}</td>
                          <td className="px-3 py-2 text-sm text-[var(--v-dark)] font-medium">{m.rank}</td>
                          <td className="px-3 py-2 text-sm">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              m.role === 'executant'
                                ? 'bg-[var(--v-primary)]/10 text-[var(--v-primary)] border border-[var(--v-primary)]/30'
                                : m.role === 'intervenant'
                                ? 'bg-[#1565C0]/10 text-[#1565C0] border border-[#1565C0]/30'
                                : 'bg-[var(--v-gold)]/10 text-[#7A5C00] border border-[var(--v-gold)]/40'
                            }`}>
                              {m.role === 'executant' ? 'Exécutant' : m.role === 'intervenant' ? 'Intervenant' : 'Ninja'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {m.mission_link ? (
                              <a
                                href={m.mission_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--v-primary)] hover:text-[var(--v-secondary)] underline"
                              >
                                Voir
                                <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span className="text-[var(--v-medium)]">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => markMissionAsPaid(m)}
                              disabled={!canManage || markingPaidRowId === m.row_id}
                              className={`h-8 px-3 rounded border text-xs font-medium transition-colors ${
                                canManage
                                  ? 'bg-[#4A5D23] border-[var(--v-dark)] text-white hover:bg-[#3F501D] cursor-pointer'
                                  : 'bg-[var(--v-off-white)] border-[var(--v-medium)]/40 text-[var(--v-medium)]/40 cursor-not-allowed'
                              }`}
                              title={canManage ? 'Marquer la mission comme payée' : 'Action réservée aux gérants'}
                            >
                              {markingPaidRowId === m.row_id ? '...' : (
                                <span className="inline-flex items-center gap-1">
                                  <Check size={14} />
                                  Payé
                                </span>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

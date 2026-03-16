import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, ArrowUp, ChevronDown, X, Trash2, Check, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { TIER_LABELS } from '../utils/constants';
import type { Adherent, CardTier, MissionType, MissionRank, MissionStatus } from '../types';

const TIER_BADGE_STYLES: Record<CardTier, string> = {
  bronze: 'bg-[#CD7F32] border-[#8B4513] text-white',
  argent: 'bg-[#A8A9AD] border-[#808080] text-[#3E2723]',
  or: 'bg-[#D4A017] border-[#B8860B] text-[#3E2723]',
  vip: 'bg-[#7B1FA2] border-[#4A148C] text-white',
};

interface AdherentWithStaff extends Adherent {
  staff_users: { first_name: string; last_name: string } | null;
  cycle_points?: number;
}

interface UnpaidMissionItem {
  row_id: string;
  mission_id: string;
  mission_date: string;
  mission_type: MissionType;
  rank: MissionRank;
  status: MissionStatus;
  mission_link: string;
  cycle_name: string;
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
      const cycleRes = await supabase.from('cycles').select('id').eq('status', 'active').single();
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

      // Compte uniquement les missions ninja non payées et effectivement payables.
      const adherentIds = mappedAdherents.map((a) => a.id);
      let unpaidCounts: Record<string, number> = {};

      if (adherentIds.length > 0) {
        const { data: unpaidRows, error: unpaidErr } = await supabase
          .from('mission_ninjas')
          .select('adherent_id, mission:missions!inner(status, mission_type)')
          .eq('is_paid', false)
          .in('adherent_id', adherentIds);

        if (unpaidErr) {
          console.error('Erreur chargement missions non payées:', unpaidErr);
        } else {
          for (const row of unpaidRows ?? []) {
            const mission = Array.isArray((row as any).mission) ? (row as any).mission[0] : (row as any).mission;
            if (!mission) continue;
            if (mission.status !== 'reussi' || mission.mission_type === 'passation') continue;
            unpaidCounts[row.adherent_id] = (unpaidCounts[row.adherent_id] ?? 0) + 1;
          }
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

    const { data, error } = await supabase
      .from('mission_ninjas')
      .select('id, mission_id, mission:missions!inner(id, mission_date, mission_type, rank, status, mission_link, cycles(name))')
      .eq('adherent_id', a.id)
      .eq('is_paid', false);

    if (error) {
      console.error('Erreur chargement détail missions non payées:', error);
      setLoadingUnpaid(false);
      return;
    }

    const items: UnpaidMissionItem[] = (data ?? [])
      .map((row: any) => {
        const mission = Array.isArray(row.mission) ? row.mission[0] : row.mission;
        if (!mission) return null;
        if (mission.status !== 'reussi' || mission.mission_type === 'passation') return null;
        const cycleRel = Array.isArray(mission.cycles) ? mission.cycles[0] : mission.cycles;
        return {
          row_id: row.id,
          mission_id: mission.id,
          mission_date: mission.mission_date,
          mission_type: mission.mission_type,
          rank: mission.rank,
          status: mission.status,
          mission_link: mission.mission_link,
          cycle_name: cycleRel?.name ?? 'Cycle inconnu',
        };
      })
      .filter((item): item is UnpaidMissionItem => Boolean(item))
      .sort((aItem, bItem) => bItem.mission_date.localeCompare(aItem.mission_date));

    setUnpaidMissions(items);
    setLoadingUnpaid(false);
  }

  async function markNinjaMissionAsPaid(rowId: string) {
    if (!canManage) return;

    setMarkingPaidRowId(rowId);
    const { error } = await supabase
      .from('mission_ninjas')
      .update({
        is_paid: true,
        paid_marked_by: staffUser?.id ?? null,
      })
      .eq('id', rowId);

    if (error) {
      console.error('Erreur marquage mission payée:', error);
      alert(`Erreur: ${error.message}`);
      setMarkingPaidRowId(null);
      return;
    }

    setUnpaidMissions((prev) => prev.filter((m) => m.row_id !== rowId));
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
        <h1 className="text-4xl font-medium text-[#8B0000]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          Adhérents
        </h1>
        <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[#8B0000] via-[#C41E3A] to-transparent rounded-full" />
      </div>

      {/* Formulaire Nouvel Adherent */}
      {canManage && (
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017]" />
        <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[#C41E3A] rounded-full" />
            <h2 className="text-2xl font-medium text-[#3E2723]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              Nouvel Adhérent
            </h2>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#3E2723]">Prénom</label>
              <input
                type="text"
                placeholder="Saki"
                value={formPrenom}
                onChange={(e) => setFormPrenom(e.target.value)}
                required
                className="w-full h-9 px-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#3E2723]">Nom</label>
              <input
                type="text"
                placeholder="Sato"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                required
                className="w-full h-9 px-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#3E2723]">Niveau de carte</label>
              <div className="relative">
                <select
                  value={formTier}
                  onChange={(e) => setFormTier(e.target.value as CardTier)}
                  className="w-full h-9 px-3 pr-8 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none focus:border-[#D4A017] appearance-none cursor-pointer"
                >
                  <option value="bronze">Bronze</option>
                  <option value="argent">Argent</option>
                  <option value="or">Or</option>
                  <option value="vip">VIP</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5D4037] pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#3E2723]">Distribué par</label>
              <div className="w-full h-9 px-3 bg-[#E8D5B7] border border-[#5D4037] rounded text-sm text-[#5D4037] flex items-center">
                {staffUser ? `${staffUser.first_name} ${staffUser.last_name}` : '—'}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-9 px-8 bg-[#5D4037] border-2 border-[#3E2723] rounded text-[#FAF3E3] text-sm font-medium shadow-lg hover:bg-[#4E342E] transition-colors cursor-pointer disabled:opacity-60"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
      )}

      {/* Barre de recherche + filtre */}
      <div className="bg-[#F5E6CA] border-2 border-[#5D4037] rounded-[10px] shadow-lg px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5D4037]" />
            <input
              type="text"
              placeholder="Rechercher un adhérent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-10 pr-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] placeholder-[#5D4037] outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
            />
          </div>
          <Filter size={20} className="text-[#5D4037]" />
          <div className="relative">
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value as CardTier | 'all')}
              className="h-9 px-3 pr-8 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm font-medium text-[#3E2723] outline-none focus:border-[#D4A017] appearance-none cursor-pointer"
            >
              <option value="all">Tous les niveaux</option>
              <option value="bronze">Bronze</option>
              <option value="argent">Argent</option>
              <option value="or">Or</option>
              <option value="vip">VIP</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5D4037] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tableau des adherents */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />
        <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[#C41E3A] rounded-full" />
            <h2 className="text-2xl font-medium text-[#3E2723]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              Liste des Adhérents ({filtered.length})
            </h2>
          </div>
        </div>

        <div className="p-6">
          <div className="border-2 border-[#5D4037] rounded-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#E8D5B7] border-b border-[#5D4037]">
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[#3E2723]">Prénom & Nom</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[#3E2723]">Niveau de carte</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[#3E2723]">Distribué par</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[#3E2723]">Date inscription</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[#3E2723]">Points Missions</th>
                  <th className="text-left px-3 py-2.5 text-sm font-medium text-[#3E2723]">Missions non payées</th>
                  <th className="text-right px-3 py-2.5 text-sm font-medium text-[#3E2723]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#5D4037] text-sm">Chargement...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#5D4037] text-sm">Aucun adhérent trouvé.</td>
                  </tr>
                ) : (
                  filtered.map((a, i) => {
                    const upgrades = getUpgradeTiers(a.card_tier);
                    const unpaidCount = unpaidCountMap[a.id] ?? 0;
                    return (
                      <tr
                        key={a.id}
                        className={`border-b border-[#E8D5B7] ${i % 2 === 0 ? 'bg-[#FAF3E3]' : 'bg-[#F5E6CA]'}`}
                      >
                        <td className="px-3 py-3 text-sm text-[#3E2723]">
                          {a.first_name} {a.last_name}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded border-2 text-xs font-medium ${TIER_BADGE_STYLES[a.card_tier]}`}>
                            {TIER_LABELS[a.card_tier]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-[#5D4037]">{staffName(a)}</td>
                        <td className="px-3 py-3 text-sm text-[#5D4037]">{formatDate(a.created_at)}</td>
                        <td className="px-3 py-3 text-sm text-[#3E2723]">
                          {(a.cycle_points ?? 0).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => openUnpaidMissions(a)}
                            className={`h-8 px-3 border rounded text-xs font-medium transition-colors cursor-pointer ${
                              unpaidCount > 0
                                ? 'bg-[#C62828] border-[#8B0000] text-white hover:bg-[#B71C1C]'
                                : 'bg-[#FAF3E3] border-[#5D4037] text-[#5D4037] hover:bg-[#E8D5B7]'
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
                              className="w-[38px] h-8 bg-[#FAF3E3] border border-[#5D4037] rounded flex items-center justify-center hover:bg-[#E8D5B7] transition-colors cursor-pointer"
                              title="Voir fiche"
                            >
                              <Eye size={16} className="text-[#5D4037]" />
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
                                  className={`w-[38px] h-8 bg-[#D4A017] border border-[#8B0000] rounded flex items-center justify-center transition-colors cursor-pointer ${upgrades.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#C49000]'
                                    }`}
                                  title="Évolution"
                                >
                                  <ArrowUp size={16} className="text-white" />
                                </button>
                                <button
                                  onClick={() => handleDelete(a.id, `${a.first_name} ${a.last_name}`)}
                                  disabled={deleting === a.id}
                                  className="w-[38px] h-8 bg-[#C62828] border border-[#8B0000] rounded flex items-center justify-center hover:bg-[#B71C1C] transition-colors cursor-pointer disabled:opacity-50"
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
          <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017]" />
            <div className="px-6 pt-5 flex items-start justify-between">
              <h3 className="text-2xl font-medium text-[#8B0000]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                Évolution de Carte
              </h3>
              <button onClick={() => setEvolTarget(null)} className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-6 pt-4 space-y-5">
              <div className="text-center">
                <p className="text-xs text-[#5D4037]">Adhérent</p>
                <p className="text-base font-medium text-[#3E2723]">{evolTarget.first_name} {evolTarget.last_name}</p>
              </div>

              {/* Niveau actuel -> Nouveau niveau */}
              <div className="flex items-center justify-center gap-6">
                <div className="text-center space-y-2">
                  <p className="text-xs text-[#5D4037]">Niveau actuel</p>
                  <span className={`inline-flex items-center justify-center px-4 py-1.5 rounded border-2 text-sm font-medium ${TIER_BADGE_STYLES[evolTarget.card_tier]}`}>
                    {TIER_LABELS[evolTarget.card_tier]}
                  </span>
                </div>
                <ArrowUp size={24} className="text-[#D4A017] mt-4" />
                <div className="text-center space-y-2">
                  <p className="text-xs text-[#5D4037]">Nouveau niveau</p>
                  <div className="relative">
                    <select
                      value={evolNewTier}
                      onChange={(e) => setEvolNewTier(e.target.value as CardTier)}
                      className="h-9 px-3 pr-8 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none appearance-none cursor-pointer"
                    >
                      {getUpgradeTiers(evolTarget.card_tier).map((t) => (
                        <option key={t} value={t}>{TIER_LABELS[t]}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5D4037] pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3E2723]">Évolution réalisée par</label>
                <div className="w-full h-9 px-3 bg-[#E8D5B7] border border-[#5D4037] rounded text-sm text-[#5D4037] flex items-center">
                  {staffUser ? `${staffUser.first_name} ${staffUser.last_name}` : '—'}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEvolTarget(null)}
                  className="flex-1 h-9 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] hover:bg-[#E8D5B7] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleEvolution}
                  className="flex-1 h-9 bg-[#8B0000] border border-[#6B0000] rounded text-sm text-[#FAF3E3] font-medium hover:bg-[#7A0000] transition-colors cursor-pointer"
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
          <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017]" />
            <div className="px-6 pt-5 flex items-start justify-between">
              <h3 className="text-2xl font-medium text-[#8B0000]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                Missions non payées - {unpaidTarget.first_name} {unpaidTarget.last_name}
              </h3>
              <button onClick={() => setUnpaidTarget(null)} className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              {loadingUnpaid ? (
                <div className="py-10 text-center text-sm text-[#5D4037]">Chargement...</div>
              ) : unpaidMissions.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#5D4037]">
                  Aucune mission ninja non payée.
                </div>
              ) : (
                <div className="border-2 border-[#5D4037] rounded-md overflow-hidden max-h-[420px] overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#E8D5B7] border-b border-[#5D4037]">
                        <th className="text-left px-3 py-2 text-xs font-medium text-[#3E2723]">Date mission</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[#3E2723]">Cycle</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[#3E2723]">Type</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[#3E2723]">Rang</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[#3E2723]">Lien</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-[#3E2723]">Marquer payé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidMissions.map((m, index) => (
                        <tr key={m.row_id} className={`border-b border-[#E8D5B7] ${index % 2 === 0 ? 'bg-[#FAF3E3]' : 'bg-[#F5E6CA]'}`}>
                          <td className="px-3 py-2 text-sm text-[#3E2723]">{formatDate(m.mission_date)}</td>
                          <td className="px-3 py-2 text-sm text-[#5D4037]">{m.cycle_name}</td>
                          <td className="px-3 py-2 text-sm text-[#5D4037]">{MISSION_TYPE_LABELS[m.mission_type]}</td>
                          <td className="px-3 py-2 text-sm text-[#3E2723] font-medium">{m.rank}</td>
                          <td className="px-3 py-2 text-sm">
                            {m.mission_link ? (
                              <a
                                href={m.mission_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#8B0000] hover:text-[#C41E3A] underline"
                              >
                                Voir
                                <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span className="text-[#5D4037]">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => markNinjaMissionAsPaid(m.row_id)}
                              disabled={!canManage || markingPaidRowId === m.row_id}
                              className={`h-8 px-3 rounded border text-xs font-medium transition-colors ${
                                canManage
                                  ? 'bg-[#4A5D23] border-[#3E2723] text-white hover:bg-[#3F501D] cursor-pointer'
                                  : 'bg-[#FAF3E3] border-[#5D4037]/40 text-[#5D4037]/40 cursor-not-allowed'
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

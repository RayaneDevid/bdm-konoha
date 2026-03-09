import { useEffect, useState } from 'react';
import { Plus, Calendar, X, Target, Award, Flame, Shield, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Cycle, CycleStatus } from '../types';

/* ------------------------------------------------------------------ */
/* Status badge config                                                */
/* ------------------------------------------------------------------ */
const STATUS_CONFIG: Record<CycleStatus, { label: string; bg: string; border: string; text: string }> = {
  active: { label: 'Actif', bg: 'bg-[#4A5D23]', border: 'border-[#3E2723]', text: 'text-white' },
  completed: { label: 'Terminé', bg: 'bg-[#8B0000]', border: 'border-[#6B0000]', text: 'text-white' },
  upcoming: { label: 'À venir', bg: 'bg-[#FAF3E3]', border: 'border-[#1565C0]', text: 'text-[#1565C0]' },
};

const CARD_BORDER: Record<CycleStatus, string> = {
  active: 'border-[#D4A017] shadow-[0_0_20px_rgba(212,160,23,0.3)]',
  completed: 'border-[#8B0000]',
  upcoming: 'border-[#1565C0]',
};

/* ------------------------------------------------------------------ */
/* Stats per cycle (missions count + total points)                    */
/* ------------------------------------------------------------------ */
interface CycleStats {
  missions: number;
  points: number;
}

/* ------------------------------------------------------------------ */
/* Helper: add N days to a date string                                */
/* ------------------------------------------------------------------ */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ================================================================== */
/* Main component                                                     */
/* ================================================================== */
export default function Cycles() {
  const { staffUser } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [stats, setStats] = useState<Record<string, CycleStats>>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [overlapError, setOverlapError] = useState('');

  // Edit modal state
  const [editCycle, setEditCycle] = useState<Cycle | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<Cycle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isGerant = staffUser?.role === 'superviseur' || staffUser?.role === 'gerant';
  const canDelete = staffUser?.role === 'superviseur' || staffUser?.role === 'gerant' || staffUser?.role === 'co-gerant';

  /* ---- Fetch cycles ----------------------------------------------- */
  useEffect(() => {
    fetchCycles();
  }, []);

  async function fetchCycles() {
    setLoading(true);
    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) console.error('Erreur chargement cycles:', error);

    if (data) {
      setCycles(data);
      await fetchStats(data);
    }
    setLoading(false);
  }

  async function fetchStats(cycleList: Cycle[]) {
    const statsMap: Record<string, CycleStats> = {};

    for (const c of cycleList) {
      const { count: missionCount } = await supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .eq('cycle_id', c.id);

      const { data: pointsData } = await supabase
        .from('adherent_cycle_summary')
        .select('total_points')
        .eq('cycle_id', c.id);

      const totalPoints = pointsData
        ? pointsData.reduce((sum, r) => sum + Number(r.total_points), 0)
        : 0;

      statsMap[c.id] = {
        missions: missionCount ?? 0,
        points: totalPoints,
      };
    }

    setStats(statsMap);
  }

  /* ---- Auto-generate cycle name ----------------------------------- */
  const nextCycleNumber = cycles.length + 1;
  const autoName = `Cycle ${nextCycleNumber}`;

  /* ---- Auto-suggest end date when start changes ------------------- */
  function handleStartChange(val: string) {
    setFormStart(val);
    setOverlapError('');
    if (val) {
      setFormEnd(addDays(val, 21));
    }
  }

  /* ---- Create cycle ----------------------------------------------- */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formStart || !formEnd) return;

    // Vérifier le chevauchement avec les cycles existants
    const overlap = cycles.find((c) => formStart <= c.end_date && c.start_date <= formEnd);
    if (overlap) {
      setOverlapError(
        `Ces dates chevauchent le cycle "${overlap.name}" (${formatDate(overlap.start_date)} → ${formatDate(overlap.end_date)}).`
      );
      return;
    }
    setOverlapError('');
    setCreating(true);

    // Reset cards (Bronze for all except VIP)
    const { error: resetErr } = await supabase.rpc('reset_cards_for_new_cycle');
    if (resetErr) console.error('Erreur reset cartes:', resetErr);

    // Insert new cycle (le trigger sync_cycle_status calcule le status automatiquement)
    const { error: insertErr } = await supabase.from('cycles').insert({
      name: autoName,
      start_date: formStart,
      end_date: formEnd,
    });

    if (insertErr) {
      console.error('Erreur création cycle:', insertErr);
      alert(`Erreur: ${insertErr.message}`);
    }

    setFormStart('');
    setFormEnd('');
    setOverlapError('');
    setShowModal(false);
    setCreating(false);
    fetchCycles();
  }

  /* ---- Edit cycle dates ------------------------------------------ */
  function openEditModal(c: Cycle) {
    setEditCycle(c);
    setEditStart(c.start_date);
    setEditEnd(c.end_date);
  }

  async function handleEditDates(e: React.FormEvent) {
    e.preventDefault();
    if (!editCycle || !editStart || !editEnd) return;
    setSaving(true);

    await supabase
      .from('cycles')
      .update({ start_date: editStart, end_date: editEnd })
      .eq('id', editCycle.id);

    setEditCycle(null);
    setSaving(false);
    fetchCycles();
  }

  /* ---- Delete cycle ----------------------------------------------- */
  function handleDelete(c: Cycle) {
    const today = new Date().toISOString().split('T')[0];
    const isActive = c.start_date <= today && today <= c.end_date;
    if (isActive) return;
    setDeleteTarget(c);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('cycles').delete().eq('id', deleteTarget.id);
    if (error) {
      console.error('Erreur suppression cycle:', error);
      alert(`Erreur lors de la suppression : ${error.message}`);
    }
    setDeleteTarget(null);
    setDeleting(false);
    fetchCycles();
  }

  /* ================================================================ */
  /* Render                                                           */
  /* ================================================================ */
  return (
    <div className="space-y-6">
      {/* Title + button */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-4xl font-medium text-[#8B0000]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            Gestion des Cycles
          </h1>
          <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[#8B0000] via-[#C41E3A] to-transparent rounded-full" />
        </div>
        {isGerant && (
          <button
            onClick={() => setShowModal(true)}
            className="h-9 px-6 bg-[#5D4037] border-2 border-[#3E2723] rounded text-[#FAF3E3] text-sm font-medium shadow-lg hover:bg-[#4E342E] transition-colors cursor-pointer flex items-center gap-3"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            <Plus size={16} />
            <span>Nouveau Cycle</span>
          </button>
        )}
      </div>

      {/* Gérant-only banner */}
      {!isGerant && (
        <div className="bg-[#D4A017] border-2 border-[#8B0000] rounded-md px-4 py-3 flex items-center justify-center gap-3">
          <Shield size={18} className="text-[#3E2723]" />
          <span className="text-sm font-medium text-[#3E2723]">Accès Gérant BDM</span>
        </div>
      )}

      {/* Cycle grid */}
      {loading ? (
        <div className="text-center py-16 text-[#5D4037] text-sm">Chargement des cycles...</div>
      ) : cycles.length === 0 ? (
        <div className="text-center py-16 text-[#5D4037] text-sm">Aucun cycle créé.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cycles.map((c) => {
            const today = new Date().toISOString().split('T')[0];
            const isActive = c.start_date <= today && today <= c.end_date;
            const computedStatus: CycleStatus = isActive ? 'active' : c.end_date < today ? 'completed' : 'upcoming';
            const st = STATUS_CONFIG[computedStatus];
            const cs = stats[c.id] ?? { missions: 0, points: 0 };

            return (
              <div
                key={c.id}
                className={`bg-[#F5E6CA] border-4 rounded-[10px] shadow-lg overflow-hidden flex flex-col ${CARD_BORDER[computedStatus]}`}
              >
                {/* Top accent */}
                <div className="h-1.5 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />

                {/* Header: name + badge */}
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <h2
                    className="text-2xl font-medium text-[#3E2723]"
                    style={{ fontFamily: "'Noto Serif JP', serif" }}
                  >
                    {c.name}
                  </h2>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded border text-xs font-medium ${st.bg} ${st.border} ${st.text}`}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Dates */}
                <div className="px-5 pb-4 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-[#5D4037]">
                    <Calendar size={14} className="text-[#5D4037]" />
                    <span>Début: {formatDate(c.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#5D4037]">
                    <Calendar size={14} className="text-[#5D4037]" />
                    <span>Fin: {formatDate(c.end_date)}</span>
                  </div>
                </div>

                {/* Stats boxes */}
                <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                  <div className="bg-[#FAF3E3] border border-[#5D4037] rounded-md flex flex-col items-center py-3 gap-1">
                    <Target size={18} className="text-[#C41E3A]" />
                    <span className="text-xs text-[#5D4037]">Missions</span>
                    <span className="text-lg font-bold text-[#3E2723]">
                      {cs.missions.toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div className="bg-[#FAF3E3] border border-[#5D4037] rounded-md flex flex-col items-center py-3 gap-1">
                    <Award size={18} className="text-[#D4A017]" />
                    <span className="text-xs text-[#5D4037]">Points</span>
                    <span className="text-lg font-bold text-[#3E2723]">
                      {cs.points.toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="mx-5 mt-1 bg-[#D4A017] border border-[#8B0000] rounded-md py-2 flex items-center justify-center gap-2">
                    <Flame size={16} className="text-[#8B0000]" />
                    <span
                      className="text-sm font-medium text-[#3E2723]"
                      style={{ fontFamily: "'Noto Serif JP', serif" }}
                    >
                      Cycle en cours
                    </span>
                  </div>
                )}
                {(isGerant || canDelete) && (
                  <div className={`mx-5 mb-5 flex gap-2 ${isActive ? 'mt-2' : ''}`}>
                    {isGerant && (
                      <button
                        onClick={() => openEditModal(c)}
                        className="flex-1 h-8 bg-[#FAF3E3] border border-[#5D4037] rounded flex items-center justify-center gap-2 text-sm text-[#5D4037] hover:bg-[#E8D5B7] transition-colors cursor-pointer"
                      >
                        <Pencil size={14} />
                        Modifier les dates
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={isActive}
                        className={`h-8 px-3 border rounded flex items-center justify-center gap-1.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-[#FAF3E3] border-[#5D4037]/40 text-[#5D4037]/40 cursor-not-allowed'
                            : 'bg-[#FAF3E3] border-[#C62828] text-[#C62828] hover:bg-[#C62828] hover:text-white cursor-pointer'
                        }`}
                        title={isActive ? 'Impossible de supprimer le cycle actif' : 'Supprimer le cycle'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Modale Nouveau Cycle ---- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017]" />

            {/* Modal header */}
            <div className="px-6 pt-5 flex items-start justify-between">
              <h3
                className="text-2xl font-medium text-[#8B0000] flex items-center gap-2"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                <Plus size={22} className="text-[#8B0000]" />
                Nouveau Cycle
              </h3>
              <button
                onClick={() => { setShowModal(false); setFormStart(''); setFormEnd(''); setOverlapError(''); }}
                className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleCreate} className="px-6 pb-6 pt-4 space-y-5">
              {/* Start date */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3E2723]">Date de début</label>
                <input
                  type="date"
                  value={formStart}
                  onChange={(e) => handleStartChange(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
                />
              </div>

              {/* End date */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <label className="block text-sm font-medium text-[#3E2723]">Date de fin</label>
                  <span className="text-xs text-[#5D4037]">(+21 jours suggérés)</span>
                </div>
                <input
                  type="date"
                  value={formEnd}
                  onChange={(e) => { setFormEnd(e.target.value); setOverlapError(''); }}
                  required
                  className="w-full h-9 px-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
                />
              </div>

              {/* Auto name */}
              <div className="bg-[#E8D5B7] border border-[#5D4037] rounded px-4 py-3">
                <span className="text-sm text-[#5D4037]">
                  <span className="font-bold">Nom automatique:</span> {autoName}
                </span>
              </div>

              {/* Overlap error */}
              {overlapError && (
                <div className="bg-[#C62828]/10 border border-[#C62828] rounded px-3 py-2">
                  <p className="text-xs text-[#C62828] font-medium">{overlapError}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormStart(''); setFormEnd(''); setOverlapError(''); }}
                  className="flex-1 h-9 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] hover:bg-[#E8D5B7] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 h-9 bg-[#8B0000] border border-[#6B0000] rounded text-sm text-[#FAF3E3] font-medium hover:bg-[#7A0000] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {creating ? 'Création...' : 'Créer le cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- Modale Modifier Dates ---- */}
      {editCycle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017]" />

            <div className="px-6 pt-5 flex items-start justify-between">
              <h3
                className="text-2xl font-medium text-[#8B0000] flex items-center gap-2"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                <Pencil size={22} className="text-[#8B0000]" />
                Modifier {editCycle.name}
              </h3>
              <button
                onClick={() => setEditCycle(null)}
                className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditDates} className="px-6 pb-6 pt-4 space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3E2723]">Date de début</label>
                <input
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3E2723]">Date de fin</label>
                <input
                  type="date"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditCycle(null)}
                  className="flex-1 h-9 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] hover:bg-[#E8D5B7] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-9 bg-[#8B0000] border border-[#6B0000] rounded text-sm text-[#FAF3E3] font-medium hover:bg-[#7A0000] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- Modale Confirmation Suppression ---- */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#F5E6CA] border-4 border-[#C62828] rounded-[10px] shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#C62828] via-[#8B0000] to-[#C62828]" />

            <div className="px-6 pt-5 flex items-start justify-between">
              <h3
                className="text-xl font-medium text-[#8B0000] flex items-center gap-2"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                <Trash2 size={20} className="text-[#C62828]" />
                Supprimer {deleteTarget.name}
              </h3>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 pt-4 pb-6 space-y-5">
              <p className="text-sm text-[#3E2723]">
                Cette action est <span className="font-semibold">irréversible</span>. Toutes les missions liées à ce cycle seront également supprimées.
              </p>
              <div className="bg-[#C62828]/10 border border-[#C62828]/40 rounded px-3 py-2">
                <p className="text-xs text-[#C62828] font-medium">
                  Cycle : {deleteTarget.name} ({formatDate(deleteTarget.start_date)} → {formatDate(deleteTarget.end_date)})
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 h-9 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] hover:bg-[#E8D5B7] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 h-9 bg-[#C62828] border border-[#B71C1C] rounded text-sm text-white font-medium hover:bg-[#B71C1C] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {deleting ? 'Suppression...' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

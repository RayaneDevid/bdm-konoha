import { useEffect, useState } from 'react';
import { Plus, Calendar, X, Target, Award, Flame, Shield, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Cycle, CycleStatus } from '../types';

/* ------------------------------------------------------------------ */
/* Status badge config                                                */
/* ------------------------------------------------------------------ */
const STATUS_CONFIG: Record<CycleStatus, { label: string; bg: string; border: string; text: string }> = {
  active: { label: 'Actif', bg: 'bg-[#4A5D23]', border: 'border-[var(--v-dark)]', text: 'text-white' },
  completed: { label: 'Terminé', bg: 'bg-[var(--v-primary)]', border: 'border-[#6B0000]', text: 'text-white' },
  upcoming: { label: 'À venir', bg: 'bg-[var(--v-off-white)]', border: 'border-[#1565C0]', text: 'text-[#1565C0]' },
};

const CARD_BORDER: Record<CycleStatus, string> = {
  active: 'border-[var(--v-gold)] shadow-[0_0_20px_rgba(212,160,23,0.3)]',
  completed: 'border-[var(--v-primary)]',
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
            className="text-4xl font-medium text-[var(--v-primary)]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            Gestion des Cycles
          </h1>
          <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-secondary)] to-transparent rounded-full" />
        </div>
        {isGerant && (
          <button
            onClick={() => setShowModal(true)}
            className="h-9 px-6 bg-[var(--v-medium)] border-2 border-[var(--v-dark)] rounded text-[var(--v-off-white)] text-sm font-medium shadow-lg hover:bg-[var(--v-medium-dark)] transition-colors cursor-pointer flex items-center gap-3"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            <Plus size={16} />
            <span>Nouveau Cycle</span>
          </button>
        )}
      </div>

      {/* Gérant-only banner */}
      {!isGerant && (
        <div className="bg-[var(--v-gold)] border-2 border-[var(--v-primary)] rounded-md px-4 py-3 flex items-center justify-center gap-3">
          <Shield size={18} className="text-[var(--v-dark)]" />
          <span className="text-sm font-medium text-[var(--v-dark)]">Accès Gérant BDM</span>
        </div>
      )}

      {/* Cycle grid */}
      {loading ? (
        <div className="text-center py-16 text-[var(--v-medium)] text-sm">Chargement des cycles...</div>
      ) : cycles.length === 0 ? (
        <div className="text-center py-16 text-[var(--v-medium)] text-sm">Aucun cycle créé.</div>
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
                className={`bg-[var(--v-cream)] border-4 rounded-[10px] shadow-lg overflow-hidden flex flex-col ${CARD_BORDER[computedStatus]}`}
              >
                {/* Top accent */}
                <div className="h-1.5 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />

                {/* Header: name + badge */}
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <h2
                    className="text-2xl font-medium text-[var(--v-dark)]"
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
                  <div className="flex items-center gap-2 text-sm text-[var(--v-medium)]">
                    <Calendar size={14} className="text-[var(--v-medium)]" />
                    <span>Début: {formatDate(c.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--v-medium)]">
                    <Calendar size={14} className="text-[var(--v-medium)]" />
                    <span>Fin: {formatDate(c.end_date)}</span>
                  </div>
                </div>

                {/* Stats boxes */}
                <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                  <div className="bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded-md flex flex-col items-center py-3 gap-1">
                    <Target size={18} className="text-[var(--v-secondary)]" />
                    <span className="text-xs text-[var(--v-medium)]">Missions</span>
                    <span className="text-lg font-bold text-[var(--v-dark)]">
                      {cs.missions.toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div className="bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded-md flex flex-col items-center py-3 gap-1">
                    <Award size={18} className="text-[var(--v-gold)]" />
                    <span className="text-xs text-[var(--v-medium)]">Points</span>
                    <span className="text-lg font-bold text-[var(--v-dark)]">
                      {cs.points.toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="mx-5 mt-1 bg-[var(--v-gold)] border border-[var(--v-primary)] rounded-md py-2 flex items-center justify-center gap-2">
                    <Flame size={16} className="text-[var(--v-primary)]" />
                    <span
                      className="text-sm font-medium text-[var(--v-dark)]"
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
                        className="flex-1 h-8 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded flex items-center justify-center gap-2 text-sm text-[var(--v-medium)] hover:bg-[var(--v-light-beige)] transition-colors cursor-pointer"
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
                            ? 'bg-[var(--v-off-white)] border-[var(--v-medium)]/40 text-[var(--v-medium)]/40 cursor-not-allowed'
                            : 'bg-[var(--v-off-white)] border-[#C62828] text-[#C62828] hover:bg-[#C62828] hover:text-white cursor-pointer'
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
          <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[var(--v-gold)] via-[var(--v-primary)] to-[var(--v-gold)]" />

            {/* Modal header */}
            <div className="px-6 pt-5 flex items-start justify-between">
              <h3
                className="text-2xl font-medium text-[var(--v-primary)] flex items-center gap-2"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                <Plus size={22} className="text-[var(--v-primary)]" />
                Nouveau Cycle
              </h3>
              <button
                onClick={() => { setShowModal(false); setFormStart(''); setFormEnd(''); setOverlapError(''); }}
                className="text-[var(--v-medium)] hover:text-[var(--v-dark)] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleCreate} className="px-6 pb-6 pt-4 space-y-5">
              {/* Start date */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--v-dark)]">Date de début</label>
                <input
                  type="date"
                  value={formStart}
                  onChange={(e) => handleStartChange(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
                />
              </div>

              {/* End date */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <label className="block text-sm font-medium text-[var(--v-dark)]">Date de fin</label>
                  <span className="text-xs text-[var(--v-medium)]">(+21 jours suggérés)</span>
                </div>
                <input
                  type="date"
                  value={formEnd}
                  onChange={(e) => { setFormEnd(e.target.value); setOverlapError(''); }}
                  required
                  className="w-full h-9 px-3 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
                />
              </div>

              {/* Auto name */}
              <div className="bg-[var(--v-light-beige)] border border-[var(--v-medium)] rounded px-4 py-3">
                <span className="text-sm text-[var(--v-medium)]">
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
                  className="flex-1 h-9 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] hover:bg-[var(--v-light-beige)] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 h-9 bg-[var(--v-primary)] border border-[#6B0000] rounded text-sm text-[var(--v-off-white)] font-medium hover:bg-[#7A0000] transition-colors cursor-pointer disabled:opacity-60"
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
          <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[var(--v-gold)] via-[var(--v-primary)] to-[var(--v-gold)]" />

            <div className="px-6 pt-5 flex items-start justify-between">
              <h3
                className="text-2xl font-medium text-[var(--v-primary)] flex items-center gap-2"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                <Pencil size={22} className="text-[var(--v-primary)]" />
                Modifier {editCycle.name}
              </h3>
              <button
                onClick={() => setEditCycle(null)}
                className="text-[var(--v-medium)] hover:text-[var(--v-dark)] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditDates} className="px-6 pb-6 pt-4 space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--v-dark)]">Date de début</label>
                <input
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--v-dark)]">Date de fin</label>
                <input
                  type="date"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditCycle(null)}
                  className="flex-1 h-9 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] hover:bg-[var(--v-light-beige)] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-9 bg-[var(--v-primary)] border border-[#6B0000] rounded text-sm text-[var(--v-off-white)] font-medium hover:bg-[#7A0000] transition-colors cursor-pointer disabled:opacity-60"
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
          <div className="bg-[var(--v-cream)] border-4 border-[#C62828] rounded-[10px] shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#C62828] via-[var(--v-primary)] to-[#C62828]" />

            <div className="px-6 pt-5 flex items-start justify-between">
              <h3
                className="text-xl font-medium text-[var(--v-primary)] flex items-center gap-2"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                <Trash2 size={20} className="text-[#C62828]" />
                Supprimer {deleteTarget.name}
              </h3>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-[var(--v-medium)] hover:text-[var(--v-dark)] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 pt-4 pb-6 space-y-5">
              <p className="text-sm text-[var(--v-dark)]">
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
                  className="flex-1 h-9 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] hover:bg-[var(--v-light-beige)] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 h-9 bg-[#C62828] border border-[#B71C1C] rounded text-sm text-white font-medium hover:bg-[#B71C1C] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {deleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

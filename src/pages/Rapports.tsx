import { useEffect, useState } from 'react';
import {
  Swords,
  ShoppingBasket,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Check,
  Trophy,
  Ban,
  GraduationCap,
  Link,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import SearchableSelect from '../components/ui/SearchableSelect';
import SearchableMultiSelect from '../components/ui/SearchableMultiSelect';
import { RANK_POINTS, RANK_COLORS, MISSION_STATUS_LABELS, MISSION_STATUS_COLORS } from '../utils/constants';
import type {
  Cycle,
  Mission,
  MissionRank,
  MissionType,
  MissionStatus,
  PassationType,
  StaffUser,
  Adherent,
} from '../types';

interface MissionFull extends Mission {
  executor_name: string;
  intervenants: { id: string; name: string; is_external: boolean; is_paid: boolean; row_id: string }[];
  ninjas: { id: string; name: string; is_paid: boolean; row_id: string }[];
  paid_count: number;
  total_count: number;
}

const RANKS: MissionRank[] = ['D', 'C', 'B', 'A', 'S'];

export default function Rapports() {
  const { staffUser } = useAuth();
  const canMarkPaid = staffUser?.role === 'superviseur' || staffUser?.role === 'gerant' || staffUser?.role === 'co-gerant';
  const canDelete = staffUser?.role === 'superviseur' || staffUser?.role === 'gerant' || staffUser?.role === 'co-gerant';

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [missions, setMissions] = useState<MissionFull[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [adherentList, setAdherentList] = useState<Adherent[]>([]);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState<MissionType>('ninja');
  const [formPassationType, setFormPassationType] = useState<PassationType>('chunin');
  const [formRank, setFormRank] = useState<MissionRank>('D');
  const [formMissionLink, setFormMissionLink] = useState('');
  const [formExecutor, setFormExecutor] = useState('');
  const [formIntervenants, setFormIntervenants] = useState<string[]>([]);
  const [formNinjas, setFormNinjas] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formDateError, setFormDateError] = useState('');

  // Edit mission modal state
  const [editTarget, setEditTarget] = useState<MissionFull | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<MissionType>('ninja');
  const [editPassationType, setEditPassationType] = useState<PassationType>('chunin');
  const [editRank, setEditRank] = useState<MissionRank>('D');
  const [editMissionLink, setEditMissionLink] = useState('');
  const [editExecutor, setEditExecutor] = useState('');
  const [editIntervenants, setEditIntervenants] = useState<string[]>([]);
  const [editNinjas, setEditNinjas] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editDateError, setEditDateError] = useState('');

  useEffect(() => {
    fetchInitial();
  }, []);

  useEffect(() => {
    if (selectedCycleId) fetchMissions();
  }, [selectedCycleId]);

  async function fetchInitial() {
    const [cyclesRes, staffRes, adherentsRes] = await Promise.all([
      supabase.from('cycles').select('*').order('start_date', { ascending: false }),
      supabase.from('staff_users').select('*').eq('is_active', true).order('last_name'),
      supabase.from('adherents').select('*').eq('is_active', true).order('last_name'),
    ]);

    if (cyclesRes.data) {
      setCycles(cyclesRes.data);
      const today = new Date().toISOString().split('T')[0];
      const current = cyclesRes.data.find((c) => c.start_date <= today && today <= c.end_date);
      setSelectedCycleId(current?.id ?? cyclesRes.data[0]?.id ?? '');
    }
    if (staffRes.data) setStaffList(staffRes.data);
    if (adherentsRes.data) setAdherentList(adherentsRes.data);
  }

  async function fetchMissions() {
    const { data: missionsData } = await supabase
      .from('missions')
      .select('*, executor:executor_id(first_name, last_name)')
      .eq('cycle_id', selectedCycleId)
      .order('mission_date', { ascending: false });

    if (!missionsData) return;

    const missionIds = missionsData.map((m) => m.id);

    const [intervenantsRes, ninjasRes] = await Promise.all([
      supabase
        .from('mission_intervenants')
        .select('*, staff:staff_id(first_name, last_name)')
        .in('mission_id', missionIds.length > 0 ? missionIds : ['_']),
      supabase
        .from('mission_ninjas')
        .select('*, adherent:adherent_id(first_name, last_name)')
        .in('mission_id', missionIds.length > 0 ? missionIds : ['_']),
    ]);

    const intervenantsByMission = new Map<string, MissionFull['intervenants']>();
    const ninjasByMission = new Map<string, MissionFull['ninjas']>();

    (intervenantsRes.data ?? []).forEach((i: any) => {
      const list = intervenantsByMission.get(i.mission_id) ?? [];
      list.push({
        id: i.staff_id ?? 'external',
        name: i.is_external ? 'Externe BDM' : `${i.staff?.first_name ?? ''} ${i.staff?.last_name ?? ''}`.trim(),
        is_external: i.is_external,
        is_paid: i.is_paid,
        row_id: i.id,
      });
      intervenantsByMission.set(i.mission_id, list);
    });

    (ninjasRes.data ?? []).forEach((n: any) => {
      const list = ninjasByMission.get(n.mission_id) ?? [];
      list.push({
        id: n.adherent_id,
        name: `${n.adherent?.last_name ?? ''} ${n.adherent?.first_name ?? ''}`.trim(),
        is_paid: n.is_paid,
        row_id: n.id,
      });
      ninjasByMission.set(n.mission_id, list);
    });

    const full: MissionFull[] = missionsData.map((m: any) => {
      const intervenants = intervenantsByMission.get(m.id) ?? [];
      const ninjas = ninjasByMission.get(m.id) ?? [];
      // Récolte : seuls les ninjas sont payés / gagnent des points
      // Passation : exécutant + intervenants uniquement (ninjas non payés)
      // Ninja : tout le monde
      const allPeople = m.mission_type === 'recolte'
        ? ninjas.map((n) => ({ is_paid: n.is_paid }))
        : m.mission_type === 'passation'
        ? [
            { is_paid: m.executor_is_paid },
            ...intervenants.map((i) => ({ is_paid: i.is_paid })),
          ]
        : [
            { is_paid: m.executor_is_paid },
            ...intervenants.map((i) => ({ is_paid: i.is_paid })),
            ...ninjas.map((n) => ({ is_paid: n.is_paid })),
          ];
      return {
        ...m,
        executor_name: m.executor
          ? `${m.executor.first_name} ${m.executor.last_name}`
          : 'Inconnu',
        intervenants,
        ninjas,
        paid_count: allPeople.filter((p) => p.is_paid).length,
        total_count: allPeople.length,
      };
    });

    setMissions(full);
  }

  async function handleSubmitMission(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate || !formExecutor || !selectedCycleId || !formMissionLink) return;

    const selectedCycle = cycles.find((c) => c.id === selectedCycleId);
    if (selectedCycle && (formDate < selectedCycle.start_date || formDate > selectedCycle.end_date)) {
      setFormDateError(
        `La date doit être comprise entre le ${formatDate(selectedCycle.start_date)} et le ${formatDate(selectedCycle.end_date)}.`
      );
      return;
    }
    setFormDateError('');
    setSubmitting(true);

    const { data: mission, error } = await supabase
      .from('missions')
      .insert({
        cycle_id: selectedCycleId,
        mission_date: formDate,
        mission_type: formType,
        passation_type: formType === 'passation' ? formPassationType : null,
        rank: formRank,
        points: RANK_POINTS[formRank],
        mission_link: formMissionLink,
        executor_id: formExecutor,
      })
      .select()
      .single();

    if (error || !mission) {
      setSubmitting(false);
      return;
    }

    const promises: PromiseLike<any>[] = [];

    if (formIntervenants.length > 0) {
      promises.push(
        supabase.from('mission_intervenants').insert(
          formIntervenants.map((id) => {
            const staff = staffList.find((s) => s.id === id);
            return {
              mission_id: mission.id,
              staff_id: id === 'external' ? null : id,
              adherent_id: id === 'external' ? null : (staff?.adherent_id ?? null),
              is_external: id === 'external',
            };
          })
        ).then()
      );
    }

    if (formNinjas.length > 0) {
      promises.push(
        supabase.from('mission_ninjas').insert(
          formNinjas.map((id) => ({
            mission_id: mission.id,
            adherent_id: id,
          }))
        ).then()
      );
    }

    await Promise.all(promises);

    // Reset form
    setFormDate('');
    setFormType('ninja');
    setFormPassationType('chunin');
    setFormRank('D');
    setFormMissionLink('');
    setFormExecutor('');
    setFormIntervenants([]);
    setFormNinjas([]);
    setFormDateError('');
    setSubmitting(false);
    fetchMissions();
  }

  async function togglePaid(table: string, rowId: string, currentValue: boolean) {
    if (!canMarkPaid) return;
    await supabase
      .from(table)
      .update({ is_paid: !currentValue, paid_marked_by: staffUser!.id })
      .eq('id', rowId);
    fetchMissions();
  }

  async function toggleExecutorPaid(missionId: string, currentValue: boolean) {
    if (!canMarkPaid) return;
    await supabase
      .from('missions')
      .update({ executor_is_paid: !currentValue, executor_paid_marked_by: staffUser!.id })
      .eq('id', missionId);
    fetchMissions();
  }

  async function toggleMissionStatus(missionId: string, currentStatus: MissionStatus) {
    if (!canMarkPaid) return;
    const newStatus: MissionStatus = currentStatus === 'reussi' ? 'echec' : 'reussi';
    await supabase
      .from('missions')
      .update({ status: newStatus })
      .eq('id', missionId);
    fetchMissions();
  }

  async function handleDeleteMission(missionId: string) {
    if (!canDelete) return;
    if (!window.confirm('Supprimer cette mission ? Cette action est irréversible.')) return;
    await supabase.from('missions').delete().eq('id', missionId);
    setExpandedId(null);
    fetchMissions();
  }

  function openEditModal(mission: MissionFull) {
    setEditTarget(mission);
    setEditDate(mission.mission_date);
    setEditType(mission.mission_type);
    setEditPassationType(mission.passation_type ?? 'chunin');
    setEditRank(mission.rank);
    setEditMissionLink(mission.mission_link);
    setEditExecutor(mission.executor_id);
    setEditIntervenants(mission.intervenants.map((i) => i.id));
    setEditNinjas(mission.ninjas.map((n) => n.id));
    setEditDateError('');
  }

  async function handleSaveEdit() {
    if (!editTarget) return;

    const editCycle = cycles.find((c) => c.id === editTarget.cycle_id);
    if (editCycle && (editDate < editCycle.start_date || editDate > editCycle.end_date)) {
      setEditDateError(
        `La date doit être comprise entre le ${formatDate(editCycle.start_date)} et le ${formatDate(editCycle.end_date)}.`
      );
      return;
    }
    setEditDateError('');
    setEditSaving(true);

    await supabase
      .from('missions')
      .update({
        mission_date: editDate,
        mission_type: editType,
        passation_type: editType === 'passation' ? editPassationType : null,
        rank: editRank,
        points: RANK_POINTS[editRank],
        mission_link: editMissionLink,
        executor_id: editExecutor,
      })
      .eq('id', editTarget.id);

    await Promise.all([
      supabase.from('mission_intervenants').delete().eq('mission_id', editTarget.id),
      supabase.from('mission_ninjas').delete().eq('mission_id', editTarget.id),
    ]);

    const insertPromises: PromiseLike<any>[] = [];

    if (editIntervenants.length > 0) {
      insertPromises.push(
        supabase.from('mission_intervenants').insert(
          editIntervenants.map((id) => {
            const staff = staffList.find((s) => s.id === id);
            return {
              mission_id: editTarget.id,
              staff_id: id === 'external' ? null : id,
              adherent_id: id === 'external' ? null : (staff?.adherent_id ?? null),
              is_external: id === 'external',
            };
          })
        ).then()
      );
    }

    if (editNinjas.length > 0) {
      insertPromises.push(
        supabase.from('mission_ninjas').insert(
          editNinjas.map((id) => ({
            mission_id: editTarget.id,
            adherent_id: id,
          }))
        ).then()
      );
    }

    await Promise.all(insertPromises);

    setEditTarget(null);
    setEditSaving(false);
    fetchMissions();
  }

  async function markAllPaid(table: string, rows: { row_id: string }[]) {
    if (!canMarkPaid) return;
    await Promise.all(
      rows.map((r) =>
        supabase
          .from(table)
          .update({ is_paid: true, paid_marked_by: staffUser!.id })
          .eq('id', r.row_id)
      )
    );
    fetchMissions();
  }

  const totalPoints = missions.reduce((sum, m) => sum + m.points, 0);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

  const formatCycleLabel = (c: Cycle) => {
    const start = new Date(c.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const end = new Date(c.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${c.name} — ${start} au ${end}`;
  };

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div>
        <h1
          className="text-4xl font-medium text-[#8B0000]"
          style={{ fontFamily: "'Noto Serif JP', serif" }}
        >
          Rapports BDM
        </h1>
        <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[#8B0000] via-[#C41E3A] to-transparent rounded-full" />
      </div>

      {/* Selecteur de cycle */}
      <div className="bg-[#F5E6CA] border-2 border-[#5D4037] rounded-[10px] shadow-lg px-6 py-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-[#3E2723]">Selectionner un cycle :</label>
          <select
            value={selectedCycleId}
            onChange={(e) => { setSelectedCycleId(e.target.value); setFormDateError(''); }}
            className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded px-4 py-2 text-sm font-medium text-[#3E2723] w-80 focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {formatCycleLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Formulaire Nouvelle Mission */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl">
        <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017] rounded-t-md" />

        <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[#C41E3A] rounded-full" />
            <h2
              className="text-2xl font-medium text-[#3E2723]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Nouvelle Mission
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmitMission} className="p-6 space-y-4">
          {/* Date + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-[#3E2723]">
                <Calendar size={16} className="text-[#5D4037]" />
                Date
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => { setFormDate(e.target.value); setFormDateError(''); }}
                min={cycles.find((c) => c.id === selectedCycleId)?.start_date}
                max={cycles.find((c) => c.id === selectedCycleId)?.end_date}
                className={`w-full bg-[#FAF3E3] border rounded px-3 py-2 text-sm text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8B0000] ${formDateError ? 'border-[#C62828]' : 'border-[#5D4037]'}`}
                required
              />
              {formDateError && (
                <p className="text-xs text-[#C62828] font-medium">{formDateError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#3E2723]">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormType('ninja')}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                    formType === 'ninja'
                      ? 'bg-[#8B0000] text-[#FAF3E3]'
                      : 'bg-[#FAF3E3] border-2 border-[#5D4037] text-[#5D4037]'
                  }`}
                >
                  <Swords size={16} />
                  Ninja
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('recolte')}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                    formType === 'recolte'
                      ? 'bg-[#8B0000] text-[#FAF3E3]'
                      : 'bg-[#FAF3E3] border-2 border-[#5D4037] text-[#5D4037]'
                  }`}
                >
                  <ShoppingBasket size={16} />
                  Récolte
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('passation')}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                    formType === 'passation'
                      ? 'bg-[#8B0000] text-[#FAF3E3]'
                      : 'bg-[#FAF3E3] border-2 border-[#5D4037] text-[#5D4037]'
                  }`}
                >
                  <GraduationCap size={16} />
                  Passation
                </button>
              </div>
            </div>
          </div>

          {/* Type de passation (affiché uniquement pour les missions de passation) */}
          {formType === 'passation' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#3E2723]">Type de passation</label>
              <div className="flex gap-2 w-1/2">
                <button
                  type="button"
                  onClick={() => setFormPassationType('chunin')}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                    formPassationType === 'chunin'
                      ? 'bg-[#8B0000] text-[#FAF3E3]'
                      : 'bg-[#FAF3E3] border-2 border-[#5D4037] text-[#5D4037]'
                  }`}
                >
                  <GraduationCap size={16} />
                  Chunin
                </button>
                <button
                  type="button"
                  onClick={() => setFormPassationType('genin_confirme')}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                    formPassationType === 'genin_confirme'
                      ? 'bg-[#8B0000] text-[#FAF3E3]'
                      : 'bg-[#FAF3E3] border-2 border-[#5D4037] text-[#5D4037]'
                  }`}
                >
                  <GraduationCap size={16} />
                  Genin confirmé
                </button>
              </div>
            </div>
          )}

          {/* Lien de la mission */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[#3E2723]">
              <Link size={16} className="text-[#5D4037]" />
              Lien de la mission
            </label>
            <input
              type="text"
              value={formMissionLink}
              onChange={(e) => setFormMissionLink(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#FAF3E3] border border-[#5D4037] rounded px-3 py-2 text-sm text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
              required
            />
          </div>

          {/* Rang */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#3E2723]">Rang</label>
            <div className="flex gap-2">
              {RANKS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFormRank(r)}
                  className={`flex-1 flex items-center justify-center gap-3 h-9 rounded text-sm font-medium border-2 transition-all cursor-pointer ${
                    formRank === r
                      ? 'border-[#5D4037] ring-2 ring-[#D4A017] shadow-md'
                      : 'border-[#5D4037]'
                  }`}
                  style={{
                    backgroundColor: RANK_COLORS[r],
                    color: r === 'S' ? '#3E2723' : 'white',
                  }}
                >
                  <span className="font-bold">{r}</span>
                  <span className="text-xs font-medium">({RANK_POINTS[r]}pts)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Executant + Intervenants + Ninjas */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#3E2723]">Executant</label>
              <SearchableSelect
                options={staffList.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
                value={formExecutor}
                onChange={setFormExecutor}
                placeholder="Sélectionner..."
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#3E2723]">Intervenants</label>
              <SearchableMultiSelect
                options={[
                  { value: 'external', label: 'Externe BDM' },
                  ...staffList.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })),
                ]}
                selected={formIntervenants}
                onChange={setFormIntervenants}
                placeholder="Ajouter..."
                chipColor={{ bg: '#5D4037', text: '#FAF3E3' }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#3E2723]">Ninjas</label>
              <SearchableMultiSelect
                options={adherentList.map((a) => ({ value: a.id, label: `${a.last_name} ${a.first_name}` }))}
                selected={formNinjas}
                onChange={setFormNinjas}
                placeholder="Ajouter..."
                chipColor={{ bg: '#D4A017', text: '#3E2723' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-[#5D4037] border-2 border-[#3E2723] text-[#FAF3E3] px-6 h-9 rounded shadow-lg text-sm font-medium hover:bg-[#3E2723] transition-colors cursor-pointer disabled:opacity-50"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer la mission'}
          </button>
        </form>
      </div>

      {/* Missions du Cycle */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />

        <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-6 bg-[#C41E3A] rounded-full" />
              <h2
                className="text-2xl font-medium text-[#3E2723]"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Missions du Cycle
              </h2>
            </div>
            <div
              className="bg-[#D4A017] px-5 py-2 rounded text-[#3E2723] text-lg font-medium"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Total: {totalPoints} points
            </div>
          </div>
        </div>

        <div className="p-6 space-y-2">
          {missions.length === 0 ? (
            <p className="text-[#5D4037] text-sm text-center py-8">
              Aucune mission pour ce cycle.
            </p>
          ) : (
            missions.map((mission) => {
              const isExpanded = expandedId === mission.id;
              const payPercent =
                mission.total_count > 0
                  ? Math.round((mission.paid_count / mission.total_count) * 100)
                  : 0;

              return (
                <div
                  key={mission.id}
                  className={`border-2 border-[#5D4037] rounded-md overflow-hidden ${
                    isExpanded ? 'bg-[#FAF3E3]' : mission.id === missions[0]?.id ? 'bg-[#FAF3E3]' : 'bg-[#F5E6CA]'
                  }`}
                >
                  {/* Mission row */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-4">
                      {/* Date */}
                      <span className="text-[#5D4037] text-base w-[60px] shrink-0">
                        {formatDate(mission.mission_date)}
                      </span>

                      {/* Type icon */}
                      <div className="shrink-0 flex items-center gap-1">
                        {mission.mission_type === 'ninja' ? (
                          <Swords size={20} className="text-[#5D4037]" />
                        ) : mission.mission_type === 'recolte' ? (
                          <ShoppingBasket size={20} className="text-[#5D4037]" />
                        ) : (
                          <GraduationCap size={20} className="text-[#5D4037]" />
                        )}
                        {mission.mission_type === 'passation' && mission.passation_type && (
                          <span className="text-[10px] font-medium text-[#5D4037] bg-[#E8D5B7] border border-[#5D4037]/40 px-1.5 py-0.5 rounded leading-none">
                            {mission.passation_type === 'chunin' ? 'Chunin' : 'Genin conf.'}
                          </span>
                        )}
                      </div>

                      {/* Rank badge */}
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-white text-xs font-medium shrink-0"
                        style={{ backgroundColor: RANK_COLORS[mission.rank] }}
                      >
                        {mission.rank}
                      </span>

                      {/* Executor */}
                      <span className="text-[#3E2723] text-base w-[140px] shrink-0 truncate">
                        {mission.executor_name}
                      </span>

                      {/* Intervenants chips */}
                      <div className="flex gap-1 w-[140px] shrink-0 flex-wrap">
                        {mission.intervenants.slice(0, 2).map((i) => (
                          <span
                            key={i.row_id}
                            className="bg-[#5D4037] text-[#FAF3E3] text-xs font-medium px-2 py-0.5 rounded"
                          >
                            {i.name.split(' ').pop()}
                          </span>
                        ))}
                        {mission.intervenants.length > 2 && (
                          <span className="bg-[#5D4037] text-[#FAF3E3] text-xs font-medium px-2 py-0.5 rounded">
                            +{mission.intervenants.length - 2}
                          </span>
                        )}
                      </div>

                      {/* Ninjas chips */}
                      <div className="flex gap-1 w-[140px] shrink-0 flex-wrap">
                        {mission.ninjas.slice(0, 2).map((n) => (
                          <span
                            key={n.row_id}
                            className="bg-[#D4A017] text-[#3E2723] text-xs font-medium px-2 py-0.5 rounded"
                          >
                            {n.name.split(' ')[0]}
                          </span>
                        ))}
                        {mission.ninjas.length > 2 && (
                          <span className="bg-[#D4A017] text-[#3E2723] text-xs font-medium px-2 py-0.5 rounded">
                            +{mission.ninjas.length - 2}
                          </span>
                        )}
                      </div>

                      {/* Points */}
                      <span className="text-[#3E2723] text-base w-[65px] shrink-0">
                        {mission.points}pts
                      </span>

                      {/* Status badge */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleMissionStatus(mission.id, mission.status); }}
                        disabled={!canMarkPaid}
                        className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: MISSION_STATUS_COLORS[mission.status].bg,
                          color: MISSION_STATUS_COLORS[mission.status].text,
                          borderWidth: '1px',
                          borderColor: MISSION_STATUS_COLORS[mission.status].border,
                          cursor: canMarkPaid ? 'pointer' : 'default',
                        }}
                        title={canMarkPaid ? 'Cliquer pour changer le statut' : undefined}
                      >
                        {mission.status === 'reussi' ? <Trophy size={12} /> : <Ban size={12} />}
                        {MISSION_STATUS_LABELS[mission.status]}
                      </button>

                      {/* Payment progress */}
                      <div className="w-[140px] shrink-0">
                        <span className="text-xs text-[#5D4037]">
                          {mission.paid_count}/{mission.total_count} payes
                        </span>
                        <div className="w-full h-2 bg-[#E8D5B7] rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-[#4A5D23] rounded-full transition-all"
                            style={{ width: `${payPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Chevron toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : mission.id)}
                      className="mt-2 text-[#5D4037] cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>

                  {/* Expanded accordion */}
                  {isExpanded && (
                    <div className="bg-[#E8D5B7] border-t-2 border-[#5D4037] px-4 py-4">
                      {/* Accordion header: link + actions */}
                      <div className="flex items-center justify-between mb-4">
                        {mission.mission_link ? (
                          <a
                            href={mission.mission_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-[#8B0000] underline hover:text-[#C41E3A] transition-colors"
                          >
                            <Link size={14} />
                            Voir le lien de la mission
                          </a>
                        ) : (
                          <span className="text-xs text-[#5D4037] italic">Aucun lien</span>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(mission)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#D4A017] border border-[#B8860B] text-[#3E2723] text-xs font-medium rounded hover:bg-[#C49515] transition-colors cursor-pointer"
                          >
                            <Pencil size={14} />
                            Modifier
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMission(mission.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[#C62828] border border-[#B71C1C] text-white text-xs font-medium rounded hover:bg-[#B71C1C] transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                              Supprimer la mission
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {/* Executant */}
                        <div className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md px-4 py-4 space-y-3">
                          <h4
                            className="text-base font-medium text-[#8B0000]"
                            style={{ fontFamily: "'Noto Serif JP', serif" }}
                          >
                            Executant
                          </h4>
                          {mission.mission_type === 'recolte' && (
                            <div className="flex items-center gap-2 bg-[#5D4037]/10 border border-[#5D4037]/30 rounded px-3 py-2">
                              <ShoppingBasket size={14} className="text-[#5D4037] shrink-0" />
                              <p className="text-xs text-[#5D4037] font-medium">
                                Mission récolte — pas de paie pour l'exécutant.
                              </p>
                            </div>
                          )}
                          <div className={`flex items-center gap-3 ${mission.mission_type === 'recolte' ? 'opacity-40' : ''}`}>
                            <button
                              type="button"
                              onClick={() => toggleExecutorPaid(mission.id, mission.executor_is_paid)}
                              disabled={!canMarkPaid || mission.mission_type === 'recolte'}
                              className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                                mission.executor_is_paid
                                  ? 'bg-[#8B0000] border-[#8B0000]'
                                  : 'bg-[#FAF3E3] border-[#5D4037]'
                              } ${canMarkPaid && mission.mission_type !== 'recolte' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                            >
                              {mission.executor_is_paid && <Check size={12} className="text-white" />}
                            </button>
                            <span className="text-sm text-[#3E2723]">{mission.executor_name}</span>
                            {mission.mission_type === 'recolte' ? (
                              <span className="text-xs text-[#5D4037]">—</span>
                            ) : mission.executor_is_paid ? (
                              <CheckCircle size={16} className="text-[#4A5D23]" />
                            ) : (
                              <XCircle size={16} className="text-[#C62828]" />
                            )}
                          </div>
                        </div>

                        {/* Intervenants */}
                        <div className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md px-4 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4
                              className="text-base font-medium text-[#8B0000]"
                              style={{ fontFamily: "'Noto Serif JP', serif" }}
                            >
                              Intervenants
                            </h4>
                            {canMarkPaid && mission.intervenants.length > 0 && mission.mission_type !== 'recolte' && (
                              <button
                                type="button"
                                onClick={() => markAllPaid('mission_intervenants', mission.intervenants)}
                                className="bg-[#D4A017] border border-[#8B0000] text-[#3E2723] text-xs font-medium px-3 py-1 rounded cursor-pointer hover:bg-[#C49515] transition-colors"
                              >
                                Tout cocher
                              </button>
                            )}
                          </div>
                          {mission.mission_type === 'recolte' && mission.intervenants.length > 0 && (
                            <div className="flex items-center gap-2 bg-[#5D4037]/10 border border-[#5D4037]/30 rounded px-3 py-2">
                              <ShoppingBasket size={14} className="text-[#5D4037] shrink-0" />
                              <p className="text-xs text-[#5D4037] font-medium">
                                Mission récolte — pas de paie pour les intervenants.
                              </p>
                            </div>
                          )}
                          <div className="space-y-2">
                            {mission.intervenants.map((i) => (
                              <div key={i.row_id} className={`flex items-center gap-3 ${mission.mission_type === 'recolte' ? 'opacity-40' : ''}`}>
                                <button
                                  type="button"
                                  onClick={() => togglePaid('mission_intervenants', i.row_id, i.is_paid)}
                                  disabled={!canMarkPaid || mission.mission_type === 'recolte'}
                                  className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                                    i.is_paid
                                      ? 'bg-[#8B0000] border-[#8B0000]'
                                      : 'bg-[#FAF3E3] border-[#5D4037]'
                                  } ${canMarkPaid && mission.mission_type !== 'recolte' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                >
                                  {i.is_paid && <Check size={12} className="text-white" />}
                                </button>
                                <span className="text-sm text-[#3E2723]">{i.name}</span>
                                {mission.mission_type === 'recolte' ? (
                                  <span className="text-xs text-[#5D4037]">—</span>
                                ) : i.is_paid ? (
                                  <CheckCircle size={16} className="text-[#4A5D23]" />
                                ) : (
                                  <XCircle size={16} className="text-[#C62828]" />
                                )}
                              </div>
                            ))}
                            {mission.intervenants.length === 0 && (
                              <p className="text-xs text-[#5D4037]">Aucun intervenant</p>
                            )}
                          </div>
                        </div>

                        {/* Ninjas */}
                        <div className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md px-4 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4
                              className="text-base font-medium text-[#8B0000]"
                              style={{ fontFamily: "'Noto Serif JP', serif" }}
                            >
                              Ninjas
                            </h4>
                            {canMarkPaid && mission.ninjas.length > 0 && mission.status === 'reussi' && mission.mission_type !== 'passation' && (
                              <button
                                type="button"
                                onClick={() => markAllPaid('mission_ninjas', mission.ninjas)}
                                className="bg-[#D4A017] border border-[#8B0000] text-[#3E2723] text-xs font-medium px-3 py-1 rounded cursor-pointer hover:bg-[#C49515] transition-colors"
                              >
                                Tout cocher
                              </button>
                            )}
                          </div>
                          {mission.mission_type === 'passation' ? (
                            <div className="flex items-center gap-2 bg-[#5D4037]/10 border border-[#5D4037]/30 rounded px-3 py-2">
                              <GraduationCap size={14} className="text-[#5D4037] shrink-0" />
                              <p className="text-xs text-[#5D4037] font-medium">
                                Mission passation — les ninjas ne sont pas payés.
                              </p>
                            </div>
                          ) : mission.status === 'echec' ? (
                            <div className="flex items-center gap-2 bg-[#C62828]/10 border border-[#C62828]/30 rounded px-3 py-2">
                              <Ban size={14} className="text-[#C62828] shrink-0" />
                              <p className="text-xs text-[#C62828] font-medium">
                                Mission en échec — les ninjas ne reçoivent ni PM ni paie.
                              </p>
                            </div>
                          ) : null}
                          <div className="space-y-2">
                            {mission.ninjas.map((n) => (
                              <div
                                key={n.row_id}
                                className={`flex items-center gap-3 ${
                                  mission.status === 'echec' || mission.mission_type === 'passation' ? 'opacity-40' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => togglePaid('mission_ninjas', n.row_id, n.is_paid)}
                                  disabled={!canMarkPaid || mission.status === 'echec' || mission.mission_type === 'passation'}
                                  className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                                    n.is_paid
                                      ? 'bg-[#8B0000] border-[#8B0000]'
                                      : 'bg-[#FAF3E3] border-[#5D4037]'
                                  } ${canMarkPaid && mission.status === 'reussi' && mission.mission_type !== 'passation' ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                >
                                  {n.is_paid && <Check size={12} className="text-white" />}
                                </button>
                                <span className="text-sm text-[#3E2723]">{n.name}</span>
                                {mission.status === 'echec' || mission.mission_type === 'passation' ? (
                                  <Ban size={16} className="text-[#C62828]" />
                                ) : n.is_paid ? (
                                  <CheckCircle size={16} className="text-[#4A5D23]" />
                                ) : (
                                  <XCircle size={16} className="text-[#C62828]" />
                                )}
                              </div>
                            ))}
                            {mission.ninjas.length === 0 && (
                              <p className="text-xs text-[#5D4037]">Aucun ninja</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit mission modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017] shrink-0" />

            {/* Header */}
            <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-4 flex items-center justify-between shrink-0">
              <h3
                className="text-xl font-medium text-[#8B0000]"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Modifier la mission
              </h3>
              <button
                onClick={() => setEditTarget(null)}
                className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Date + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-[#3E2723]">
                    <Calendar size={16} className="text-[#5D4037]" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => { setEditDate(e.target.value); setEditDateError(''); }}
                    min={editTarget ? cycles.find((c) => c.id === editTarget.cycle_id)?.start_date : undefined}
                    max={editTarget ? cycles.find((c) => c.id === editTarget.cycle_id)?.end_date : undefined}
                    className={`w-full bg-[#FAF3E3] border rounded px-3 py-2 text-sm text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8B0000] ${editDateError ? 'border-[#C62828]' : 'border-[#5D4037]'}`}
                  />
                  {editDateError && (
                    <p className="text-xs text-[#C62828] font-medium">{editDateError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3E2723]">Type</label>
                  <div className="flex gap-2">
                    {(['ninja', 'recolte', 'passation'] as MissionType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditType(t)}
                        className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                          editType === t
                            ? 'bg-[#8B0000] text-[#FAF3E3]'
                            : 'bg-[#FAF3E3] border-2 border-[#5D4037] text-[#5D4037]'
                        }`}
                      >
                        {t === 'ninja' ? <Swords size={16} /> : t === 'recolte' ? <ShoppingBasket size={16} /> : <GraduationCap size={16} />}
                        {t === 'ninja' ? 'Ninja' : t === 'recolte' ? 'Récolte' : 'Passation'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Type de passation (affiché uniquement pour les missions de passation) */}
              {editType === 'passation' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3E2723]">Type de passation</label>
                  <div className="flex gap-2 w-1/2">
                    <button
                      type="button"
                      onClick={() => setEditPassationType('chunin')}
                      className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                        editPassationType === 'chunin'
                          ? 'bg-[#8B0000] text-[#FAF3E3]'
                          : 'bg-[#FAF3E3] border-2 border-[#5D4037] text-[#5D4037]'
                      }`}
                    >
                      <GraduationCap size={16} />
                      Chunin
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPassationType('genin_confirme')}
                      className={`flex-1 flex items-center justify-center gap-2 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                        editPassationType === 'genin_confirme'
                          ? 'bg-[#8B0000] text-[#FAF3E3]'
                          : 'bg-[#FAF3E3] border-2 border-[#5D4037] text-[#5D4037]'
                      }`}
                    >
                      <GraduationCap size={16} />
                      Genin confirmé
                    </button>
                  </div>
                </div>
              )}

              {/* Lien */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[#3E2723]">
                  <Link size={16} className="text-[#5D4037]" />
                  Lien de la mission
                </label>
                <input
                  type="text"
                  value={editMissionLink}
                  onChange={(e) => setEditMissionLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#FAF3E3] border border-[#5D4037] rounded px-3 py-2 text-sm text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
                />
              </div>

              {/* Rang */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#3E2723]">Rang</label>
                <div className="flex gap-2">
                  {RANKS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditRank(r)}
                      className={`flex-1 flex items-center justify-center gap-3 h-9 rounded text-sm font-medium border-2 transition-all cursor-pointer ${
                        editRank === r
                          ? 'border-[#5D4037] ring-2 ring-[#D4A017] shadow-md'
                          : 'border-[#5D4037]'
                      }`}
                      style={{
                        backgroundColor: RANK_COLORS[r],
                        color: r === 'S' ? '#3E2723' : 'white',
                      }}
                    >
                      <span className="font-bold">{r}</span>
                      <span className="text-xs font-medium">({RANK_POINTS[r]}pts)</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Executant + Intervenants + Ninjas */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3E2723]">Executant</label>
                  <SearchableSelect
                    options={staffList.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
                    value={editExecutor}
                    onChange={setEditExecutor}
                    placeholder="Sélectionner..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3E2723]">Intervenants</label>
                  <SearchableMultiSelect
                    options={[
                      { value: 'external', label: 'Externe BDM' },
                      ...staffList.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })),
                    ]}
                    selected={editIntervenants}
                    onChange={setEditIntervenants}
                    placeholder="Ajouter..."
                    chipColor={{ bg: '#5D4037', text: '#FAF3E3' }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#3E2723]">Ninjas</label>
                  <SearchableMultiSelect
                    options={adherentList.map((a) => ({ value: a.id, label: `${a.last_name} ${a.first_name}` }))}
                    selected={editNinjas}
                    onChange={setEditNinjas}
                    placeholder="Ajouter..."
                    chipColor={{ bg: '#D4A017', text: '#3E2723' }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t-2 border-[#5D4037] bg-[#E8D5B7] shrink-0 flex gap-3">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 h-9 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] hover:bg-[#E8D5B7] transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSaving || !editDate || !editExecutor || !editMissionLink}
                className="flex-1 h-9 bg-[#5D4037] border border-[#3E2723] rounded text-sm text-[#FAF3E3] font-medium hover:bg-[#3E2723] transition-colors cursor-pointer disabled:opacity-50"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                {editSaving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

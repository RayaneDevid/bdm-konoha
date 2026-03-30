import { useEffect, useState } from 'react';
import { Users, Swords, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SearchableSelect from '../components/ui/SearchableSelect';
import { RANK_COLORS, RANK_POINTS } from '../utils/constants';
import type { StaffUser, MissionType, MissionRank, MissionStatus } from '../types';

interface MissionEntry {
  id: string;
  mission_date: string;
  mission_type: MissionType;
  rank: MissionRank;
  status: MissionStatus;
  points: number;
  cycle_name: string;
  role: 'executant' | 'intervenant';
}

interface WeekGroup {
  weekStart: string; // YYYY-MM-DD (lundi)
  weekEnd: string;   // YYYY-MM-DD (dimanche)
  missions: MissionEntry[];
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
}

function getWeekEnd(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  date.setDate(date.getDate() + 6);
  return date.toISOString().split('T')[0];
}

const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  ninja: 'Ninja',
  recolte: 'Récolte',
  passation: 'Passation',
};

const formatDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatDateShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

export default function FicheMembre() {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('staff_users')
      .select('*')
      .eq('is_active', true)
      .order('last_name')
      .then(({ data }) => { if (data) setStaffList(data); });
  }, []);

  useEffect(() => {
    if (!selectedMemberId) {
      setWeekGroups([]);
      return;
    }
    fetchActivity(selectedMemberId);
  }, [selectedMemberId]);

  async function fetchActivity(memberId: string) {
    setLoading(true);
    setWeekGroups([]);
    setExpandedWeek(null);

    const [executorRes, intervenantRes] = await Promise.all([
      supabase
        .from('missions')
        .select('id, mission_date, mission_type, rank, status, points, cycles(name)')
        .eq('executor_id', memberId)
        .order('mission_date', { ascending: false }),
      supabase
        .from('mission_intervenants')
        .select('mission:missions!inner(id, mission_date, mission_type, rank, status, points, cycles(name))')
        .eq('staff_id', memberId)
        .eq('is_external', false),
    ]);

    const entries: MissionEntry[] = [];

    for (const row of executorRes.data ?? []) {
      const cycleRel = Array.isArray(row.cycles) ? row.cycles[0] : row.cycles;
      entries.push({
        id: row.id,
        mission_date: row.mission_date,
        mission_type: row.mission_type as MissionType,
        rank: row.rank as MissionRank,
        status: row.status as MissionStatus,
        points: row.points,
        cycle_name: cycleRel?.name ?? '—',
        role: 'executant',
      });
    }

    for (const row of intervenantRes.data ?? []) {
      const m = Array.isArray((row as any).mission) ? (row as any).mission[0] : (row as any).mission;
      if (!m) continue;
      // Évite les doublons si le membre est à la fois exécutant et intervenant
      if (entries.find((e) => e.id === m.id && e.role === 'executant')) continue;
      const cycleRel = Array.isArray(m.cycles) ? m.cycles[0] : m.cycles;
      entries.push({
        id: m.id,
        mission_date: m.mission_date,
        mission_type: m.mission_type as MissionType,
        rank: m.rank as MissionRank,
        status: m.status as MissionStatus,
        points: m.points,
        cycle_name: cycleRel?.name ?? '—',
        role: 'intervenant',
      });
    }

    // Grouper par semaine
    const byWeek = new Map<string, MissionEntry[]>();
    for (const entry of entries) {
      const ws = getWeekStart(entry.mission_date);
      const list = byWeek.get(ws) ?? [];
      list.push(entry);
      byWeek.set(ws, list);
    }

    const groups: WeekGroup[] = Array.from(byWeek.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([weekStart, missions]) => ({
        weekStart,
        weekEnd: getWeekEnd(weekStart),
        missions: missions.sort((a, b) => b.mission_date.localeCompare(a.mission_date)),
      }));

    setWeekGroups(groups);
    setLoading(false);
  }

  const selectedMember = staffList.find((s) => s.id === selectedMemberId);

  const totalExecutant = weekGroups.reduce(
    (sum, w) => sum + w.missions.filter((m) => m.role === 'executant').length, 0
  );
  const totalIntervenant = weekGroups.reduce(
    (sum, w) => sum + w.missions.filter((m) => m.role === 'intervenant').length, 0
  );
  const totalMissions = totalExecutant + totalIntervenant;

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div>
        <h1 className="text-4xl font-medium text-[var(--v-primary)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          Fiche Membre BDM
        </h1>
        <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-secondary)] to-transparent rounded-full" />
      </div>

      {/* Sélection du membre */}
      <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[var(--v-gold)] via-[var(--v-primary)] to-[var(--v-gold)]" />
        <div className="p-6">
          <div className="max-w-sm space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--v-dark)]">
              <Users size={16} className="text-[var(--v-medium)]" />
              Membre BDM
            </label>
            <SearchableSelect
              options={staffList.map((s) => ({
                value: s.id,
                label: `${s.first_name} ${s.last_name}`,
              }))}
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              placeholder="Sélectionner un membre..."
            />
          </div>
        </div>
      </div>

      {/* Résultats */}
      {selectedMemberId && (
        <>
          {/* Résumé */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
              <div className="h-1 bg-[var(--v-gold)]" />
              <div className="p-5 text-center">
                <p className="text-xs text-[var(--v-medium)] mb-1">Total missions</p>
                <p className="text-4xl font-medium text-[var(--v-dark)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                  {loading ? '—' : totalMissions}
                </p>
              </div>
            </div>
            <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
              <div className="h-1 bg-[var(--v-primary)]" />
              <div className="p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Swords size={14} className="text-[var(--v-primary)]" />
                  <p className="text-xs text-[var(--v-medium)]">Exécutant</p>
                </div>
                <p className="text-4xl font-medium text-[var(--v-primary)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                  {loading ? '—' : totalExecutant}
                </p>
              </div>
            </div>
            <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
              <div className="h-1 bg-[#1565C0]" />
              <div className="p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Shield size={14} className="text-[#1565C0]" />
                  <p className="text-xs text-[var(--v-medium)]">Intervenant</p>
                </div>
                <p className="text-4xl font-medium text-[#1565C0]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                  {loading ? '—' : totalIntervenant}
                </p>
              </div>
            </div>
          </div>

          {/* Activité par semaine */}
          <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-xl overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />
            <div className="bg-[var(--v-light-beige)] border-b-2 border-[var(--v-medium)] px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="w-1 h-6 bg-[var(--v-secondary)] rounded-full" />
                <h2 className="text-2xl font-medium text-[var(--v-dark)]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                  Activité par semaine
                  {selectedMember && (
                    <span className="ml-2 text-base font-normal text-[var(--v-medium)]">
                      — {selectedMember.first_name} {selectedMember.last_name}
                    </span>
                  )}
                </h2>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <p className="text-[var(--v-medium)] text-sm text-center py-8">Chargement...</p>
              ) : weekGroups.length === 0 ? (
                <p className="text-[var(--v-medium)] text-sm text-center py-8">Aucune mission enregistrée.</p>
              ) : (
                <div className="space-y-2">
                  {weekGroups.map((week) => {
                    const isExpanded = expandedWeek === week.weekStart;
                    const nbExec = week.missions.filter((m) => m.role === 'executant').length;
                    const nbInter = week.missions.filter((m) => m.role === 'intervenant').length;

                    return (
                      <div
                        key={week.weekStart}
                        className="border-2 border-[var(--v-medium)] rounded-md overflow-hidden"
                      >
                        {/* Ligne semaine */}
                        <button
                          type="button"
                          onClick={() => setExpandedWeek(isExpanded ? null : week.weekStart)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--v-light-beige)] hover:bg-[#DFC9A5] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-6">
                            <span className="text-sm font-medium text-[var(--v-dark)]">
                              {formatDateShort(week.weekStart)} → {formatDate(week.weekEnd)}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 text-xs font-medium text-[var(--v-primary)] bg-[var(--v-primary)]/10 border border-[var(--v-primary)]/30 px-2 py-0.5 rounded">
                                <Swords size={11} />
                                {nbExec} exéc.
                              </span>
                              <span className="flex items-center gap-1 text-xs font-medium text-[#1565C0] bg-[#1565C0]/10 border border-[#1565C0]/30 px-2 py-0.5 rounded">
                                <Shield size={11} />
                                {nbInter} inter.
                              </span>
                              <span className="text-xs text-[var(--v-medium)]">
                                {week.missions.length} mission{week.missions.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={18} className="text-[var(--v-medium)]" /> : <ChevronDown size={18} className="text-[var(--v-medium)]" />}
                        </button>

                        {/* Détail */}
                        {isExpanded && (
                          <div className="bg-[var(--v-off-white)] border-t-2 border-[var(--v-medium)]">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-[var(--v-light-beige)]">
                                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--v-dark)]">Date</th>
                                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--v-dark)]">Type</th>
                                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--v-dark)]">Rang</th>
                                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--v-dark)]">Rôle</th>
                                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--v-dark)]">Cycle</th>
                                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--v-dark)]">Statut</th>
                                </tr>
                              </thead>
                              <tbody>
                                {week.missions.map((m, idx) => (
                                  <tr
                                    key={`${m.id}-${m.role}`}
                                    className={`border-b border-[var(--v-light-beige)] ${idx % 2 === 0 ? 'bg-[var(--v-off-white)]' : 'bg-[var(--v-cream)]'}`}
                                  >
                                    <td className="px-4 py-2 text-sm text-[var(--v-medium)]">{formatDate(m.mission_date)}</td>
                                    <td className="px-4 py-2 text-sm text-[var(--v-dark)]">{MISSION_TYPE_LABELS[m.mission_type]}</td>
                                    <td className="px-4 py-2">
                                      <span
                                        className="inline-flex items-center justify-center w-7 h-7 rounded text-white text-xs font-medium"
                                        style={{ backgroundColor: RANK_COLORS[m.rank] }}
                                      >
                                        {m.rank}
                                      </span>
                                      <span className="ml-1 text-xs text-[var(--v-medium)]">{RANK_POINTS[m.rank]}pts</span>
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                        m.role === 'executant'
                                          ? 'bg-[var(--v-primary)]/10 text-[var(--v-primary)] border border-[var(--v-primary)]/30'
                                          : 'bg-[#1565C0]/10 text-[#1565C0] border border-[#1565C0]/30'
                                      }`}>
                                        {m.role === 'executant' ? 'Exécutant' : 'Intervenant'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-xs text-[var(--v-medium)]">{m.cycle_name}</td>
                                    <td className="px-4 py-2">
                                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                        m.status === 'reussi'
                                          ? 'bg-[#4A5D23]/10 text-[#4A5D23] border border-[#4A5D23]/30'
                                          : 'bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/30'
                                      }`}>
                                        {m.status === 'reussi' ? 'Réussi' : 'Échec'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

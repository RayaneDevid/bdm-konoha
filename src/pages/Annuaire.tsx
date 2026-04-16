import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Scroll, Users, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TIER_COLORS, TIER_LABELS, VILLAGE_NAME } from '../utils/constants';
import type { CardTier, Cycle } from '../types';

interface AdherentPublic {
  id: string;
  first_name: string;
  last_name: string;
  card_tier: CardTier;
  total_missions: number;
  total_points: number;
}

const TIER_ORDER: CardTier[] = ['vip', 'or', 'argent', 'bronze', 'aucun'];

const TIER_BG: Record<CardTier, string> = {
  aucun: 'bg-[#9E9E9E]/10 border-[#9E9E9E]/40',
  bronze: 'bg-[#CD7F32]/10 border-[#CD7F32]/40',
  argent: 'bg-[#A8A9AD]/10 border-[#A8A9AD]/40',
  or: 'bg-[var(--v-gold)]/10 border-[var(--v-gold)]/40',
  vip: 'bg-[#7B1FA2]/10 border-[#7B1FA2]/40',
};

export default function Annuaire() {
  const navigate = useNavigate();
  const [adherents, setAdherents] = useState<AdherentPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<CardTier | 'all'>('all');

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [cyclesLoaded, setCyclesLoaded] = useState(false);

  // 1. Load cycles once
  useEffect(() => {
    async function fetchCycles() {
      const { data } = await supabase
        .from('cycles')
        .select('*')
        .order('start_date', { ascending: false });
      if (data && data.length > 0) {
        setCycles(data as Cycle[]);
        const today = new Date().toISOString().split('T')[0];
        const active = data.find((c) => c.start_date <= today && today <= c.end_date);
        setSelectedCycleId(active?.id ?? data[0].id);
      }
      setCyclesLoaded(true);
    }
    fetchCycles();
  }, []);

  // 2. Load adherents + stats whenever cycle changes (after cycles are loaded)
  useEffect(() => {
    if (!cyclesLoaded) return;

    async function fetchAdherents() {
      setLoading(true);

      if (!selectedCycleId) {
        setLoading(false);
        return;
      }

      // 1. Trouver les adhérents qui ont participé à ce cycle
      //    (ont un tier OU des points) — sans filtre is_active pour couvrir les cycles passés
      const [tiersRes, summaryRes] = await Promise.all([
        supabase
          .from('adherent_card_tiers')
          .select('adherent_id, card_tier')
          .eq('cycle_id', selectedCycleId),
        supabase
          .from('adherent_cycle_summary')
          .select('adherent_id, total_points')
          .eq('cycle_id', selectedCycleId),
      ]);

      const tierMap = new Map<string, CardTier>(
        (tiersRes.data ?? []).map((t) => [t.adherent_id, t.card_tier as CardTier])
      );
      const pointsMap = new Map<string, number>(
        (summaryRes.data ?? []).map((s) => [s.adherent_id, Number(s.total_points) || 0])
      );

      // Union des IDs présents dans l'un ou l'autre
      const cycleAdherentIds = Array.from(
        new Set([...tierMap.keys(), ...pointsMap.keys()])
      );

      if (cycleAdherentIds.length === 0) {
        setAdherents([]);
        setLoading(false);
        return;
      }

      // 2. Infos des adhérents (sans filtre is_active — les anciens cycles ont is_active=false)
      const { data: adherentsData } = await supabase
        .from('adherents')
        .select('id, first_name, last_name')
        .in('id', cycleAdherentIds)
        .order('last_name');

      if (!adherentsData) {
        setLoading(false);
        return;
      }

      // 3. Compter les missions par adhérent pour ce cycle
      const { data: missionsData } = await supabase
        .from('missions')
        .select('id, mission_ninjas(adherent_id)')
        .eq('cycle_id', selectedCycleId);

      const missionsMap = new Map<string, number>();
      (missionsData ?? []).forEach((mission: any) => {
        (mission.mission_ninjas ?? []).forEach((n: { adherent_id: string }) => {
          missionsMap.set(n.adherent_id, (missionsMap.get(n.adherent_id) ?? 0) + 1);
        });
      });

      const result: AdherentPublic[] = adherentsData.map((a) => ({
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        card_tier: tierMap.get(a.id) ?? 'aucun',
        total_missions: missionsMap.get(a.id) ?? 0,
        total_points: pointsMap.get(a.id) ?? 0,
      }));

      result.sort((a, b) => {
        const tierDiff = TIER_ORDER.indexOf(a.card_tier) - TIER_ORDER.indexOf(b.card_tier);
        if (tierDiff !== 0) return tierDiff;
        return a.last_name.localeCompare(b.last_name, 'fr');
      });

      setAdherents(result);
      setLoading(false);
    }

    fetchAdherents();
  }, [selectedCycleId, cyclesLoaded]);

  const filtered = adherents.filter((a) => {
    const matchSearch =
      search === '' ||
      `${a.last_name} ${a.first_name}`.toLowerCase().includes(search.toLowerCase()) ||
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' || a.card_tier === tierFilter;
    return matchSearch && matchTier;
  });

  const tiers: (CardTier | 'all')[] = ['all', 'vip', 'or', 'argent', 'bronze', 'aucun'];

  const formatCycleLabel = (c: Cycle) => {
    const today = new Date().toISOString().split('T')[0];
    const isActive = c.start_date <= today && today <= c.end_date;
    return `${c.name}${isActive ? ' — En cours' : ''}`;
  };

  return (
    <div className="min-h-screen bg-[var(--v-off-white)]">
      {/* Header band */}
      <div className="bg-[var(--v-dark)] border-b-4 border-[var(--v-gold)] shadow-xl">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--v-gold)] rounded-full border-2 border-[var(--v-off-white)] flex items-center justify-center shadow-lg">
                <Scroll size={24} className="text-[var(--v-dark)]" />
              </div>
              <div>
                <h1
                  className="text-3xl font-medium text-[var(--v-off-white)]"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Annuaire des Ninjas
                </h1>
                <p className="text-[var(--v-gold)] text-sm mt-0.5">Bureau des Missions de {VILLAGE_NAME}</p>
              </div>
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

      {/* Decorative top accent */}
      <div className="h-1 bg-gradient-to-r from-[var(--v-primary)] via-[var(--v-gold)] to-[var(--v-primary)]" />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Search + filters */}
        <div className="bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-md px-6 py-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--v-medium)]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un ninja..."
                className="w-full h-9 pl-9 pr-4 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] placeholder-[var(--v-medium)]/60 outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
              />
            </div>

            {/* Tier filter */}
            <div className="flex gap-2 flex-wrap">
              {tiers.map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`h-9 px-4 rounded border-2 text-sm font-medium transition-all cursor-pointer ${
                    tierFilter === t
                      ? 'border-[var(--v-dark)] shadow-md text-white'
                      : 'border-[var(--v-medium)] bg-[var(--v-off-white)] text-[var(--v-dark)] hover:bg-[var(--v-light-beige)]'
                  }`}
                  style={
                    tierFilter === t
                      ? {
                          backgroundColor:
                            t === 'all' ? 'var(--v-medium)' : TIER_COLORS[t as CardTier],
                          color:
                            t === 'argent' ? 'var(--v-dark)' : t === 'or' ? 'var(--v-dark)' : 'white',
                        }
                      : {}
                  }
                >
                  {t === 'all' ? 'Tous' : TIER_LABELS[t as CardTier]}
                </button>
              ))}
            </div>
          </div>

          {/* Cycle selector */}
          {cycles.length > 0 && (
            <div className="flex items-center gap-3 pt-1 border-t border-[var(--v-medium)]/20">
              <span
                className="text-sm font-medium text-[var(--v-medium)] whitespace-nowrap"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Cycle :
              </span>
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
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-[var(--v-medium)]">
          <Users size={16} />
          <span>
            {loading
              ? 'Chargement...'
              : `${filtered.length} ninja${filtered.length > 1 ? 's' : ''} enregistré${filtered.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-16 text-[var(--v-medium)] text-sm">
            Chargement de l'annuaire...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--v-medium)] text-sm italic">
            Aucun ninja trouvé.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/annuaire/${a.id}`)}
                className={`bg-[var(--v-cream)] border-2 rounded-[10px] shadow-md overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer text-left ${TIER_BG[a.card_tier]}`}
              >
                {/* Top accent bar with tier color */}
                <div
                  className="h-1.5"
                  style={{ backgroundColor: TIER_COLORS[a.card_tier] }}
                />

                <div className="p-4 space-y-3">
                  {/* Name + tier badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p
                        className="text-base font-medium text-[var(--v-dark)] leading-tight"
                        style={{ fontFamily: "'Noto Serif JP', serif" }}
                      >
                        {a.last_name}
                      </p>
                      <p className="text-sm text-[var(--v-medium)]">{a.first_name}</p>
                    </div>
                    <span
                      className="shrink-0 text-xs font-medium px-2 py-0.5 rounded border mt-0.5"
                      style={{
                        backgroundColor: TIER_COLORS[a.card_tier] + '22',
                        borderColor: TIER_COLORS[a.card_tier],
                        color: a.card_tier === 'vip' ? '#7B1FA2' : a.card_tier === 'or' ? '#8B6914' : a.card_tier === 'argent' ? '#5A5A5A' : a.card_tier === 'aucun' ? '#616161' : '#8B5E1D',
                      }}
                    >
                      {TIER_LABELS[a.card_tier]}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="border-t border-[var(--v-medium)]/20 pt-3 grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[var(--v-dark)]">
                        {a.total_missions.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-[10px] text-[var(--v-medium)] uppercase tracking-wide">
                        missions
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-[var(--v-gold)]">
                        {a.total_points.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-[10px] text-[var(--v-medium)] uppercase tracking-wide">
                        points
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
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

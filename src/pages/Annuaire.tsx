import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Scroll, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TIER_COLORS, TIER_LABELS } from '../utils/constants';
import type { CardTier } from '../types';

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
  or: 'bg-[#D4A017]/10 border-[#D4A017]/40',
  vip: 'bg-[#7B1FA2]/10 border-[#7B1FA2]/40',
};

export default function Annuaire() {
  const navigate = useNavigate();
  const [adherents, setAdherents] = useState<AdherentPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<CardTier | 'all'>('all');

  useEffect(() => {
    async function fetchAdherents() {
      setLoading(true);

      const { data: adherentsData } = await supabase
        .from('adherents')
        .select('id, first_name, last_name, card_tier')
        .eq('is_active', true)
        .order('last_name');

      if (!adherentsData) {
        setLoading(false);
        return;
      }

      const ids = adherentsData.map((a) => a.id);

      const { data: statsData } = await supabase
        .from('adherent_total_points')
        .select('adherent_id, total_missions, total_points')
        .in('adherent_id', ids.length > 0 ? ids : ['_']);

      const statsMap = new Map<string, { total_missions: number; total_points: number }>();
      (statsData ?? []).forEach((s) => {
        statsMap.set(s.adherent_id, {
          total_missions: Number(s.total_missions) || 0,
          total_points: Number(s.total_points) || 0,
        });
      });

      const result: AdherentPublic[] = adherentsData.map((a) => ({
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        card_tier: a.card_tier as CardTier,
        total_missions: statsMap.get(a.id)?.total_missions ?? 0,
        total_points: statsMap.get(a.id)?.total_points ?? 0,
      }));

      // Sort by tier order then by name
      result.sort((a, b) => {
        const tierDiff = TIER_ORDER.indexOf(a.card_tier) - TIER_ORDER.indexOf(b.card_tier);
        if (tierDiff !== 0) return tierDiff;
        return a.last_name.localeCompare(b.last_name, 'fr');
      });

      setAdherents(result);
      setLoading(false);
    }

    fetchAdherents();
  }, []);

  const filtered = adherents.filter((a) => {
    const matchSearch =
      search === '' ||
      `${a.last_name} ${a.first_name}`.toLowerCase().includes(search.toLowerCase()) ||
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' || a.card_tier === tierFilter;
    return matchSearch && matchTier;
  });

  const tiers: (CardTier | 'all')[] = ['all', 'vip', 'or', 'argent', 'bronze', 'aucun'];

  return (
    <div className="min-h-screen bg-[#FAF3E3]">
      {/* Header band */}
      <div className="bg-[#3E2723] border-b-4 border-[#D4A017] shadow-xl">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#D4A017] rounded-full border-2 border-[#FAF3E3] flex items-center justify-center shadow-lg">
                <Scroll size={24} className="text-[#3E2723]" />
              </div>
              <div>
                <h1
                  className="text-3xl font-medium text-[#FAF3E3]"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Annuaire des Ninjas
                </h1>
                <p className="text-[#D4A017] text-sm mt-0.5">Bureau des Missions de Konoha</p>
              </div>
            </div>
            {/* Login link for staff */}
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

      {/* Decorative top accent */}
      <div className="h-1 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Search + filters */}
        <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-md px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5D4037]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un ninja..."
                className="w-full h-9 pl-9 pr-4 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] placeholder-[#5D4037]/60 outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
              />
            </div>

            {/* Tier filter */}
            <div className="flex gap-2">
              {tiers.map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`h-9 px-4 rounded border-2 text-sm font-medium transition-all cursor-pointer ${
                    tierFilter === t
                      ? 'border-[#3E2723] shadow-md text-white'
                      : 'border-[#5D4037] bg-[#FAF3E3] text-[#3E2723] hover:bg-[#E8D5B7]'
                  }`}
                  style={
                    tierFilter === t
                      ? {
                          backgroundColor:
                            t === 'all' ? '#5D4037' : TIER_COLORS[t as CardTier],
                          color:
                            t === 'argent' ? '#3E2723' : t === 'or' ? '#3E2723' : 'white',
                        }
                      : {}
                  }
                >
                  {t === 'all' ? 'Tous' : TIER_LABELS[t as CardTier]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-[#5D4037]">
          <Users size={16} />
          <span>
            {loading
              ? 'Chargement...'
              : `${filtered.length} ninja${filtered.length > 1 ? 's' : ''} enregistré${filtered.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-16 text-[#5D4037] text-sm">
            Chargement de l'annuaire...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#5D4037] text-sm italic">
            Aucun ninja trouvé.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/annuaire/${a.id}`)}
                className={`bg-[#F5E6CA] border-2 rounded-[10px] shadow-md overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer text-left ${TIER_BG[a.card_tier]}`}
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
                        className="text-base font-medium text-[#3E2723] leading-tight"
                        style={{ fontFamily: "'Noto Serif JP', serif" }}
                      >
                        {a.last_name}
                      </p>
                      <p className="text-sm text-[#5D4037]">{a.first_name}</p>
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
                  <div className="border-t border-[#5D4037]/20 pt-3 grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#3E2723]">
                        {a.total_missions.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-[10px] text-[#5D4037] uppercase tracking-wide">
                        missions
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#D4A017]">
                        {a.total_points.toLocaleString('fr-FR')}
                      </p>
                      <p className="text-[10px] text-[#5D4037] uppercase tracking-wide">
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
      <footer className="mt-12 border-t-2 border-[#5D4037]/30 py-6 text-center">
        <p className="text-xs text-[#5D4037]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          Bureau des Missions de Konoha — Annuaire public
        </p>
      </footer>
    </div>
  );
}

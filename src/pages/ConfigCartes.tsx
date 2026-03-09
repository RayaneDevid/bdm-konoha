import { useEffect, useState, useCallback } from 'react';
import {
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Coins,
  Sword,
  Shirt,
  Target,
  Medal,
  HelpCircle,
  Copy,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../lib/supabase';
import { TIER_LABELS, REWARD_TYPE_LABELS } from '../utils/constants';
import type { CardTier, Cycle, RewardType } from '../types';

/* ------------------------------------------------------------------ */
/* Reward type → icon mapping                                         */
/* ------------------------------------------------------------------ */
const REWARD_ICONS: Record<RewardType, React.ComponentType<{ size?: number; className?: string }>> = {
  ryos: Coins,
  equipement: Sword,
  outfit: Shirt,
  kunais: Target,
  pieces_merite: Medal,
  autre: HelpCircle,
};

/* ------------------------------------------------------------------ */
/* Tab colours (active background)                                    */
/* ------------------------------------------------------------------ */
const TAB_ACTIVE_BG: Record<CardTier, string> = {
  bronze: 'bg-[#CD7F32]',
  or: 'bg-[#D4A017]',
  vip: 'bg-[#7B1FA2]',
};

const TAB_ACTIVE_TEXT: Record<CardTier, string> = {
  bronze: 'text-white',
  or: 'text-[#3E2723]',
  vip: 'text-white',
};

/* ------------------------------------------------------------------ */
/* Local milestone shape (includes a client‑side temp id for new ones)*/
/* ------------------------------------------------------------------ */
interface LocalMilestone {
  id: string;
  cycle_id: string;
  card_tier: CardTier;
  pm_threshold: number;
  reward_type: RewardType;
  reward_description: string;
  sort_order: number;
  isNew?: boolean;
}

/* ------------------------------------------------------------------ */
/* Sortable milestone card                                            */
/* ------------------------------------------------------------------ */
function SortableMilestone({
  m,
  index,
  total,
  onChange,
  onDelete,
}: {
  m: LocalMilestone;
  index: number;
  total: number;
  onChange: (id: string, field: keyof LocalMilestone, value: string | number) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: m.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const Icon = REWARD_ICONS[m.reward_type];
  const connectorWidth = 169;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col items-center w-[217px] shrink-0">
      {/* Icon node + controls */}
      <div className="relative mb-4">
        {/* Gold circle with icon */}
        <div className="relative z-10 w-[80px] h-[80px] rounded-full bg-gradient-to-b from-[#D4A017] to-[#B8860B] border-4 border-[#5D4037] shadow-xl flex items-center justify-center">
          <Icon size={40} className="text-white" />
        </div>

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="absolute -top-2 -right-2 z-20 w-6 h-6 bg-[#5D4037] rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
          title="Glisser pour réorganiser"
        >
          <GripVertical size={14} className="text-[#FAF3E3]" />
        </button>

        {/* Delete button */}
        <button
          onClick={() => onDelete(m.id)}
          className="absolute -top-2 -left-2 z-20 w-5 h-5 bg-[#C62828] rounded-full flex items-center justify-center hover:bg-[#B71C1C] transition-colors cursor-pointer"
          title="Supprimer ce palier"
        >
          <Trash2 size={12} className="text-white" />
        </button>

        {/* Connector line to the LEFT */}
        {index > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-[#D4A017] to-[#8B0000] rounded-full"
            style={{ right: '100%', width: connectorWidth }}
          />
        )}
        {/* Connector line to the RIGHT — grey background track */}
        {index < total - 1 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1 bg-[#E8D5B7] rounded-full"
            style={{ left: '100%', width: connectorWidth }}
          />
        )}
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-2 w-full">
        {/* PM threshold */}
        <input
          type="number"
          min={0}
          value={m.pm_threshold}
          onChange={(e) => onChange(m.id, 'pm_threshold', parseInt(e.target.value) || 0)}
          className="w-full h-9 px-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm font-bold text-[#5D4037] text-center outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
        />

        {/* Reward type select */}
        <div className="relative">
          <select
            value={m.reward_type}
            onChange={(e) => onChange(m.id, 'reward_type', e.target.value)}
            className="w-full h-9 px-3 pr-8 bg-[#FAF3E3] border border-[#5D4037] rounded text-xs font-medium text-[#3E2723] outline-none focus:border-[#D4A017] appearance-none cursor-pointer"
          >
            {(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map((rt) => (
              <option key={rt} value={rt}>
                {REWARD_TYPE_LABELS[rt]}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5D4037] pointer-events-none"
          />
        </div>

        {/* Description */}
        <textarea
          value={m.reward_description}
          onChange={(e) => onChange(m.id, 'reward_description', e.target.value)}
          placeholder="Description"
          rows={2}
          className="w-full px-3 py-2 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] placeholder-[#5D4037] outline-none resize-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
        />
      </div>
    </div>
  );
}

/* ================================================================== */
/* Main page component                                                */
/* ================================================================== */
export default function ConfigCartes() {
  const [activeTier, setActiveTier] = useState<CardTier>('bronze');
  const [milestones, setMilestones] = useState<LocalMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Cycle management
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [cyclesLoading, setCyclesLoading] = useState(true);

  /* ---- DnD sensors ------------------------------------------------ */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ---- Load cycles ------------------------------------------------ */
  useEffect(() => {
    async function fetchCycles() {
      setCyclesLoading(true);
      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Erreur chargement cycles:', error);
      }

      if (data && data.length > 0) {
        setCycles(data as Cycle[]);
        // Default: active cycle, or the most recent one
        const active = data.find((c) => c.status === 'active');
        setSelectedCycleId(active ? active.id : data[0].id);
      }
      setCyclesLoading(false);
    }
    fetchCycles();
  }, []);

  /* ---- Fetch milestones for selected cycle ----------------------- */
  const fetchMilestones = useCallback(async (cycleId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('card_milestones')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Erreur chargement paliers:', error);
    }

    setMilestones((data as LocalMilestone[]) ?? []);
    setLoading(false);
    setDirty(false);
  }, []);

  useEffect(() => {
    if (selectedCycleId) {
      fetchMilestones(selectedCycleId);
    }
  }, [selectedCycleId, fetchMilestones]);

  /* ---- Filtered for active tab ------------------------------------ */
  const tierMilestones = milestones
    .filter((m) => m.card_tier === activeTier)
    .sort((a, b) => a.sort_order - b.sort_order);

  /* ---- Change handler --------------------------------------------- */
  const handleChange = (id: string, field: keyof LocalMilestone, value: string | number) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
    setDirty(true);
  };

  /* ---- Delete handler --------------------------------------------- */
  const handleDelete = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    setDirty(true);
  };

  /* ---- Add new milestone ------------------------------------------ */
  const handleAdd = () => {
    if (!selectedCycleId) return;
    const existing = milestones.filter((m) => m.card_tier === activeTier);
    const maxSort = existing.length > 0 ? Math.max(...existing.map((m) => m.sort_order)) : 0;
    const maxThreshold = existing.length > 0 ? Math.max(...existing.map((m) => m.pm_threshold)) : 0;

    const newMilestone: LocalMilestone = {
      id: `new-${Date.now()}`,
      cycle_id: selectedCycleId,
      card_tier: activeTier,
      pm_threshold: maxThreshold + 100,
      reward_type: 'ryos',
      reward_description: '',
      sort_order: maxSort + 1,
      isNew: true,
    };

    setMilestones((prev) => [...prev, newMilestone]);
    setDirty(true);
  };

  /* ---- DnD end ---------------------------------------------------- */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tierMilestones.findIndex((m) => m.id === active.id);
    const newIndex = tierMilestones.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tierMilestones, oldIndex, newIndex).map((m, i) => ({
      ...m,
      sort_order: i + 1,
    }));

    setMilestones((prev) => {
      const others = prev.filter((m) => m.card_tier !== activeTier);
      return [...others, ...reordered];
    });
    setDirty(true);
  };

  /* ---- Copy milestones from another cycle ------------------------- */
  const handleCopyFromCycle = async (sourceCycleId: string) => {
    if (!selectedCycleId || sourceCycleId === selectedCycleId) return;
    setCopying(true);

    const { data, error } = await supabase
      .from('card_milestones')
      .select('*')
      .eq('cycle_id', sourceCycleId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Erreur copie paliers:', error);
      setCopying(false);
      return;
    }

    if (!data || data.length === 0) {
      alert('Le cycle sélectionné ne possède aucun palier à copier.');
      setCopying(false);
      return;
    }

    // Re-map to new cycle, clearing IDs so they're treated as new
    const copied: LocalMilestone[] = data.map((m) => ({
      id: `new-${Date.now()}-${m.id}`,
      cycle_id: selectedCycleId,
      card_tier: m.card_tier as CardTier,
      pm_threshold: m.pm_threshold,
      reward_type: m.reward_type as RewardType,
      reward_description: m.reward_description,
      sort_order: m.sort_order,
      isNew: true,
    }));

    // Replace current milestones for this cycle (keep only non-new existing ones for deletion tracking)
    setMilestones(copied);
    setDirty(true);
    setCopying(false);
  };

  /* ---- Save ------------------------------------------------------- */
  const handleSave = async () => {
    if (!selectedCycleId) return;
    setSaving(true);

    try {
      // Get all existing DB milestones for this cycle
      const { data: existing } = await supabase
        .from('card_milestones')
        .select('id')
        .eq('cycle_id', selectedCycleId);

      const existingIds = new Set((existing ?? []).map((e) => e.id));
      const currentNonNewIds = new Set(milestones.filter((m) => !m.isNew).map((m) => m.id));

      // Delete removed milestones
      const toDelete = [...existingIds].filter((id) => !currentNonNewIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase.from('card_milestones').delete().in('id', toDelete);
        if (error) console.error('Erreur suppression paliers:', error);
      }

      // Upsert existing + insert new
      for (const m of milestones) {
        if (m.isNew) {
          const { error } = await supabase.from('card_milestones').insert({
            cycle_id: selectedCycleId,
            card_tier: m.card_tier,
            pm_threshold: m.pm_threshold,
            reward_type: m.reward_type,
            reward_description: m.reward_description,
            sort_order: m.sort_order,
          });
          if (error) console.error('Erreur insertion palier:', error);
        } else {
          const { error } = await supabase
            .from('card_milestones')
            .update({
              pm_threshold: m.pm_threshold,
              reward_type: m.reward_type,
              reward_description: m.reward_description,
              sort_order: m.sort_order,
            })
            .eq('id', m.id);
          if (error) console.error('Erreur mise à jour palier:', error);
        }
      }

      await fetchMilestones(selectedCycleId);
      setDirty(false);
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
    } finally {
      setSaving(false);
    }
  };

  /* ================================================================ */
  /* Render                                                           */
  /* ================================================================ */
  const tiers: CardTier[] = ['bronze', 'or', 'vip'];
  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);
  // Cycles other than the selected one (for copy source)
  const otherCycles = cycles.filter((c) => c.id !== selectedCycleId);

  return (
    <div className="space-y-6">
      {/* Title + Save button */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-4xl font-medium text-[#8B0000]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            Configuration des Cartes
          </h1>
          <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[#8B0000] via-[#C41E3A] to-transparent rounded-full" />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty || !selectedCycleId}
          className="h-9 px-6 bg-[#4A5D23] border-2 border-[#3E2723] rounded text-[#FAF3E3] text-sm font-medium shadow-lg hover:bg-[#3D4F1C] transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-4"
          style={{ fontFamily: "'Noto Serif JP', serif" }}
        >
          <Save size={16} />
          <span>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
        </button>
      </div>

      {/* Cycle selector */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-md px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Cycle dropdown */}
          <div className="flex items-center gap-3 flex-1 min-w-[260px]">
            <span
              className="text-sm font-bold text-[#5D4037] whitespace-nowrap"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Cycle :
            </span>
            {cyclesLoading ? (
              <span className="text-sm text-[#5D4037]">Chargement...</span>
            ) : cycles.length === 0 ? (
              <span className="text-sm text-[#8B0000] font-medium">
                Aucun cycle créé — créez d'abord un cycle dans la page Cycles.
              </span>
            ) : (
              <div className="relative flex-1 max-w-[320px]">
                <select
                  value={selectedCycleId ?? ''}
                  onChange={(e) => {
                    setSelectedCycleId(e.target.value || null);
                    setDirty(false);
                  }}
                  className="w-full h-9 px-3 pr-8 bg-[#FAF3E3] border-2 border-[#5D4037] rounded text-sm font-medium text-[#3E2723] outline-none focus:border-[#D4A017] appearance-none cursor-pointer"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.status === 'active' ? ' (actif)' : c.status === 'upcoming' ? ' (à venir)' : ' (terminé)'}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5D4037] pointer-events-none"
                />
              </div>
            )}

            {selectedCycle && (
              <span className="text-xs text-[#5D4037] bg-[#E8D5B7] border border-[#5D4037] rounded px-2 py-1 whitespace-nowrap">
                {new Date(selectedCycle.start_date).toLocaleDateString('fr-FR')} →{' '}
                {new Date(selectedCycle.end_date).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>

          {/* Copy from another cycle */}
          {otherCycles.length > 0 && selectedCycleId && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs text-[#5D4037] whitespace-nowrap"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                Copier depuis :
              </span>
              <div className="relative">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      if (window.confirm('Écraser les paliers actuels avec ceux du cycle sélectionné ?')) {
                        handleCopyFromCycle(e.target.value);
                      }
                      e.target.value = '';
                    }
                  }}
                  className="h-9 px-3 pr-8 bg-[#FAF3E3] border-2 border-[#5D4037] rounded text-xs font-medium text-[#3E2723] outline-none focus:border-[#D4A017] appearance-none cursor-pointer"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  <option value="" disabled>
                    Choisir un cycle...
                  </option>
                  {otherCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Copy
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5D4037] pointer-events-none"
                />
              </div>
              {copying && (
                <span className="text-xs text-[#5D4037] italic">Copie en cours...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main card */}
      {!selectedCycleId ? (
        <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl p-12 text-center">
          <p className="text-[#5D4037] text-base" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            Sélectionnez un cycle pour configurer ses paliers de carte.
          </p>
        </div>
      ) : (
        <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden min-w-0">
          {/* Top accent bar */}
          <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />

          {/* Tabs */}
          <div className="px-6 pt-6">
            <div className="bg-[#E8D5B7] rounded-[10px] p-2 grid grid-cols-3 gap-2">
              {tiers.map((tier) => {
                const isActive = activeTier === tier;
                const count = milestones.filter((m) => m.card_tier === tier).length;
                return (
                  <button
                    key={tier}
                    onClick={() => setActiveTier(tier)}
                    className={`h-8 rounded-[10px] border-2 border-[#5D4037] text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isActive
                        ? `${TAB_ACTIVE_BG[tier]} ${TAB_ACTIVE_TEXT[tier]} shadow-md`
                        : 'bg-[#FAF3E3] text-[#3E2723] hover:bg-[#F0E0C0]'
                    }`}
                    style={{ fontFamily: "'Noto Serif JP', serif" }}
                  >
                    {TIER_LABELS[tier]}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        isActive
                          ? 'bg-white/20 border-white/30'
                          : 'bg-[#E8D5B7] border-[#5D4037]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content area */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-16 text-[#5D4037] text-sm">
                Chargement des paliers...
              </div>
            ) : (
              <>
                {/* Milestone track */}
                <div className="overflow-x-auto pb-4" style={{ maxWidth: '100%' }}>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={tierMilestones.map((m) => m.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      <div className="flex items-start gap-8 pl-4 pt-12 min-w-max">
                        {tierMilestones.map((m, i) => (
                          <SortableMilestone
                            key={m.id}
                            m={m}
                            index={i}
                            total={tierMilestones.length}
                            onChange={handleChange}
                            onDelete={handleDelete}
                          />
                        ))}

                        {/* Add button */}
                        <div className="flex flex-col items-center justify-center gap-4 w-[200px] shrink-0 pt-0 self-center">
                          <button
                            onClick={handleAdd}
                            className="w-[80px] h-[80px] rounded-full bg-[#E8D5B7] border-4 border-[#5D4037] flex items-center justify-center hover:bg-[#DBC8A8] transition-colors cursor-pointer"
                            title="Ajouter un palier"
                          >
                            <Plus size={24} className="text-[#5D4037]" />
                          </button>
                          <p
                            className="text-sm text-[#5D4037]"
                            style={{ fontFamily: "'Noto Serif JP', serif" }}
                          >
                            Ajouter un palier
                          </p>
                        </div>
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>

                {/* Empty state */}
                {tierMilestones.length === 0 && (
                  <div className="text-center py-8 text-[#5D4037] text-sm italic">
                    Aucun palier configuré pour ce cycle — ajoutez-en ou copiez depuis un cycle précédent.
                  </div>
                )}

                {/* Instructions box */}
                <div className="mt-6 bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md px-5 py-4">
                  <p className="text-sm text-[#5D4037] leading-relaxed">
                    <span className="font-bold">Instructions :</span> Glissez-déposez les paliers
                    pour les réorganiser. Modifiez les seuils (PM), sélectionnez les types de
                    récompense et ajoutez des descriptions. Cliquez sur le bouton rouge pour
                    supprimer un palier. Chaque cycle a sa propre configuration — utilisez
                    &quot;Copier depuis&quot; pour reprendre les paliers d'un cycle précédent.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

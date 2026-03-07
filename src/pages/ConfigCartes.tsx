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
import type { CardTier, RewardType } from '../types';

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

  // gap between items is 32px, circle is 80px wide → connector must span from edge of circle to next circle
  // Each item is 217px wide, gap is 32px. Connector should go from right edge of circle to left edge of next circle.
  // Circle is centered in 217px → (217-80)/2 = 68.5px margin each side. Connector = 68.5 + 32 + 68.5 = 169px
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

        {/* Connector line to the LEFT (from previous node) */}
        {index > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-[#D4A017] to-[#8B0000] rounded-full"
            style={{ right: '100%', width: connectorWidth }}
          />
        )}
        {/* Connector line to the RIGHT (to next node) — grey background track */}
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
  const [dirty, setDirty] = useState(false);

  /* ---- DnD sensors ------------------------------------------------ */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ---- Fetch ------------------------------------------------------ */
  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('card_milestones')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Erreur chargement paliers:', error);
    }

    if (data) {
      setMilestones(data as LocalMilestone[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

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
    const existing = milestones.filter((m) => m.card_tier === activeTier);
    const maxSort = existing.length > 0 ? Math.max(...existing.map((m) => m.sort_order)) : 0;
    const maxThreshold = existing.length > 0 ? Math.max(...existing.map((m) => m.pm_threshold)) : 0;

    const newMilestone: LocalMilestone = {
      id: `new-${Date.now()}`,
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

    // Merge back
    setMilestones((prev) => {
      const others = prev.filter((m) => m.card_tier !== activeTier);
      return [...others, ...reordered];
    });
    setDirty(true);
  };

  /* ---- Save ------------------------------------------------------- */
  const handleSave = async () => {
    setSaving(true);

    try {
      // 1. Get current DB ids for this tier
      const { data: existing } = await supabase
        .from('card_milestones')
        .select('id')
        .eq('card_tier', activeTier);

      const existingIds = new Set((existing ?? []).map((e) => e.id));
      const currentIds = new Set(tierMilestones.filter((m) => !m.isNew).map((m) => m.id));

      // 2. Delete removed milestones
      const toDelete = [...existingIds].filter((id) => !currentIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase.from('card_milestones').delete().in('id', toDelete);
        if (error) console.error('Erreur suppression paliers:', error);
      }

      // 3. Upsert existing + insert new
      for (const m of tierMilestones) {
        if (m.isNew) {
          const { error } = await supabase.from('card_milestones').insert({
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

      await fetchMilestones();
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
          disabled={saving || !dirty}
          className="h-9 px-6 bg-[#4A5D23] border-2 border-[#3E2723] rounded text-[#FAF3E3] text-sm font-medium shadow-lg hover:bg-[#3D4F1C] transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-4"
          style={{ fontFamily: "'Noto Serif JP', serif" }}
        >
          <Save size={16} />
          <span>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
        </button>
      </div>

      {/* Main card */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden min-w-0">
        {/* Top accent bar */}
        <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />

        {/* Tabs */}
        <div className="px-6 pt-6">
          <div className="bg-[#E8D5B7] rounded-[10px] p-2 grid grid-cols-3 gap-2">
            {tiers.map((tier) => {
              const isActive = activeTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={`h-8 rounded-[10px] border-2 border-[#5D4037] text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? `${TAB_ACTIVE_BG[tier]} ${TAB_ACTIVE_TEXT[tier]} shadow-md`
                      : 'bg-[#FAF3E3] text-[#3E2723] hover:bg-[#F0E0C0]'
                  }`}
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  {TIER_LABELS[tier]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content area */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-16 text-[#5D4037] text-sm">Chargement des paliers...</div>
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

              {/* Instructions box */}
              <div className="mt-6 bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md px-5 py-4">
                <p className="text-sm text-[#5D4037] leading-relaxed">
                  <span className="font-bold">Instructions :</span> Glissez-déposez les paliers pour
                  les réorganiser. Modifiez les seuils (PM), sélectionnez les icônes de récompense et
                  ajoutez des descriptions. Cliquez sur le bouton &quot;×&quot; pour supprimer un
                  palier.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

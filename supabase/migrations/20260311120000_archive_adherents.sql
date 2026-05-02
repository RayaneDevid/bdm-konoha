-- ============================================
-- Migration : Archivage adhérents, points basés sur is_paid, VIP reset
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- 1. Ajouter colonne is_active sur adherents
ALTER TABLE adherents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Mettre à jour la vue adherent_cycle_points :
--    Les points ne sont attribués que quand is_paid = true
CREATE OR REPLACE VIEW adherent_cycle_points AS
  -- Points des ninjas (missions réussies ET payé)
  SELECT mn.adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM mission_ninjas mn
  JOIN missions m ON m.id = mn.mission_id
  WHERE m.status = 'reussi' AND mn.is_paid = true
UNION ALL
  -- Points de l'exécutant (missions ninja uniquement, payé)
  SELECT m.executor_adherent_id AS adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM missions m
  WHERE m.executor_adherent_id IS NOT NULL AND m.mission_type = 'ninja' AND m.executor_is_paid = true
UNION ALL
  -- Points des intervenants (missions ninja uniquement, sauf externes, payé)
  SELECT mi.adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM mission_intervenants mi
  JOIN missions m ON m.id = mi.mission_id
  WHERE mi.is_external = false AND mi.adherent_id IS NOT NULL AND m.mission_type = 'ninja' AND mi.is_paid = true;

-- 3. Mettre à jour reset_cards_for_new_cycle : archive TOUS les adhérents (y compris VIP)
CREATE OR REPLACE FUNCTION reset_cards_for_new_cycle()
RETURNS void AS $$
BEGIN
  -- Log les rétrogradations Or dans l'historique
  INSERT INTO card_evolutions (adherent_id, old_tier, new_tier, evolved_by)
  SELECT id, card_tier, 'bronze', NULL
  FROM adherents
  WHERE card_tier IN ('or', 'vip') AND is_active = true;

  -- Archive tous les adhérents actifs
  UPDATE adherents
  SET is_active = false, card_tier = 'bronze'
  WHERE is_active = true;
END;
$$ LANGUAGE plpgsql;

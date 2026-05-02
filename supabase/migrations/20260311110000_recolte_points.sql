-- ============================================
-- Migration : Missions Récolte — seuls les ninjas gagnent des PM / sont payés
-- Les exécutants et intervenants ne reçoivent ni points ni paie en récolte
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- Mise à jour de la vue adherent_cycle_points
CREATE OR REPLACE VIEW adherent_cycle_points AS
  -- Points des ninjas (UNIQUEMENT missions réussies, ninja ET récolte)
  SELECT mn.adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM mission_ninjas mn
  JOIN missions m ON m.id = mn.mission_id
  WHERE m.status = 'reussi'
UNION ALL
  -- Points de l'exécutant (missions ninja uniquement)
  SELECT m.executor_adherent_id AS adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM missions m
  WHERE m.executor_adherent_id IS NOT NULL AND m.mission_type = 'ninja'
UNION ALL
  -- Points des intervenants (missions ninja uniquement, sauf externes)
  SELECT mi.adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM mission_intervenants mi
  JOIN missions m ON m.id = mi.mission_id
  WHERE mi.is_external = false AND mi.adherent_id IS NOT NULL AND m.mission_type = 'ninja';

-- Les vues adherent_cycle_summary et adherent_total_points se basent sur adherent_cycle_points,
-- elles seront automatiquement à jour.

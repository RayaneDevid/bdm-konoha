-- ============================================
-- Migration: Mission status (reussi/echec)
--            + Auto-liaison staff → adhérent
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- ==================
-- 1. Ajout du statut de mission (réussi / échec)
-- ==================

-- Ajouter la colonne status aux missions (défaut: 'reussi')
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reussi'
  CHECK (status IN ('reussi', 'echec'));

-- ==================
-- 2. Mettre à jour les vues pour exclure les points ninjas sur missions en échec
-- ==================

-- La vue adherent_cycle_points doit :
--   - Toujours donner les points à l'exécutant et aux intervenants (même si échec)
--   - Ne donner les points aux ninjas QUE si la mission est réussie
CREATE OR REPLACE VIEW adherent_cycle_points AS
  -- Points des ninjas (UNIQUEMENT missions réussies)
  SELECT mn.adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM mission_ninjas mn
  JOIN missions m ON m.id = mn.mission_id
  WHERE m.status = 'reussi'
UNION ALL
  -- Points de l'exécutant (toujours, même si échec)
  SELECT m.executor_adherent_id AS adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM missions m
  WHERE m.executor_adherent_id IS NOT NULL
UNION ALL
  -- Points des intervenants (toujours, même si échec, sauf externes)
  SELECT mi.adherent_id, m.cycle_id, m.id AS mission_id, m.points
  FROM mission_intervenants mi
  JOIN missions m ON m.id = mi.mission_id
  WHERE mi.is_external = false AND mi.adherent_id IS NOT NULL;

-- Les vues agrégées n'ont pas besoin de changer car elles se basent sur adherent_cycle_points

-- ==================
-- 3. Auto-liaison staff → adhérent
-- ==================

-- 3a. Créer des fiches adhérent pour les staff existants qui n'en ont pas
DO $$
DECLARE
  staff RECORD;
  new_adherent_id UUID;
BEGIN
  FOR staff IN
    SELECT id, first_name, last_name
    FROM staff_users
    WHERE adherent_id IS NULL
  LOOP
    INSERT INTO adherents (first_name, last_name, card_tier)
    VALUES (staff.first_name, staff.last_name, 'bronze')
    RETURNING id INTO new_adherent_id;

    UPDATE staff_users
    SET adherent_id = new_adherent_id
    WHERE id = staff.id;
  END LOOP;
END $$;

-- 3b. Mettre à jour le trigger handle_new_user pour aussi créer la fiche adhérent
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_staff_id UUID;
  new_adherent_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_role TEXT;
BEGIN
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'membre_bdm');

  -- 1. Créer la fiche adhérent
  INSERT INTO public.adherents (first_name, last_name, card_tier)
  VALUES (v_first_name, v_last_name, 'bronze')
  RETURNING id INTO new_adherent_id;

  -- 2. Créer le staff_user avec le lien vers l'adhérent
  INSERT INTO public.staff_users (auth_user_id, email, first_name, last_name, role, adherent_id)
  VALUES (NEW.id, NEW.email, v_first_name, v_last_name, v_role, new_adherent_id)
  RETURNING id INTO new_staff_id;

  -- 3. Mettre à jour distributed_by sur l'adhérent (auto-distribution par lui-même)
  UPDATE public.adherents SET distributed_by = new_staff_id WHERE id = new_adherent_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3c. Mettre à jour les mission_intervenants existants qui ont un staff_id
--     mais pas d'adherent_id (c'est le bug qui fait que les intervenants ne
--     reçoivent pas de points)
UPDATE mission_intervenants mi
SET adherent_id = su.adherent_id
FROM staff_users su
WHERE mi.staff_id = su.id
  AND mi.adherent_id IS NULL
  AND su.adherent_id IS NOT NULL;

-- 3d. Mettre à jour executor_adherent_id sur les missions existantes
--     (au cas où le trigger trg_executor_adherent n'ait pas trouvé l'adherent_id)
UPDATE missions m
SET executor_adherent_id = su.adherent_id
FROM staff_users su
WHERE m.executor_id = su.id
  AND m.executor_adherent_id IS NULL
  AND su.adherent_id IS NOT NULL;

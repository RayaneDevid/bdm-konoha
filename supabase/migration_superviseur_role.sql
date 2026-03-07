-- Migration: Ajout du rôle "superviseur" (webmaster, au-dessus de tous les autres rôles)
-- À exécuter sur Supabase SQL Editor

-- 1. Modifier la contrainte CHECK sur staff_users.role
ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_role_check;
ALTER TABLE staff_users ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('superviseur', 'gerant', 'co-gerant', 'membre_bdm'));

-- 2. Mettre à jour les RLS policies pour inclure superviseur

-- staff_users : insert
DROP POLICY IF EXISTS "staff_users_insert" ON staff_users;
CREATE POLICY "staff_users_insert" ON staff_users FOR INSERT
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

-- staff_users : update
DROP POLICY IF EXISTS "staff_users_update" ON staff_users;
CREATE POLICY "staff_users_update" ON staff_users FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

-- cycles : insert
DROP POLICY IF EXISTS "cycles_insert" ON cycles;
CREATE POLICY "cycles_insert" ON cycles FOR INSERT
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant'));

-- cycles : update
DROP POLICY IF EXISTS "cycles_update" ON cycles;
CREATE POLICY "cycles_update" ON cycles FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant'));

-- mission_intervenants : update
DROP POLICY IF EXISTS "mission_intervenants_update" ON mission_intervenants;
CREATE POLICY "mission_intervenants_update" ON mission_intervenants FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

-- mission_ninjas : update
DROP POLICY IF EXISTS "mission_ninjas_update" ON mission_ninjas;
CREATE POLICY "mission_ninjas_update" ON mission_ninjas FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

-- card_milestones : insert
DROP POLICY IF EXISTS "card_milestones_insert" ON card_milestones;
CREATE POLICY "card_milestones_insert" ON card_milestones FOR INSERT
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant'));

-- card_milestones : update
DROP POLICY IF EXISTS "card_milestones_update" ON card_milestones;
CREATE POLICY "card_milestones_update" ON card_milestones FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant'));

-- card_milestones : delete
DROP POLICY IF EXISTS "card_milestones_delete" ON card_milestones;
CREATE POLICY "card_milestones_delete" ON card_milestones FOR DELETE
  USING (get_current_role() IN ('superviseur', 'gerant'));

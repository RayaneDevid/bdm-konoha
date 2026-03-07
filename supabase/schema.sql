-- ============================================
-- Bureau des Missions de Konoha — Schema SQL
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- ==================
-- 1. TABLES
-- ==================

-- Utilisateurs staff (accès au site)
CREATE TABLE staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gerant', 'co-gerant', 'membre_bdm')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Adhérents (joueurs, pas d'accès au site)
CREATE TABLE adherents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  card_tier TEXT NOT NULL CHECK (card_tier IN ('bronze', 'or', 'vip')) DEFAULT 'bronze',
  distributed_by UUID REFERENCES staff_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lien staff → adhérent (chaque staff est aussi un adhérent)
ALTER TABLE staff_users ADD COLUMN adherent_id UUID REFERENCES adherents(id);

-- Historique d'évolutions de carte
CREATE TABLE card_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adherent_id UUID REFERENCES adherents(id) ON DELETE CASCADE,
  old_tier TEXT NOT NULL,
  new_tier TEXT NOT NULL,
  evolved_by UUID REFERENCES staff_users(id), -- NULL = reset automatique par le système
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cycles (périodes de 3 semaines)
CREATE TABLE cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'upcoming')) DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Missions
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
  mission_date DATE NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('ninja', 'recolte')),
  rank TEXT NOT NULL CHECK (rank IN ('D', 'C', 'B', 'A', 'S')),
  points INTEGER NOT NULL,
  executor_id UUID REFERENCES staff_users(id),
  executor_adherent_id UUID REFERENCES adherents(id),
  executor_is_paid BOOLEAN DEFAULT false,
  executor_paid_marked_by UUID REFERENCES staff_users(id),
  status TEXT NOT NULL DEFAULT 'reussi' CHECK (status IN ('reussi', 'echec')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Intervenants d'une mission
CREATE TABLE mission_intervenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff_users(id),
  adherent_id UUID REFERENCES adherents(id),
  is_external BOOLEAN DEFAULT false,
  is_paid BOOLEAN DEFAULT false,
  paid_marked_by UUID REFERENCES staff_users(id)
);

-- Ninjas assignés à une mission
CREATE TABLE mission_ninjas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  adherent_id UUID REFERENCES adherents(id),
  is_paid BOOLEAN DEFAULT false,
  paid_marked_by UUID REFERENCES staff_users(id)
);

-- Configuration des paliers de carte
CREATE TABLE card_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_tier TEXT NOT NULL CHECK (card_tier IN ('bronze', 'or', 'vip')),
  pm_threshold INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('ryos', 'equipement', 'outfit', 'kunais', 'pieces_merite', 'autre')),
  reward_description TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Récompenses réclamées par adhérent par cycle
CREATE TABLE claimed_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adherent_id UUID REFERENCES adherents(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES card_milestones(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  claimed_by UUID REFERENCES staff_users(id),
  UNIQUE(adherent_id, cycle_id, milestone_id)
);

-- ==================
-- 2. FONCTIONS & TRIGGERS
-- ==================

-- Calcul automatique des points selon le rang
CREATE OR REPLACE FUNCTION get_rank_points(mission_rank TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE mission_rank
    WHEN 'D' THEN 40
    WHEN 'C' THEN 70
    WHEN 'B' THEN 130
    WHEN 'A' THEN 280
    WHEN 'S' THEN 700
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_mission_points()
RETURNS TRIGGER AS $$
BEGIN
  NEW.points := get_rank_points(NEW.rank);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mission_points
BEFORE INSERT OR UPDATE ON missions
FOR EACH ROW EXECUTE FUNCTION set_mission_points();

-- Auto-lier executor_adherent_id depuis executor_id
CREATE OR REPLACE FUNCTION set_executor_adherent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.executor_id IS NOT NULL THEN
    SELECT adherent_id INTO NEW.executor_adherent_id
    FROM staff_users WHERE id = NEW.executor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_executor_adherent
BEFORE INSERT OR UPDATE ON missions
FOR EACH ROW EXECUTE FUNCTION set_executor_adherent();

-- Sync Auth → staff_users à l'inscription
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

  -- 3. Mettre à jour distributed_by sur l'adhérent
  UPDATE public.adherents SET distributed_by = new_staff_id WHERE id = new_adherent_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Reset des cartes au nouveau cycle (Bronze pour tous sauf VIP)
CREATE OR REPLACE FUNCTION reset_cards_for_new_cycle()
RETURNS void AS $$
BEGIN
  -- Log les rétrogradations dans l'historique
  INSERT INTO card_evolutions (adherent_id, old_tier, new_tier, evolved_by)
  SELECT id, card_tier, 'bronze', NULL
  FROM adherents
  WHERE card_tier = 'or';

  -- Rétrograde les Or en Bronze
  UPDATE adherents
  SET card_tier = 'bronze'
  WHERE card_tier = 'or';
END;
$$ LANGUAGE plpgsql;

-- ==================
-- 3. VUES
-- ==================

-- Points par adhérent par cycle (tous participants confondus)
-- Règles : 
--   Ninja missions : ninjas (si réussie), exécutant (toujours), intervenants (toujours)
--   Récolte missions : UNIQUEMENT les ninjas (si réussie)
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

-- Résumé agrégé par adhérent par cycle
CREATE OR REPLACE VIEW adherent_cycle_summary AS
SELECT
  adherent_id,
  cycle_id,
  COUNT(mission_id) AS mission_count,
  SUM(points) AS total_points
FROM adherent_cycle_points
GROUP BY adherent_id, cycle_id;

-- Cumul tous cycles (stats générales)
CREATE OR REPLACE VIEW adherent_total_points AS
SELECT
  adherent_id,
  COUNT(mission_id) AS total_missions,
  SUM(points) AS total_points
FROM adherent_cycle_points
GROUP BY adherent_id;

-- ==================
-- 4. RLS (Row Level Security)
-- ==================

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE adherents ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_intervenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_ninjas ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE claimed_rewards ENABLE ROW LEVEL SECURITY;

-- Helper : récupérer le rôle du user connecté
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS TEXT AS $$
  SELECT role FROM staff_users WHERE auth_user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- IMPORTANT: on utilise auth.uid() IS NOT NULL (pas de sous-select sur staff_users)
-- pour eviter la recursion infinie dans les policies RLS.
-- La verification du role se fait via get_current_role() (SECURITY DEFINER, pas soumis aux RLS).

-- staff_users : lecture par tous les authentifies, modification par gérant/co-gérant
CREATE POLICY "staff_users_select" ON staff_users FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "staff_users_insert" ON staff_users FOR INSERT
  WITH CHECK (get_current_role() IN ('gerant', 'co-gerant'));

CREATE POLICY "staff_users_update" ON staff_users FOR UPDATE
  USING (get_current_role() IN ('gerant', 'co-gerant'));

-- adherents : lecture/écriture par tous les authentifies
CREATE POLICY "adherents_select" ON adherents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "adherents_insert" ON adherents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "adherents_update" ON adherents FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- card_evolutions : lecture/écriture par tous les authentifies
CREATE POLICY "card_evolutions_select" ON card_evolutions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "card_evolutions_insert" ON card_evolutions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- cycles : lecture par tous, écriture par gérant uniquement
CREATE POLICY "cycles_select" ON cycles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cycles_insert" ON cycles FOR INSERT
  WITH CHECK (get_current_role() = 'gerant');

CREATE POLICY "cycles_update" ON cycles FOR UPDATE
  USING (get_current_role() = 'gerant');

-- missions : lecture/écriture par tous les authentifies, update paiement via app logic
CREATE POLICY "missions_select" ON missions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "missions_insert" ON missions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "missions_update" ON missions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- mission_intervenants : lecture/insert par tous, update paiement par gérant/co-gérant
CREATE POLICY "mission_intervenants_select" ON mission_intervenants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "mission_intervenants_insert" ON mission_intervenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "mission_intervenants_update" ON mission_intervenants FOR UPDATE
  USING (get_current_role() IN ('gerant', 'co-gerant'));

-- mission_ninjas : lecture/insert par tous, update paiement par gérant/co-gérant
CREATE POLICY "mission_ninjas_select" ON mission_ninjas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "mission_ninjas_insert" ON mission_ninjas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "mission_ninjas_update" ON mission_ninjas FOR UPDATE
  USING (get_current_role() IN ('gerant', 'co-gerant'));

-- card_milestones : lecture par tous, écriture par gérant uniquement
CREATE POLICY "card_milestones_select" ON card_milestones FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "card_milestones_insert" ON card_milestones FOR INSERT
  WITH CHECK (get_current_role() = 'gerant');

CREATE POLICY "card_milestones_update" ON card_milestones FOR UPDATE
  USING (get_current_role() = 'gerant');

CREATE POLICY "card_milestones_delete" ON card_milestones FOR DELETE
  USING (get_current_role() = 'gerant');

-- claimed_rewards : lecture/écriture par tous les authentifies
CREATE POLICY "claimed_rewards_select" ON claimed_rewards FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "claimed_rewards_insert" ON claimed_rewards FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ==================
-- 5. SEED — Paliers de cartes
-- ==================

-- Bronze (Pass Mérite CADET — gratuit)
INSERT INTO card_milestones (card_tier, pm_threshold, reward_type, reward_description, sort_order) VALUES
  ('bronze', 100, 'autre', '5 bols de ramen royal', 1),
  ('bronze', 200, 'ryos', '500 Ryos', 2),
  ('bronze', 300, 'equipement', '1 équipement T1 au choix', 3),
  ('bronze', 400, 'ryos', '1000 Ryos', 4),
  ('bronze', 500, 'kunais', '25 kunais', 5),
  ('bronze', 600, 'ryos', '2000 Ryos', 6),
  ('bronze', 700, 'equipement', '3 équipements T1 au choix', 7),
  ('bronze', 800, 'outfit', '1 tenue commune', 8),
  ('bronze', 900, 'pieces_merite', '1 pièce mérite', 9),
  ('bronze', 1000, 'ryos', '5000 Ryos', 10);

-- Or (Pass Mérite SUPRÊME — 30 000 ryos, valable 1 cycle)
INSERT INTO card_milestones (card_tier, pm_threshold, reward_type, reward_description, sort_order) VALUES
  ('or', 250, 'ryos', '1500 Ryos', 1),
  ('or', 500, 'pieces_merite', '2 pièces mérite', 2),
  ('or', 750, 'outfit', '1 tenue rare', 3),
  ('or', 1000, 'kunais', '500 kunais', 4),
  ('or', 1250, 'ryos', '3000 Ryos', 5),
  ('or', 1500, 'ryos', '5000 Ryos', 6),
  ('or', 1750, 'pieces_merite', '3 pièces mérite', 7),
  ('or', 2000, 'equipement', '3 équipements T3', 8),
  ('or', 2250, 'ryos', '10000 Ryos', 9),
  ('or', 2500, 'outfit', '1 tenue exclusive BDM', 10);

-- VIP (Pass Mérite LÉGENDE — 120 000 ryos, permanent à vie)
INSERT INTO card_milestones (card_tier, pm_threshold, reward_type, reward_description, sort_order) VALUES
  ('vip', 300, 'ryos', '7500 Ryos', 1),
  ('vip', 600, 'ryos', '10000 Ryos', 2),
  ('vip', 900, 'outfit', '1 tenue épique', 3),
  ('vip', 1200, 'equipement', '1 équipement T3', 4),
  ('vip', 1500, 'pieces_merite', '5 pièces mérite', 5),
  ('vip', 1800, 'outfit', '1 tenue exclusive BDM', 6),
  ('vip', 2000, 'ryos', '15000 Ryos', 7),
  ('vip', 2250, 'pieces_merite', '10 pièces mérite', 8),
  ('vip', 2500, 'equipement', '3 équipements T4', 9),
  ('vip', 2800, 'ryos', '50000 Ryos', 10);

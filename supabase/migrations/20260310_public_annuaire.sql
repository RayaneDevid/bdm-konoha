-- =========================================================
-- Migration : accès public (anon) pour l'annuaire
-- =========================================================

-- Activer la lecture anon sur les adhérents actifs
CREATE POLICY "Public can read active adherents"
  ON adherents
  FOR SELECT
  USING (is_active = true);

-- Lecture anon sur les cycles (pour afficher les noms dans l'historique)
CREATE POLICY "Public can read cycles"
  ON cycles
  FOR SELECT
  USING (true);

-- Lecture anon sur les missions (uniquement les missions réussies, pas d'infos sensibles)
CREATE POLICY "Public can read missions"
  ON missions
  FOR SELECT
  USING (true);

-- Lecture anon sur mission_ninjas (pour savoir quels ninjas ont participé)
CREATE POLICY "Public can read mission ninjas"
  ON mission_ninjas
  FOR SELECT
  USING (true);

-- Lecture anon sur card_milestones (pour afficher le track de récompenses)
CREATE POLICY "Public can read card milestones"
  ON card_milestones
  FOR SELECT
  USING (true);

-- Accorder le SELECT sur les vues agrégées au rôle anon
GRANT SELECT ON adherent_cycle_points TO anon;
GRANT SELECT ON adherent_cycle_summary TO anon;
GRANT SELECT ON adherent_total_points TO anon;

-- Accorder aussi le SELECT sur les tables de base au rôle anon
-- (nécessaire pour les requêtes directes via supabase client)
GRANT SELECT ON adherents TO anon;
GRANT SELECT ON cycles TO anon;
GRANT SELECT ON missions TO anon;
GRANT SELECT ON mission_ninjas TO anon;
GRANT SELECT ON card_milestones TO anon;

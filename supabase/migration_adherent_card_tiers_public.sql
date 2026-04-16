-- ================================================================
-- Migration : adherent_card_tiers + fix accès public annuaire
-- À exécuter dans Supabase SQL Editor
-- Idempotent (safe to re-run)
-- ================================================================

-- ---------------------------------------------------------------
-- 1. Table adherent_card_tiers (tier de carte par adhérent/cycle)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adherent_card_tiers (
  adherent_id UUID REFERENCES adherents(id) ON DELETE CASCADE,
  cycle_id    UUID REFERENCES cycles(id) ON DELETE CASCADE,
  card_tier   TEXT NOT NULL CHECK (card_tier IN ('aucun', 'bronze', 'argent', 'or', 'vip')) DEFAULT 'aucun',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (adherent_id, cycle_id)
);

ALTER TABLE adherent_card_tiers ENABLE ROW LEVEL SECURITY;

-- Policies utilisateurs connectés
DROP POLICY IF EXISTS "adherent_card_tiers_select" ON adherent_card_tiers;
CREATE POLICY "adherent_card_tiers_select" ON adherent_card_tiers
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "adherent_card_tiers_insert" ON adherent_card_tiers;
CREATE POLICY "adherent_card_tiers_insert" ON adherent_card_tiers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "adherent_card_tiers_update" ON adherent_card_tiers;
CREATE POLICY "adherent_card_tiers_update" ON adherent_card_tiers
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------
-- 2. Accès public (anon) sur adherent_card_tiers
--    Nécessaire pour l'annuaire public et la fiche adhérent
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read adherent card tiers" ON adherent_card_tiers;
CREATE POLICY "Public can read adherent card tiers"
  ON adherent_card_tiers FOR SELECT USING (true);

GRANT SELECT ON adherent_card_tiers TO anon;

-- ---------------------------------------------------------------
-- 3. Fix : accès public sur adherents sans filtre is_active
--    L'ancienne policy "Public can read active adherents" bloquait
--    les adhérents du cycle 1 (is_active = false après le reset RPC)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read active adherents" ON adherents;
DROP POLICY IF EXISTS "Public can read all adherents" ON adherents;
CREATE POLICY "Public can read all adherents"
  ON adherents FOR SELECT USING (true);

-- ---------------------------------------------------------------
-- 4. Peupler adherent_card_tiers depuis l'historique card_evolutions
--    (évolutions manuelles — evolved_by IS NOT NULL)
--    Prend le DERNIER tier connu pour chaque adhérent dans chaque cycle
-- ---------------------------------------------------------------
INSERT INTO adherent_card_tiers (adherent_id, cycle_id, card_tier)
SELECT DISTINCT ON (ce.adherent_id, c.id)
  ce.adherent_id,
  c.id        AS cycle_id,
  ce.new_tier AS card_tier
FROM card_evolutions ce
JOIN cycles c
  ON ce.created_at::date BETWEEN c.start_date AND c.end_date
WHERE ce.evolved_by IS NOT NULL
ORDER BY ce.adherent_id, c.id, ce.created_at DESC
ON CONFLICT (adherent_id, cycle_id) DO NOTHING;

-- ---------------------------------------------------------------
-- 5. Resets automatiques (evolved_by IS NULL) : old_tier → cycle précédent
--    Le reset s'effectue au début d'un nouveau cycle ;
--    old_tier était le tier à la fin du cycle précédent
-- ---------------------------------------------------------------
INSERT INTO adherent_card_tiers (adherent_id, cycle_id, card_tier)
SELECT DISTINCT ON (ce.adherent_id, prev_cycle.id)
  ce.adherent_id,
  prev_cycle.id AS cycle_id,
  ce.old_tier   AS card_tier
FROM card_evolutions ce
CROSS JOIN LATERAL (
  SELECT id FROM cycles
  WHERE end_date < ce.created_at::date
  ORDER BY end_date DESC
  LIMIT 1
) prev_cycle
WHERE ce.evolved_by IS NULL
ORDER BY ce.adherent_id, prev_cycle.id, ce.created_at DESC
ON CONFLICT (adherent_id, cycle_id) DO NOTHING;

-- ---------------------------------------------------------------
-- 6. Adhérents bronze créés pendant un cycle terminé sans évolution
--    (ils n'ont pas d'entrée dans card_evolutions)
-- ---------------------------------------------------------------
INSERT INTO adherent_card_tiers (adherent_id, cycle_id, card_tier)
SELECT a.id, c.id, 'bronze'
FROM adherents a
JOIN cycles c ON a.created_at::date BETWEEN c.start_date AND c.end_date
WHERE c.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM adherent_card_tiers act
    WHERE act.adherent_id = a.id AND act.cycle_id = c.id
  )
ON CONFLICT (adherent_id, cycle_id) DO NOTHING;

-- ---------------------------------------------------------------
-- 7. Adhérents actifs du cycle en cours (depuis adherents.card_tier)
--    Pour les adhérents créés APRÈS la mise en place de cette migration
-- ---------------------------------------------------------------
INSERT INTO adherent_card_tiers (adherent_id, cycle_id, card_tier)
SELECT a.id, c.id, a.card_tier
FROM adherents a
CROSS JOIN LATERAL (
  SELECT id FROM cycles
  WHERE start_date <= CURRENT_DATE AND CURRENT_DATE <= end_date
  LIMIT 1
) c
WHERE a.is_active = true
ON CONFLICT (adherent_id, cycle_id) DO NOTHING;

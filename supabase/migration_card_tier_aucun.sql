-- ============================================================
-- Migration : ajout du niveau de carte "aucun"
-- Permet de créer un adhérent sans niveau de carte associé.
-- Aucune récompense n'est liée à ce niveau.
-- ============================================================

-- Supprime l'ancienne contrainte et la remplace
ALTER TABLE adherents
  DROP CONSTRAINT IF EXISTS adherents_card_tier_check;

ALTER TABLE adherents
  ADD CONSTRAINT adherents_card_tier_check
    CHECK (card_tier IN ('aucun', 'bronze', 'argent', 'or', 'vip'));

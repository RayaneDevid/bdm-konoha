-- ============================================================
-- Migration : permissions des membres BDM
-- - Les membres BDM peuvent modifier les missions déjà envoyées.
-- - Les membres BDM peuvent créer des adhérents uniquement en "aucun" ou "bronze".
-- ============================================================

-- Missions : tous les staff actifs peuvent créer / modifier une mission.
DROP POLICY IF EXISTS "missions_insert" ON missions;
CREATE POLICY "missions_insert" ON missions FOR INSERT
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant', 'membre_bdm'));

DROP POLICY IF EXISTS "missions_update" ON missions;
CREATE POLICY "missions_update" ON missions FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant', 'membre_bdm'))
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant', 'membre_bdm'));

-- L'édition d'une mission remplace les lignes liées.
DROP POLICY IF EXISTS "mission_intervenants_insert" ON mission_intervenants;
CREATE POLICY "mission_intervenants_insert" ON mission_intervenants FOR INSERT
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant', 'membre_bdm'));

DROP POLICY IF EXISTS "mission_intervenants_delete" ON mission_intervenants;
CREATE POLICY "mission_intervenants_delete" ON mission_intervenants FOR DELETE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant', 'membre_bdm'));

DROP POLICY IF EXISTS "mission_ninjas_insert" ON mission_ninjas;
CREATE POLICY "mission_ninjas_insert" ON mission_ninjas FOR INSERT
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant', 'membre_bdm'));

DROP POLICY IF EXISTS "mission_ninjas_delete" ON mission_ninjas;
CREATE POLICY "mission_ninjas_delete" ON mission_ninjas FOR DELETE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant', 'membre_bdm'));

-- Les validations de paiement restent réservées superviseur/gérant/co-gérant.
DROP POLICY IF EXISTS "mission_intervenants_update" ON mission_intervenants;
CREATE POLICY "mission_intervenants_update" ON mission_intervenants FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'))
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

DROP POLICY IF EXISTS "mission_ninjas_update" ON mission_ninjas;
CREATE POLICY "mission_ninjas_update" ON mission_ninjas FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'))
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

-- La table missions porte aussi le paiement de l'exécutant : les membres BDM
-- peuvent modifier la mission, mais pas valider ce paiement.
CREATE OR REPLACE FUNCTION prevent_membre_bdm_executor_payment_update()
RETURNS TRIGGER AS $$
BEGIN
  IF get_current_role() = 'membre_bdm'
    AND (
      NEW.executor_is_paid IS DISTINCT FROM OLD.executor_is_paid
      OR NEW.executor_paid_marked_by IS DISTINCT FROM OLD.executor_paid_marked_by
    )
  THEN
    RAISE EXCEPTION 'Les membres BDM ne peuvent pas valider le paiement de l''exécutant.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_membre_bdm_executor_payment_update ON missions;
CREATE TRIGGER trg_prevent_membre_bdm_executor_payment_update
BEFORE UPDATE ON missions
FOR EACH ROW
EXECUTE FUNCTION prevent_membre_bdm_executor_payment_update();

-- Adhérents : les managers peuvent créer tout niveau, les membres BDM seulement aucun/bronze.
DROP POLICY IF EXISTS "adherents_insert" ON adherents;
CREATE POLICY "adherents_insert" ON adherents FOR INSERT
  WITH CHECK (
    get_current_role() IN ('superviseur', 'gerant', 'co-gerant')
    OR (
      get_current_role() = 'membre_bdm'
      AND card_tier IN ('aucun', 'bronze')
    )
  );

DROP POLICY IF EXISTS "adherents_update" ON adherents;
CREATE POLICY "adherents_update" ON adherents FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'))
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

DROP POLICY IF EXISTS "adherent_card_tiers_insert" ON adherent_card_tiers;
CREATE POLICY "adherent_card_tiers_insert" ON adherent_card_tiers FOR INSERT
  WITH CHECK (
    get_current_role() IN ('superviseur', 'gerant', 'co-gerant')
    OR (
      get_current_role() = 'membre_bdm'
      AND card_tier IN ('aucun', 'bronze')
    )
  );

-- Les changements de niveau après création restent réservés aux managers.
DROP POLICY IF EXISTS "adherent_card_tiers_update" ON adherent_card_tiers;
CREATE POLICY "adherent_card_tiers_update" ON adherent_card_tiers FOR UPDATE
  USING (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'))
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

DROP POLICY IF EXISTS "card_evolutions_insert" ON card_evolutions;
CREATE POLICY "card_evolutions_insert" ON card_evolutions FOR INSERT
  WITH CHECK (get_current_role() IN ('superviseur', 'gerant', 'co-gerant'));

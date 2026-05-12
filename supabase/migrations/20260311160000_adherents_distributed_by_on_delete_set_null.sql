-- ============================================================
-- Migration : laisser supprimer un staff qui a distribué des cartes
-- Les adhérents restent conservés ; distributed_by est simplement vidé.
-- ============================================================

ALTER TABLE adherents
  DROP CONSTRAINT IF EXISTS adherents_distributed_by_fkey;

ALTER TABLE adherents
  ADD CONSTRAINT adherents_distributed_by_fkey
  FOREIGN KEY (distributed_by)
  REFERENCES staff_users(id)
  ON DELETE SET NULL;

-- ============================================================
-- Migration : handle_new_user supporte le lien à un adhérent existant
-- Si adherent_id est passé dans les métadonnées, on ne crée pas
-- de nouveau profil adhérent — on lie le staff_user à l'existant.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_staff_id UUID;
  new_adherent_id UUID;
  existing_adherent_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_role TEXT;
BEGIN
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name  := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_role       := COALESCE(NEW.raw_user_meta_data->>'role', 'membre_bdm');

  -- Vérifie si un adherent_id existant est fourni
  BEGIN
    existing_adherent_id := (NEW.raw_user_meta_data->>'adherent_id')::UUID;
  EXCEPTION WHEN others THEN
    existing_adherent_id := NULL;
  END;

  IF existing_adherent_id IS NOT NULL THEN
    -- Utilise le profil adhérent existant
    new_adherent_id := existing_adherent_id;

    INSERT INTO public.staff_users (auth_user_id, email, first_name, last_name, role, adherent_id)
    VALUES (NEW.id, NEW.email, v_first_name, v_last_name, v_role, new_adherent_id)
    RETURNING id INTO new_staff_id;

  ELSE
    -- Crée un nouveau profil adhérent
    INSERT INTO public.adherents (first_name, last_name, card_tier)
    VALUES (v_first_name, v_last_name, 'bronze')
    RETURNING id INTO new_adherent_id;

    INSERT INTO public.staff_users (auth_user_id, email, first_name, last_name, role, adherent_id)
    VALUES (NEW.id, NEW.email, v_first_name, v_last_name, v_role, new_adherent_id)
    RETURNING id INTO new_staff_id;

    -- Met à jour distributed_by sur le nouvel adhérent
    UPDATE public.adherents SET distributed_by = new_staff_id WHERE id = new_adherent_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

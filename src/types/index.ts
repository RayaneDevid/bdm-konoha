export type Role = 'superviseur' | 'gerant' | 'co-gerant' | 'membre_bdm';
export type CardTier = 'bronze' | 'argent' | 'or' | 'vip';
export type MissionType = 'ninja' | 'recolte' | 'passation';
export type MissionRank = 'D' | 'C' | 'B' | 'A' | 'S';
export type CycleStatus = 'active' | 'completed' | 'upcoming';
export type RewardType = 'ryos' | 'equipement' | 'outfit' | 'kunais' | 'pieces_merite' | 'autre';
export type MissionStatus = 'reussi' | 'echec';
export type PassationType = 'chunin' | 'genin_confirme';

export interface StaffUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  auth_user_id: string;
  adherent_id: string | null;
}

export interface Adherent {
  id: string;
  first_name: string;
  last_name: string;
  card_tier: CardTier;
  distributed_by: string;
  is_active: boolean;
  created_at: string;
}

export interface CardEvolution {
  id: string;
  adherent_id: string;
  old_tier: CardTier;
  new_tier: CardTier;
  evolved_by: string;
  created_at: string;
}

export interface Cycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: CycleStatus;
  created_at: string;
}

export interface Mission {
  id: string;
  cycle_id: string;
  mission_date: string;
  mission_type: MissionType;
  passation_type: PassationType | null;
  rank: MissionRank;
  points: number;
  mission_link: string;
  executor_id: string;
  executor_adherent_id: string | null;
  executor_is_paid: boolean;
  executor_paid_marked_by: string | null;
  status: MissionStatus;
  created_at: string;
}

export interface MissionIntervenant {
  id: string;
  mission_id: string;
  staff_id: string | null;
  adherent_id: string | null;
  is_external: boolean;
  is_paid: boolean;
  paid_marked_by: string | null;
}

export interface MissionNinja {
  id: string;
  mission_id: string;
  adherent_id: string;
  is_paid: boolean;
  paid_marked_by: string | null;
}

export interface CardMilestone {
  id: string;
  cycle_id: string | null;
  card_tier: CardTier;
  pm_threshold: number;
  reward_type: RewardType;
  reward_description: string;
  sort_order: number;
  created_at: string;
}

export interface ClaimedReward {
  id: string;
  adherent_id: string;
  cycle_id: string;
  milestone_id: string;
  claimed_at: string;
  claimed_by: string;
}

import type { MissionRank, CardTier, Role, RewardType, MissionStatus } from '../types';

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  reussi: 'Réussi',
  echec: 'Échec',
};

export const MISSION_STATUS_COLORS: Record<MissionStatus, { bg: string; text: string; border: string }> = {
  reussi: { bg: '#4A5D23', text: '#FAF3E3', border: '#3E4F1A' },
  echec: { bg: '#C62828', text: '#FAF3E3', border: '#8B0000' },
};

export const RANK_POINTS: Record<MissionRank, number> = {
  D: 40,
  C: 70,
  B: 130,
  A: 280,
  S: 700,
};

export const RANK_COLORS: Record<MissionRank, string> = {
  D: '#9E9E9E',
  C: '#1565C0',
  B: '#2E7D32',
  A: '#C62828',
  S: '#D4A017',
};

export const TIER_COLORS: Record<CardTier, string> = {
  bronze: '#CD7F32',
  argent: '#A8A9AD',
  or: '#D4A017',
  vip: '#7B1FA2',
};

export const TIER_LABELS: Record<CardTier, string> = {
  bronze: 'Bronze',
  argent: 'Argent',
  or: 'Or',
  vip: 'VIP',
};

export const ROLE_COLORS: Record<Role, string> = {
  superviseur: '#6A0DAD',
  gerant: '#C41E3A',
  'co-gerant': '#E67E22',
  membre_bdm: '#1565C0',
};

export const ROLE_LABELS: Record<Role, string> = {
  superviseur: 'Superviseur',
  gerant: 'Gérant BDM',
  'co-gerant': 'Co-gérant',
  membre_bdm: 'Membre BDM',
};

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  ryos: 'Ryos (Coins)',
  equipement: 'Équipement',
  outfit: 'Outfit / Tenue',
  kunais: 'Kunais',
  pieces_merite: 'Pièces de mérite',
  autre: 'Autre',
};

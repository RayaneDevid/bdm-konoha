export type VillageId = 'konoha' | 'kiri' | 'suna' | 'oto' | 'samurai';

type VillageConfig = {
  id: VillageId;
  name: 'Konoha' | 'Kiri' | 'Suna' | 'Oto' | 'Samurai';
  roleGerantColor: string;
};

const VILLAGES: Record<VillageId, VillageConfig> = {
  konoha: {
    id: 'konoha',
    name: 'Konoha',
    roleGerantColor: '#C41E3A',
  },
  kiri: {
    id: 'kiri',
    name: 'Kiri',
    roleGerantColor: '#1565C0',
  },
  suna: {
    id: 'suna',
    name: 'Suna',
    roleGerantColor: '#B88722',
  },
  oto: {
    id: 'oto',
    name: 'Oto',
    roleGerantColor: '#7B1FA2',
  },
  samurai: {
    id: 'samurai',
    name: 'Samurai',
    roleGerantColor: '#C2185B',
  },
};

function normalizeVillage(value: string | undefined): VillageId {
  const village = value?.trim().toLowerCase();

  if (village === 'kiri' || village === 'suna' || village === 'oto' || village === 'samurai') {
    return village;
  }

  return 'konoha';
}

export const VILLAGE = VILLAGES[normalizeVillage(import.meta.env.VITE_VILLAGE)];

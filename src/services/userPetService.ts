import { apiClient } from './apiClient';

export type UserPetSex = 'male' | 'female' | 'unknown';

export interface UserPetBreed {
  id: string;
  name: string;
  species: 'cat' | 'dog';
}

export interface UserPet {
  id: string;
  userId: string;
  breedId: string;
  breed: UserPetBreed | null;
  name: string;
  birthday: string | null;
  sex: UserPetSex;
  avatarUrl: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveUserPetParams {
  breedId: string;
  name: string;
  birthday?: string | null;
  sex?: UserPetSex;
  avatarUrl?: string | null;
}

type ApiEnvelope<T> = {
  data: T;
};

function normalizePet(raw: any): UserPet {
  return {
    id: String(raw?.id ?? ''),
    userId: String(raw?.userId ?? raw?.user_id ?? ''),
    breedId: String(raw?.breedId ?? raw?.breed_id ?? ''),
    breed: raw?.breed
      ? {
          id: String(raw.breed.id ?? raw?.breedId ?? ''),
          name: String(raw.breed.name ?? ''),
          species: raw.breed.species === 'dog' ? 'dog' : 'cat',
        }
      : null,
    name: String(raw?.name ?? ''),
    birthday: raw?.birthday ?? null,
    sex: raw?.sex === 'male' || raw?.sex === 'female' ? raw.sex : 'unknown',
    avatarUrl: raw?.avatarUrl ?? raw?.avatar_url ?? null,
    isPrimary: Boolean(raw?.isPrimary ?? raw?.is_primary),
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? ''),
    updatedAt: String(raw?.updatedAt ?? raw?.updated_at ?? ''),
  };
}

export const userPetService = {
  async getMine(): Promise<UserPet | null> {
    const response = await apiClient.get<ApiEnvelope<any | null>>('/user-pets/me');
    return response.data ? normalizePet(response.data) : null;
  },

  async createMine(params: SaveUserPetParams): Promise<UserPet> {
    const response = await apiClient.post<ApiEnvelope<any>>('/user-pets/me', params);
    return normalizePet(response.data);
  },

  async updateMine(params: Partial<SaveUserPetParams>): Promise<UserPet> {
    const response = await apiClient.put<ApiEnvelope<any>>('/user-pets/me', params);
    return normalizePet(response.data);
  },

  async removeMine(): Promise<void> {
    await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>('/user-pets/me');
  },
};

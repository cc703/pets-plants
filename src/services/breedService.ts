import type { Breed, Species } from '../types';
import { apiClient, getApiAssetUrl } from './apiClient';

type BreedListResponse = {
  data: unknown[];
  page?: number;
  limit?: number;
};

type BreedDetailResponse = {
  data: unknown;
};

const defaultAppearance: Breed['appearance'] = {
  size: '中型',
  weightRange: { min: 0, max: 0 },
  heightRange: { min: 0, max: 0 },
  coatLength: '短毛',
  coatColors: [],
  earShape: '',
  bodyShape: '',
};

const defaultTemperament: Breed['temperament'] = {
  energyLevel: 3,
  affectionLevel: 3,
  trainability: 3,
  intelligence: 3,
  sociability: 3,
  vocalization: 3,
  keywords: [],
};

const defaultCare: Breed['care'] = {
  exerciseNeeds: '中',
  groomingDifficulty: '中等',
  sheddingLevel: 3,
  lifespan: { min: 0, max: 0 },
  commonDiseases: [],
  dietaryNotes: '',
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeSpecies(value: unknown): Species {
  return value === 'dog' ? 'dog' : 'cat';
}

export function normalizeBreed(raw: any): Breed {
  const imageUrl = raw?.imageUrl ?? raw?.image_url ?? '';
  const gallery = parseJson<string[]>(raw?.gallery, []);

  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? '未知品种'),
    nameEn: String(raw?.nameEn ?? raw?.name_en ?? ''),
    species: normalizeSpecies(raw?.species),
    originCountry: String(raw?.originCountry ?? raw?.origin_country ?? ''),
    history: String(raw?.history ?? ''),
    appearance: { ...defaultAppearance, ...parseJson<Partial<Breed['appearance']>>(raw?.appearance, {}) },
    temperament: { ...defaultTemperament, ...parseJson<Partial<Breed['temperament']>>(raw?.temperament, {}) },
    care: { ...defaultCare, ...parseJson<Partial<Breed['care']>>(raw?.care ?? raw?.care_info, {}) },
    suitableFor: parseJson<string[]>(raw?.suitableFor ?? raw?.suitable_for, []),
    funFacts: parseJson<string[]>(raw?.funFacts ?? raw?.fun_facts, []),
    imageUrl: getApiAssetUrl(imageUrl),
    gallery: gallery.map((item) => getApiAssetUrl(item)),
    voiceUrl: raw?.voiceUrl ?? raw?.voice_url ?? undefined,
    popularityRank: Number(raw?.popularityRank ?? raw?.popularity_rank ?? 0),
  };
}

export async function fetchBreeds(params: { species?: Species; page?: number; limit?: number } = {}): Promise<Breed[]> {
  const response = await apiClient.get<BreedListResponse>('/breeds', {
    ...(params.species ? { species: params.species } : {}),
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });

  return Array.isArray(response.data) ? response.data.map(normalizeBreed) : [];
}

export async function searchBreedsFromApi(keyword: string): Promise<Breed[]> {
  const response = await apiClient.get<BreedListResponse>(`/breeds/search/${encodeURIComponent(keyword)}`);
  return Array.isArray(response.data) ? response.data.map(normalizeBreed) : [];
}

export async function fetchBreedById(id: string): Promise<Breed> {
  const response = await apiClient.get<BreedDetailResponse>(`/breeds/${encodeURIComponent(id)}`);
  return normalizeBreed(response.data);
}

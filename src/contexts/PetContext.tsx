import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VirtualPet } from '../types';
import type { InteractionType } from '../services/petService';
import {
  loadPetsWithDecay,
  savePets,
  adoptPet as adoptPetService,
  updatePet as updatePetService,
  deletePet as deletePetService,
  applyInteraction,
  applyDecay,
  DECAY_INTERVAL_MS,
} from '../services/petService';
import { getBreedById } from '../data/breeds';
import { useAuth } from './AuthContext';

const ACTIVE_PET_KEY_PREFIX = 'pet_planet_active_pet';

function getActivePetStorageKey(userId?: string | null) {
  return userId ? `${ACTIVE_PET_KEY_PREFIX}:${userId}` : ACTIVE_PET_KEY_PREFIX;
}

// ---- 状态类型 ----

interface PetState {
  pets: VirtualPet[];
  loading: boolean;
  activePetId: string | null;
}

type PetAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: VirtualPet[] }
  | { type: 'ADD_PET'; payload: VirtualPet }
  | { type: 'UPDATE_PET'; payload: VirtualPet }
  | { type: 'REMOVE_PET'; payload: string }
  | { type: 'SET_ACTIVE'; payload: string | null }
  | { type: 'DECAY_ALL' };

// ---- Context Value ----

export interface PetContextValue extends PetState {
  activePet: VirtualPet | null;
  adoptNewPet: (breedId: string, name: string) => Promise<VirtualPet>;
  interactWithPet: (petId: string, type: InteractionType) => Promise<void>;
  removePet: (petId: string) => Promise<void>;
  setActivePet: (petId: string | null) => void;
  refreshPets: () => Promise<void>;
  getBreedName: (breedId: string) => string;
}

// ---- Reducer ----

function petReducer(state: PetState, action: PetAction): PetState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        pets: action.payload,
        loading: false,
        activePetId: state.activePetId ?? (action.payload.length > 0 ? action.payload[0].id : null),
      };
    case 'ADD_PET':
      return {
        ...state,
        pets: [...state.pets, action.payload],
        activePetId: action.payload.id,
      };
    case 'UPDATE_PET':
      return {
        ...state,
        pets: state.pets.map(p => (p.id === action.payload.id ? action.payload : p)),
      };
    case 'REMOVE_PET': {
      const remaining = state.pets.filter(p => p.id !== action.payload);
      return {
        ...state,
        pets: remaining,
        activePetId:
          state.activePetId === action.payload
            ? remaining.length > 0
              ? remaining[0].id
              : null
            : state.activePetId,
      };
    }
    case 'SET_ACTIVE':
      return { ...state, activePetId: action.payload };
    case 'DECAY_ALL':
      return {
        ...state,
        pets: state.pets.map(p => applyDecay(p)),
      };
    default:
      return state;
  }
}

// ---- Context ----

const PetContext = createContext<PetContextValue | null>(null);

// ---- Provider ----

export function PetProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(petReducer, {
    pets: [],
    loading: true,
    activePetId: null,
  });

  const decayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初始加载
  useEffect(() => {
    (async () => {
      dispatch({ type: 'LOAD_START' });
      const pets = await loadPetsWithDecay(user?.id);
      const storedActivePetId = await AsyncStorage.getItem(getActivePetStorageKey(user?.id));
      dispatch({ type: 'LOAD_SUCCESS', payload: pets });
      if (storedActivePetId && pets.some((pet) => pet.id === storedActivePetId)) {
        dispatch({ type: 'SET_ACTIVE', payload: storedActivePetId });
      } else {
        dispatch({ type: 'SET_ACTIVE', payload: pets[0]?.id ?? null });
      }
    })();
  }, [user?.id]);

  // 定时衰减
  useEffect(() => {
    decayTimerRef.current = setInterval(() => {
      dispatch({ type: 'DECAY_ALL' });
    }, DECAY_INTERVAL_MS);

    return () => {
      if (decayTimerRef.current) clearInterval(decayTimerRef.current);
    };
  }, []);

  // 宠物变化时持久化
  useEffect(() => {
    if (!state.loading) {
      savePets(state.pets, user?.id);
      AsyncStorage.setItem(getActivePetStorageKey(user?.id), state.activePetId ?? '');
      AsyncStorage.setItem(
        user?.id ? `pet_planet_last_decay:${user.id}` : 'pet_planet_last_decay',
        String(Date.now()),
      );
    }
  }, [state.pets, state.loading, state.activePetId, user?.id]);

  const activePet = state.pets.find(p => p.id === state.activePetId) ?? null;

  const adoptNewPet = useCallback(async (breedId: string, name: string) => {
    const pet = await adoptPetService(breedId, name, user?.id);
    dispatch({ type: 'ADD_PET', payload: pet });
    return pet;
  }, [user?.id]);

  const interactWithPet = useCallback(async (petId: string, type: InteractionType) => {
    const pet = state.pets.find(p => p.id === petId);
    if (!pet) return;
    const updated = applyInteraction(pet, type);
    await updatePetService(updated, user?.id);
    dispatch({ type: 'UPDATE_PET', payload: updated });
  }, [state.pets, user?.id]);

  const removePet = useCallback(async (petId: string) => {
    await deletePetService(petId, user?.id);
    dispatch({ type: 'REMOVE_PET', payload: petId });
  }, [user?.id]);

  const setActivePet = useCallback((petId: string | null) => {
    dispatch({ type: 'SET_ACTIVE', payload: petId });
  }, []);

  const refreshPets = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    const pets = await loadPetsWithDecay(user?.id);
    dispatch({ type: 'LOAD_SUCCESS', payload: pets });
  }, [user?.id]);

  const getBreedName = useCallback((breedId: string) => {
    const breed = getBreedById(breedId);
    return breed?.name ?? '未知品种';
  }, []);

  const value: PetContextValue = {
    ...state,
    activePet,
    adoptNewPet,
    interactWithPet,
    removePet,
    setActivePet,
    refreshPets,
    getBreedName,
  };

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

// ---- Hook ----

export function usePets(): PetContextValue {
  const context = useContext(PetContext);
  if (!context) {
    throw new Error('usePets must be used within a PetProvider');
  }
  return context;
}

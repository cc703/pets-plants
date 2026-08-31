import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { useAuth } from './AuthContext';
import { userPetService, type SaveUserPetParams, type UserPet } from '../services/userPetService';

type UserPetStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UserPetState {
  pet: UserPet | null;
  status: UserPetStatus;
  error: string | null;
  ownerUserId: string | null;
}

interface UserPetContextValue extends UserPetState {
  refresh: () => Promise<UserPet | null>;
  save: (params: SaveUserPetParams) => Promise<UserPet>;
  remove: () => Promise<void>;
}

type Action =
  | { type: 'RESET' }
  | { type: 'LOAD_START'; ownerUserId: string }
  | { type: 'LOAD_SUCCESS'; payload: UserPet | null; ownerUserId: string }
  | { type: 'LOAD_ERROR'; payload: string; ownerUserId: string };

const initialState: UserPetState = {
  pet: null,
  status: 'idle',
  error: null,
  ownerUserId: null,
};

const SERVICE_ERROR = '暂时无法连接服务，请稍后重试';

function reducer(state: UserPetState, action: Action): UserPetState {
  switch (action.type) {
    case 'RESET':
      return initialState;
    case 'LOAD_START':
      return {
        pet: state.ownerUserId === action.ownerUserId ? state.pet : null,
        status: 'loading',
        error: null,
        ownerUserId: action.ownerUserId,
      };
    case 'LOAD_SUCCESS':
      return { pet: action.payload, status: 'ready', error: null, ownerUserId: action.ownerUserId };
    case 'LOAD_ERROR':
      return {
        pet: state.ownerUserId === action.ownerUserId ? state.pet : null,
        status: 'error',
        error: action.payload,
        ownerUserId: action.ownerUserId,
      };
    default:
      return state;
  }
}

const UserPetContext = createContext<UserPetContextValue | null>(null);

export function UserPetProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  const refresh = useCallback(async () => {
    if (authStatus !== 'authenticated' || !user) {
      dispatch({ type: 'RESET' });
      return null;
    }

    const ownerUserId = user.id;
    dispatch({ type: 'LOAD_START', ownerUserId });
    try {
      const pet = await userPetService.getMine();
      dispatch({ type: 'LOAD_SUCCESS', payload: pet, ownerUserId });
      return pet;
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', payload: SERVICE_ERROR, ownerUserId });
      throw error;
    }
  }, [authStatus, user?.id]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user) {
      dispatch({ type: 'RESET' });
      return;
    }

    // Do not show a previous account's pet while the next account is loading.
    dispatch({ type: 'RESET' });
    refresh().catch(() => undefined);
  }, [authStatus, user?.id, refresh]);

  const save = useCallback(async (params: SaveUserPetParams) => {
    if (authStatus !== 'authenticated' || !user) {
      const error = new Error('请先登录');
      dispatch({ type: 'LOAD_ERROR', payload: error.message, ownerUserId: user?.id ?? '' });
      throw error;
    }

    try {
      const pet = state.ownerUserId === user.id && state.pet
        ? await userPetService.updateMine(params)
        : await userPetService.createMine(params);
      dispatch({ type: 'LOAD_SUCCESS', payload: pet, ownerUserId: user.id });
      return pet;
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', payload: SERVICE_ERROR, ownerUserId: user.id });
      throw error;
    }
  }, [authStatus, state.pet, user]);

  const remove = useCallback(async () => {
    if (authStatus !== 'authenticated' || !user) {
      const error = new Error('请先登录');
      dispatch({ type: 'LOAD_ERROR', payload: error.message, ownerUserId: user?.id ?? '' });
      throw error;
    }

    try {
      await userPetService.removeMine();
      dispatch({ type: 'LOAD_SUCCESS', payload: null, ownerUserId: user.id });
    } catch (error) {
      dispatch({ type: 'LOAD_ERROR', payload: SERVICE_ERROR, ownerUserId: user.id });
      throw error;
    }
  }, [authStatus, user]);

  const visibleState = authStatus === 'authenticated' && user && state.ownerUserId === user.id
    ? state
    : { ...initialState, status: authStatus === 'authenticated' ? 'loading' as const : 'idle' as const };

  const value = useMemo<UserPetContextValue>(() => ({
    ...visibleState,
    refresh,
    save,
    remove,
  }), [visibleState, refresh, save, remove]);

  return <UserPetContext.Provider value={value}>{children}</UserPetContext.Provider>;
}

export function useUserPet(): UserPetContextValue {
  const context = useContext(UserPetContext);
  if (!context) {
    throw new Error('useUserPet must be used within a UserPetProvider');
  }
  return context;
}

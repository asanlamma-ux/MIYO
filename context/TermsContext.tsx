import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Term, TermGroup, CommunityTermGroup } from '@/types/terms';
import { logger, captureError } from '@/utils/logger';
import { exportTermGroups, importTermGroups } from '@/utils/term-group-io';
import { syncTermGroupsToDrive, checkDriveForTermGroups, restoreTermGroupsFromDrive } from '@/utils/term-group-sync';
import { supabase } from '@/lib/supabase';

interface TermsContextType {
  termGroups: TermGroup[];
  isLoading: boolean;
  createGroup: (name: string, description?: string) => Promise<TermGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
  updateGroup: (groupId: string, updates: Partial<Pick<TermGroup, 'name' | 'description'>>) => Promise<void>;
  addTerm: (
    groupId: string,
    originalText: string,
    correctedText: string,
    context?: string,
    metadata?: Partial<Pick<Term, 'translationText' | 'imageUri'>>
  ) => Promise<void>;
  removeTerm: (groupId: string, termId: string) => Promise<void>;
  updateTerm: (
    groupId: string,
    termId: string,
    updates: Partial<Pick<Term, 'originalText' | 'translationText' | 'correctedText' | 'context' | 'imageUri'>>
  ) => Promise<void>;
  applyGroupToBook: (groupId: string, bookId: string) => Promise<void>;
  removeGroupFromBook: (groupId: string, bookId: string) => Promise<void>;
  getGroupsForBook: (bookId: string) => TermGroup[];
  getTermsForBook: (bookId: string) => Term[];
  getReplacementMap: (bookId: string) => Map<string, string>;
  exportGroups: () => Promise<string | null>;
  importGroups: () => Promise<{ count: number; error: string | null }>;
  syncToDrive: () => Promise<boolean>;
  checkDriveForGroups: () => Promise<{ exists: boolean; groups: TermGroup[] | null }>;
  restoreFromDrive: () => Promise<boolean>;
  fetchCommunityGroups: () => Promise<CommunityTermGroup[]>;
  downloadCommunityGroup: (groupId: string) => Promise<boolean>;
  setTermGroups: (groups: TermGroup[]) => Promise<void>;
}

const TermsContext = createContext<TermsContextType | undefined>(undefined);

const TERM_GROUPS_KEY = '@miyo/term-groups';

export function TermsProvider({ children }: { children: ReactNode }) {
  const [termGroups, setTermGroups] = useState<TermGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const termGroupsRef = useRef<TermGroup[]>([]);

  useEffect(() => {
    termGroupsRef.current = termGroups;
  }, [termGroups]);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const json = await AsyncStorage.getItem(TERM_GROUPS_KEY);
      if (json) {
        const parsed = JSON.parse(json);
        termGroupsRef.current = parsed;
        setTermGroups(parsed);
      }
      logger.info('Term groups loaded');
    } catch (error) {
      captureError('Load Term Groups', error);
    } finally {
      setIsLoading(false);
    }
  };

  const persist = async (groups: TermGroup[]) => {
    try {
      await AsyncStorage.setItem(TERM_GROUPS_KEY, JSON.stringify(groups));
      termGroupsRef.current = groups;
    } catch (error) {
      captureError('Save Term Groups', error);
    }
  };

  const createGroup = useCallback(async (name: string, description?: string): Promise<TermGroup> => {
    const newGroup: TermGroup = {
      id: `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      terms: [],
      appliedToBooks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...termGroupsRef.current, newGroup];
    setTermGroups(updated);
    await persist(updated);
    logger.info('Term group created', { name });
    return newGroup;
  }, []);

  const deleteGroup = useCallback(async (groupId: string) => {
    const updated = termGroupsRef.current.filter(g => g.id !== groupId);
    setTermGroups(updated);
    await persist(updated);
    logger.info('Term group deleted', { groupId });
  }, []);

  const updateGroup = useCallback(async (groupId: string, updates: Partial<Pick<TermGroup, 'name' | 'description'>>) => {
    const updated = termGroupsRef.current.map(g =>
      g.id === groupId ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
    );
    setTermGroups(updated);
    await persist(updated);
  }, []);

  const addTerm = useCallback(async (
    groupId: string,
    originalText: string,
    correctedText: string,
    context?: string,
    metadata?: Partial<Pick<Term, 'translationText' | 'imageUri'>>
  ) => {
    const normalizedOriginalText = originalText.trim();
    const normalizedCorrectedText = correctedText.trim();
    const normalizedContext = context?.trim() || undefined;
    const normalizedTranslationText = metadata?.translationText?.trim() || undefined;
    const normalizedImageUri = metadata?.imageUri?.trim() || undefined;
    const group = termGroupsRef.current.find(g => g.id === groupId);
    const existingTerm = group?.terms.find(t => t.originalText.toLowerCase() === normalizedOriginalText.toLowerCase());
    
    if (existingTerm) {
      const updated = termGroupsRef.current.map(g =>
        g.id === groupId
          ? {
              ...g,
              terms: g.terms.map(t => (t.id === existingTerm.id ? {
                ...t,
                originalText: normalizedOriginalText,
                correctedText: normalizedCorrectedText,
                context: normalizedContext,
                translationText: normalizedTranslationText ?? t.translationText,
                imageUri: normalizedImageUri ?? t.imageUri,
                updatedAt: new Date().toISOString(),
              } : t)),
              updatedAt: new Date().toISOString(),
            }
          : g
      );
      setTermGroups(updated);
      await persist(updated);
      logger.info('Term updated', { groupId, originalText, correctedText });
      return;
    }

    const newTerm: Term = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      originalText: normalizedOriginalText,
      translationText: normalizedTranslationText,
      correctedText: normalizedCorrectedText,
      context: normalizedContext,
      imageUri: normalizedImageUri,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = termGroupsRef.current.map(g =>
      g.id === groupId
        ? { ...g, terms: [...g.terms, newTerm], updatedAt: new Date().toISOString() }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
    logger.info('Term added', { groupId, originalText, correctedText });
  }, []);

  const removeTerm = useCallback(async (groupId: string, termId: string) => {
    const updated = termGroupsRef.current.map(g =>
      g.id === groupId
        ? { ...g, terms: g.terms.filter(t => t.id !== termId), updatedAt: new Date().toISOString() }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
  }, []);

  const updateTerm = useCallback(async (
    groupId: string,
    termId: string,
    updates: Partial<Pick<Term, 'originalText' | 'translationText' | 'correctedText' | 'context' | 'imageUri'>>
  ) => {
    const sanitizedUpdates: Partial<Term> = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.originalText !== undefined) {
      sanitizedUpdates.originalText = updates.originalText.trim();
    }
    if (updates.translationText !== undefined) {
      sanitizedUpdates.translationText = updates.translationText.trim() || undefined;
    }
    if (updates.correctedText !== undefined) {
      sanitizedUpdates.correctedText = updates.correctedText.trim();
    }
    if (updates.context !== undefined) {
      sanitizedUpdates.context = updates.context.trim() || undefined;
    }
    if (updates.imageUri !== undefined) {
      sanitizedUpdates.imageUri = updates.imageUri.trim() || undefined;
    }
    const updated = termGroupsRef.current.map(g =>
      g.id === groupId
        ? {
            ...g,
            terms: g.terms.map(t => (t.id === termId ? { ...t, ...sanitizedUpdates } : t)),
            updatedAt: new Date().toISOString(),
          }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
  }, []);

  const applyGroupToBook = useCallback(async (groupId: string, bookId: string) => {
    const updated = termGroupsRef.current.map(g =>
      g.id === groupId && !g.appliedToBooks.includes(bookId)
        ? { ...g, appliedToBooks: [...g.appliedToBooks, bookId], updatedAt: new Date().toISOString() }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
    logger.info('Term group applied to book', { groupId, bookId });
  }, []);

  const removeGroupFromBook = useCallback(async (groupId: string, bookId: string) => {
    const updated = termGroupsRef.current.map(g =>
      g.id === groupId
        ? { ...g, appliedToBooks: g.appliedToBooks.filter(id => id !== bookId), updatedAt: new Date().toISOString() }
        : g
    );
    setTermGroups(updated);
    await persist(updated);
  }, []);

  const getGroupsForBook = useCallback((bookId: string) => {
    return termGroups.filter(g => g.appliedToBooks.includes(bookId));
  }, [termGroups]);

  const getTermsForBook = useCallback((bookId: string) => {
    return termGroups
      .filter(group => group.appliedToBooks.includes(bookId))
      .flatMap(group => group.terms);
  }, [termGroups]);

  const getReplacementMap = useCallback((bookId: string): Map<string, string> => {
    const map = new Map<string, string>();
    const groups = termGroups.filter(g => g.appliedToBooks.includes(bookId));
    for (const group of groups) {
      for (const term of group.terms) {
        map.set(term.originalText, term.correctedText);
      }
    }
    return map;
  }, [termGroups]);

  const persistGroups = useCallback(async (groups: TermGroup[]) => {
    termGroupsRef.current = groups;
    setTermGroups(groups);
    await persist(groups);
  }, []);

  const exportGroups = useCallback(async (): Promise<string | null> => {
    return exportTermGroups(termGroups);
  }, [termGroups]);

  const importGroups = useCallback(async (): Promise<{ count: number; error: string | null }> => {
    const { groups: imported, error } = await importTermGroups();
    if (error || imported.length === 0) {
      return { count: 0, error };
    }

    const existingIds = new Set(termGroupsRef.current.map(g => g.id));
    const newGroups = imported.filter(g => !existingIds.has(g.id));
    const merged = [...termGroupsRef.current, ...newGroups];
    setTermGroups(merged);
    await persist(merged);
    return { count: newGroups.length, error: null };
  }, []);

  const syncToDrive = useCallback(async (): Promise<boolean> => {
    return syncTermGroupsToDrive(termGroups);
  }, [termGroups]);

  const checkDriveForGroups = useCallback(async (): Promise<{ exists: boolean; groups: TermGroup[] | null }> => {
    return checkDriveForTermGroups();
  }, []);

  const restoreFromDrive = useCallback(async (): Promise<boolean> => {
    const groups = await restoreTermGroupsFromDrive();
    if (groups) {
      setTermGroups(groups);
      await persist(groups);
      return true;
    }
    return false;
  }, []);

  const fetchCommunityGroups = useCallback(async (): Promise<CommunityTermGroup[]> => {
    try {
      const { data, error } = await supabase
        .from('community_term_groups')
        .select('*')
        .order('downloads', { ascending: false });
      
      if (error) {
        logger.error('Failed to fetch community groups', error);
        return [];
      }
      
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        terms: row.terms || [],
        appliedToBooks: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        downloads: row.downloads || 0,
        tags: row.tags || [],
        isOfficial: row.is_official || false,
      }));
    } catch (error) {
      captureError('Fetch Community Groups', error);
      return [];
    }
  }, []);

  const downloadCommunityGroup = useCallback(async (groupId: string): Promise<boolean> => {
    try {
      const { data: groupData, error } = await supabase
        .from('community_term_groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      if (error || !groupData) {
        logger.error('Failed to download community group', error);
        return false;
      }

      const newGroup: TermGroup = {
        id: `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: groupData.name,
        description: groupData.description,
        terms: groupData.terms || [],
        appliedToBooks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const merged = [...termGroupsRef.current, newGroup];
      setTermGroups(merged);
      await persist(merged);

      await supabase
        .from('community_term_groups')
        .update({ downloads: (groupData.downloads || 0) + 1 })
        .eq('id', groupId);

      logger.info('Downloaded community group', { name: newGroup.name });
      return true;
    } catch (error) {
      captureError('Download Community Group', error);
      return false;
    }
  }, []);

  return (
    <TermsContext.Provider
      value={{
        termGroups,
        isLoading,
        createGroup,
        deleteGroup,
        updateGroup,
        addTerm,
        removeTerm,
        updateTerm,
        applyGroupToBook,
        removeGroupFromBook,
        getGroupsForBook,
        getTermsForBook,
        getReplacementMap,
        exportGroups,
        importGroups,
        syncToDrive,
        checkDriveForGroups,
        restoreFromDrive,
        fetchCommunityGroups,
        downloadCommunityGroup,
        setTermGroups: persistGroups,
      }}
    >
      {children}
    </TermsContext.Provider>
  );
}

export function useTerms() {
  const context = useContext(TermsContext);
  if (context === undefined) {
    throw new Error('useTerms must be used within a TermsProvider');
  }
  return context;
}

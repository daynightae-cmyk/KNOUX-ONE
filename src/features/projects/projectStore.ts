/**
 * Module 16 is intentionally non-executable during Phase 04A.
 * No sample repositories or build caches are exposed as real project facts.
 */
import { useCallback, useState } from 'react';
import type { BuildCacheItem, RepositoryItem } from './projectContracts';

export function useProjectStore() {
  const [repositories] = useState<RepositoryItem[]>([]);
  const [buildCaches] = useState<BuildCacheItem[]>([]);
  const [activeTab, setActiveTab] = useState<'repos' | 'audit' | 'caches' | 'toolbox' | 'api'>('repos');
  const [isAuditing] = useState(false);

  const cleanBuildCache = useCallback(async (_cacheId: string) => {
    throw new Error('capability_planned:m16');
  }, []);

  return {
    repositories,
    buildCaches,
    activeTab,
    setActiveTab,
    isAuditing,
    cleanBuildCache,
  };
}

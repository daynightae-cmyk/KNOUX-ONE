/**
 * KNOUX ONE — Module 16 Project Workspace Store
 */
import { useState, useCallback } from 'react';
import { RepositoryItem, DependencyAuditIssue, BuildCacheItem } from './projectContracts';
import { NativeClient } from '../../services/nativeClient';

const SAMPLE_REPOS: RepositoryItem[] = [
  { id: 'repo_1', name: 'knoux-one', path: 'C:\\Projects\\knoux-one', type: 'node', branch: 'main', hasUncommittedChanges: false, uncommittedFilesCount: 0, aheadCommitCount: 0, behindCommitCount: 0, lastCommitMessage: 'feat(m03): add duplicate control center', lastCommitTime: new Date().toISOString() },
  { id: 'repo_2', name: 'knoux-tauri-backend', path: 'C:\\Projects\\knoux-tauri-backend', type: 'rust', branch: 'feature/phase-04', hasUncommittedChanges: true, uncommittedFilesCount: 3, aheadCommitCount: 2, behindCommitCount: 0, lastCommitMessage: 'refactor: register missing commands', lastCommitTime: '2026-07-24T11:30:00Z' },
];

const SAMPLE_BUILD_CACHES: BuildCacheItem[] = [
  { id: 'c1', projectName: 'knoux-one', path: 'C:\\Projects\\knoux-one\\node_modules', cacheType: 'node_modules', sizeBytes: 420000000 },
  { id: 'c2', projectName: 'knoux-tauri-backend', path: 'C:\\Projects\\knoux-tauri-backend\\target', cacheType: 'target', sizeBytes: 1850000000 },
];

export function useProjectStore() {
  const [repositories, setRepositories] = useState<RepositoryItem[]>(SAMPLE_REPOS);
  const [buildCaches, setBuildCaches] = useState<BuildCacheItem[]>(SAMPLE_BUILD_CACHES);
  const [activeTab, setActiveTab] = useState<'repos' | 'audit' | 'caches' | 'toolbox' | 'api'>('repos');
  const [isAuditing, setIsAuditing] = useState(false);

  const cleanBuildCache = useCallback(async (cacheId: string) => {
    if (NativeClient.isTauriAvailable()) {
      try {
        await NativeClient.executeModule01Capability('m16_s07', 'm16.build.cleanup', { cacheId });
      } catch (err) {
        console.error('Clean build cache error:', err);
      }
    }
    setBuildCaches(prev => prev.filter(c => c.id !== cacheId));
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ProjectFile } from '@/lib/data/project-details';
import { getProjectFiles, type ProjectFileWithUploader } from '@/lib/actions/files';

/**
 * Hook for fetching project files with real-time updates
 * Combines initial data fetching with Supabase Realtime subscription
 */
export function useProjectFilesRealtime(projectId: string) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform database file to UI format
  const transformFile = useCallback((file: ProjectFileWithUploader): ProjectFile => {
    const sizeMB = Math.round(file.size_bytes / 1024 / 1024 * 100) / 100;
    // Check if it's a link asset by examining if size is 0 (links don't have file size)
    const isLinkAsset = file.size_bytes === 0;

    return {
      id: file.id,
      name: file.name,
      type: file.file_type as ProjectFile['type'],
      sizeMB,
      url: file.url,
      description: file.description || undefined,
      isLinkAsset,
      addedDate: new Date(file.created_at),
      addedBy: file.uploader ? {
        id: file.uploader.id,
        name: file.uploader.full_name || file.uploader.email,
        avatarUrl: file.uploader.avatar_url || undefined,
      } : {
        id: '',
        name: 'Unknown',
      },
    };
  }, []);

  // Fetch files from database
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    const result = await getProjectFiles(projectId);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    const transformed = (result.data || []).map(transformFile);
    setFiles(transformed);
    setError(null);
    setIsLoading(false);
  }, [projectId, transformFile]);

  useEffect(() => {
    let isMounted = true;

    // Initial fetch
    fetchFiles();

    // Setup realtime subscription
    const supabase = createClient();

    const channel = supabase
      .channel(`project-files:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Refetch on any change
          if (isMounted) {
            fetchFiles();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchFiles]);

  return { files, isLoading, error, refetch: fetchFiles };
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDocumentVisibility } from './use-document-visibility';
import type { ProjectFile } from '@/lib/data/project-details';
import { getProjectFiles, type ProjectFileWithUploader } from '@/lib/actions/files';

/** Debounce delay (ms) for coalescing rapid realtime changes into a single refetch */
const REFETCH_DEBOUNCE_MS = 300;

/**
 * Hook for fetching project files with real-time updates
 * Combines initial data fetching with Supabase Realtime subscription.
 *
 * Optimizations:
 * - DELETE events remove the file from state directly (no refetch needed)
 * - INSERT/UPDATE events are debounced to coalesce rapid changes
 * - Subscription pauses when the browser tab is hidden
 */
export function useProjectFilesRealtime(projectId: string) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isVisible = useDocumentVisibility();
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      storagePath: file.storage_path || undefined,
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

  // Debounced refetch: coalesces multiple rapid INSERT/UPDATE events
  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
    }
    refetchTimerRef.current = setTimeout(() => {
      fetchFiles();
      refetchTimerRef.current = null;
    }, REFETCH_DEBOUNCE_MS);
  }, [fetchFiles]);

  // Visibility-based pause/resume
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    if (isVisible) {
      channel.subscribe();
      // Refetch on resume in case changes happened while hidden
      fetchFiles();
    } else {
      channel.unsubscribe();
    }
  }, [isVisible, fetchFiles]);

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
        (payload) => {
          if (!isMounted) return;

          if (payload.eventType === 'DELETE') {
            // DELETE: remove directly from state -- no refetch needed
            const oldRecord = payload.old as { id?: string } | undefined;
            if (oldRecord?.id) {
              setFiles((prev) => prev.filter((f) => f.id !== oldRecord.id));
            }
          } else {
            // INSERT or UPDATE: need to refetch to get uploader profile relation
            // Debounce to coalesce rapid changes (e.g. bulk upload)
            debouncedRefetch();
          }
        }
      );

    channelRef.current = channel;

    // Only subscribe if visible
    if (isVisibleRef.current) {
      channel.subscribe((status, err) => {
        if (err) {
          console.error(`[Realtime] project-files:${projectId} error:`, err);
        }
      });
    }

    return () => {
      isMounted = false;
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, fetchFiles, debouncedRefetch]);

  return { files, isLoading, error, refetch: fetchFiles };
}

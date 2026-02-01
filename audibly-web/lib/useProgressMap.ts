'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

/** Ticks to seconds (100-nanosecond ticks) */
const TICKS_TO_SECONDS = 1 / 10_000_000;
const SECONDS_TO_TICKS = 10_000_000;

export type BookProgress = {
  positionSeconds: number;
  fileIndex: number;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export function useProgressMap() {
  const { userId } = useAuth();
  const [progressMap, setProgressMap] = useState<Map<string, BookProgress>>(new Map());

  const fetchProgress = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !userId) {
      setProgressMap(new Map());
      return;
    }
    const { data, error } = await supabase
      .from('user_audiobook_progress')
      .select('audiobook_id, current_position_ticks, current_file_index, started_at, finished_at')
      .eq('user_id', userId);
    if (error) {
      setProgressMap(new Map());
      return;
    }
    const map = new Map<string, BookProgress>();
    for (const row of data ?? []) {
      const pos = (row.current_position_ticks ?? 0) * TICKS_TO_SECONDS;
      map.set(row.audiobook_id, {
        positionSeconds: pos,
        fileIndex: row.current_file_index ?? 0,
        startedAt: row.started_at ?? null,
        finishedAt: row.finished_at ?? null,
      });
    }
    setProgressMap(map);
  }, [userId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const getStatus = useCallback(
    (audiobookId: string, durationSeconds: number): ProgressStatus => {
      const p = progressMap.get(audiobookId);
      if (!p) return 'not_started';
      if (p.finishedAt != null) return 'completed';
      if (p.positionSeconds <= 0) return 'not_started';
      if (durationSeconds > 0 && p.positionSeconds >= durationSeconds * 0.98) return 'completed';
      return 'in_progress';
    },
    [progressMap]
  );

  const setCompleted = useCallback(
    async (audiobookId: string, durationSeconds: number): Promise<boolean> => {
      const supabase = createClient();
      if (!supabase || !userId || durationSeconds <= 0) return false;
      const ticks = Math.floor(durationSeconds * SECONDS_TO_TICKS);
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from('user_audiobook_progress')
        .select('started_at')
        .eq('user_id', userId)
        .eq('audiobook_id', audiobookId)
        .maybeSingle();
      const startedAt = existing?.started_at ?? now;
      const { error } = await supabase.from('user_audiobook_progress').upsert(
        {
          user_id: userId,
          audiobook_id: audiobookId,
          current_position_ticks: ticks,
          current_file_index: 0,
          started_at: startedAt,
          finished_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id,audiobook_id' }
      );
      if (error) return false;
      await fetchProgress();
      return true;
    },
    [userId, fetchProgress]
  );

  const setUncompleted = useCallback(
    async (audiobookId: string): Promise<boolean> => {
      const supabase = createClient();
      if (!supabase || !userId) return false;
      const { error } = await supabase
        .from('user_audiobook_progress')
        .update({ finished_at: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('audiobook_id', audiobookId);
      if (error) return false;
      await fetchProgress();
      return true;
    },
    [userId, fetchProgress]
  );

  return { progressMap, getStatus, setCompleted, setUncompleted, refetch: fetchProgress };
}

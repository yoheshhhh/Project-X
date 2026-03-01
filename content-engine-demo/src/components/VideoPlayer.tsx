'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import YouTube, { type YouTubeProps } from 'react-youtube';
import type { Segment } from '@/types/learning';

const YOUTUBE_OPTS = { height: '100%', width: '100%', playerVars: { autoplay: 0, rel: 0, modestbranding: 1 } } as const;

type VideoPlayerProps = {
  videoId: string;
  segments: Segment[];
  allowedEndTime: number;
  currentSegmentIndex: number;
  onSegmentEnd: (segmentIndex: number) => void;
  onDurationReady?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  paused: boolean;
  setPaused: (p: boolean) => void;
};

export function VideoPlayer({
  videoId,
  segments,
  allowedEndTime,
  currentSegmentIndex,
  onSegmentEnd,
  onDurationReady,
  onTimeUpdate,
  paused,
  setPaused,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const lastSegmentEndFired = useRef<number>(-1);
  const lastTimeUpdate = useRef<number>(0);
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCurrentTime = useCallback(async (): Promise<number> => {
    const p = playerRef.current;
    if (!p?.getCurrentTime) return 0;
    return p.getCurrentTime();
  }, []);

  const seekTo = useCallback(async (t: number) => {
    const p = playerRef.current;
    if (!p?.seekTo) return;
    p.seekTo(t, true);
  }, []);

  const pause = useCallback(() => {
    const p = playerRef.current;
    if (p?.pauseVideo) p.pauseVideo();
    setPaused(true);
  }, [setPaused]);

  const play = useCallback(() => {
    const p = playerRef.current;
    if (p?.playVideo) p.playVideo();
    setPaused(false);
  }, [setPaused]);

  useEffect(() => {
    if (!ready || !segments.length) return;
    const SEGMENT_END_TOLERANCE = 0.5;
    checkInterval.current = setInterval(async () => {
      const t = await getCurrentTime();
      if (typeof t !== 'number' || t < 0) return;
      if (Math.floor(t) !== lastTimeUpdate.current) {
        lastTimeUpdate.current = Math.floor(t);
        onTimeUpdate?.(t);
      }

      const i = currentSegmentIndex;
      if (i >= 0 && i < segments.length) {
        const segmentEnd = segments[i].end;
        if (t < segmentEnd - SEGMENT_END_TOLERANCE && lastSegmentEndFired.current === i) {
          lastSegmentEndFired.current = -1;
        }
        if (t >= segmentEnd - SEGMENT_END_TOLERANCE && lastSegmentEndFired.current !== i) {
          lastSegmentEndFired.current = i;
          pause();
          onSegmentEnd(i);
          return;
        }
      }

      if (t > allowedEndTime) await seekTo(allowedEndTime);
    }, 200);
    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
    };
  }, [ready, allowedEndTime, currentSegmentIndex, segments, getCurrentTime, seekTo, pause, onSegmentEnd, onTimeUpdate]);

  const onReady = useCallback((e: Parameters<NonNullable<YouTubeProps['onReady']>>[0]) => {
    playerRef.current = e.target;
    setReady(true);
    const dur = e.target.getDuration?.();
    if (typeof dur === 'number' && dur > 0) onDurationReady?.(dur);
  }, [onDurationReady]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <YouTube
        videoId={videoId}
        opts={YOUTUBE_OPTS}
        onReady={onReady}
        className="absolute inset-0"
        iframeClassName="w-full h-full"
      />
      {paused && (
        <button
          type="button"
          onClick={play}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-lg"
          aria-label="Resume"
        >
          Click to resume
        </button>
      )}
    </div>
  );
}

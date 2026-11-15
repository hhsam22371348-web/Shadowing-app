import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { MOVIE_INFO } from '../constants/defaultData';
import { ExternalLink, AlertCircle, Play, Pause, RotateCcw } from 'lucide-react';

export interface YouTubePlayerHandle {
  playSegment: (start: number, end: number, options?: { loop?: boolean; onEnded?: () => void }) => void;
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  setPlaybackRate: (rate: number) => void;
  stopSegmentTracking: () => void;
  mute: () => void;
  unMute: () => void;
}

interface YouTubePlayerProps {
  onTimeUpdate?: (currentTime: number) => void;
  onReadyStateChange?: (isReady: boolean) => void;
  playbackRate?: number;
  showCredit?: boolean;
}

// Global declaration for YouTube Iframe API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  ({ onTimeUpdate, onReadyStateChange, playbackRate = 1.0, showCredit = true }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentLocalTime, setCurrentLocalTime] = useState(0);

    // Segment tracking refs
    const segmentRef = useRef<{
      start: number;
      end: number;
      loop: boolean;
      onEnded?: () => void;
      isActive: boolean;
    }>({
      start: 0,
      end: 70,
      loop: false,
      isActive: false,
    });

    const trackingIntervalRef = useRef<number | null>(null);
    const loopTimeoutRef = useRef<number | null>(null);
    const segmentStartedAtRef = useRef<number>(0);

    const clearTracking = useCallback(() => {
      if (trackingIntervalRef.current !== null) {
        window.clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      if (loopTimeoutRef.current !== null) {
        window.clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
      segmentRef.current.isActive = false;
    }, []);

    // Stop and clean up on unmount
    useEffect(() => {
      return () => {
        clearTracking();
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          try {
            playerRef.current.destroy();
          } catch (e) {
            console.warn('Error destroying player', e);
          }
        }
      };
    }, [clearTracking]);

    // Handle segment step checking
    const startSegmentMonitoring = useCallback(() => {
      if (trackingIntervalRef.current !== null) {
        window.clearInterval(trackingIntervalRef.current);
      }

      trackingIntervalRef.current = window.setInterval(() => {
        if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

        try {
          const time = playerRef.current.getCurrentTime();
          setCurrentLocalTime(time);
          if (onTimeUpdate) {
            onTimeUpdate(time);
          }

          const { start, end, loop, onEnded, isActive } = segmentRef.current;
          const elapsedSinceStart = Date.now() - segmentStartedAtRef.current;

          if (isActive && elapsedSinceStart > 350 && time >= end) {
            playerRef.current.pauseVideo();
            setIsPlaying(false);

            if (loop) {
              // Wait 1.5 seconds for learner to practice, then replay
              segmentRef.current.isActive = false;
              if (loopTimeoutRef.current !== null) {
                window.clearTimeout(loopTimeoutRef.current);
              }
              loopTimeoutRef.current = window.setTimeout(() => {
                if (!playerRef.current) return;
                segmentStartedAtRef.current = Date.now();
                segmentRef.current.isActive = true;
                playerRef.current.seekTo(start, true);
                playerRef.current.playVideo();
                setIsPlaying(true);
              }, 1500);
            } else {
              segmentRef.current.isActive = false;
            }

            if (onEnded) {
              onEnded();
            }
          }
        } catch (err) {
          console.warn('Tracking error', err);
        }
      }, 100);
    }, [onTimeUpdate]);

    // Load YouTube API script once
    useEffect(() => {
      let isMounted = true;

      const initPlayer = () => {
        if (!window.YT || !window.YT.Player || !containerRef.current) return;

        try {
          // If already initialized
          if (playerRef.current) return;

          playerRef.current = new window.YT.Player(containerRef.current, {
            videoId: MOVIE_INFO.videoId,
            playerVars: {
              start: MOVIE_INFO.rangeStart,
              end: MOVIE_INFO.rangeEnd,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              controls: 1,
              cc_load_policy: 0,
              origin: window.location.origin,
            },
            events: {
              onReady: (event: any) => {
                if (!isMounted) return;
                setIsReady(true);
                if (onReadyStateChange) onReadyStateChange(true);
                try {
                  event.target.setPlaybackRate(playbackRate);
                } catch (e) {
                  // ignore
                }
              },
              onStateChange: (event: any) => {
                if (!isMounted) return;
                // YT.PlayerState: 1 = PLAYING, 2 = PAUSED, 0 = ENDED
                if (event.data === 1) {
                  setIsPlaying(true);
                  startSegmentMonitoring();
                } else {
                  setIsPlaying(false);
                }
              },
              onError: (event: any) => {
                console.warn('YouTube Player error code:', event.data);
                // Codes 101, 150 or other embed errors
                if (event.data === 101 || event.data === 150 || event.data === 2 || event.data === 5) {
                  if (isMounted) setHasError(true);
                }
              },
            },
          });
        } catch (e) {
          console.warn('Failed to initialize YT.Player', e);
          if (isMounted) setHasError(true);
        }
      };

      if (!window.YT || !window.YT.Player) {
        // Check if script tag is already in head
        const existingScript = document.getElementById('youtube-iframe-api');
        if (!existingScript) {
          const tag = document.createElement('script');
          tag.id = 'youtube-iframe-api';
          tag.src = 'https://www.youtube.com/iframe_api';
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
        }

        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevReady) prevReady();
          if (isMounted) initPlayer();
        };
      } else {
        initPlayer();
      }

      return () => {
        isMounted = false;
      };
    }, [onReadyStateChange, playbackRate, startSegmentMonitoring]);

    // Update playback rate when prop changes
    useEffect(() => {
      if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
        try {
          playerRef.current.setPlaybackRate(playbackRate);
        } catch (e) {
          // ignore
        }
      }
    }, [playbackRate]);

    useImperativeHandle(ref, () => ({
      playSegment: (start: number, end: number, options = {}) => {
        if (!playerRef.current) return;
        clearTracking();

        segmentRef.current = {
          start,
          end,
          loop: !!options.loop,
          onEnded: options.onEnded,
          isActive: true,
        };
        segmentStartedAtRef.current = Date.now();

        try {
          playerRef.current.seekTo(start, true);
          playerRef.current.playVideo();
          setIsPlaying(true);
          startSegmentMonitoring();
        } catch (e) {
          console.warn('Error playing segment', e);
        }
      },
      pause: () => {
        clearTracking();
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          try {
            playerRef.current.pauseVideo();
            setIsPlaying(false);
          } catch (e) {
            // ignore
          }
        }
      },
      play: () => {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          try {
            playerRef.current.playVideo();
            setIsPlaying(true);
            startSegmentMonitoring();
          } catch (e) {
            // ignore
          }
        }
      },
      seekTo: (seconds: number) => {
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
          try {
            playerRef.current.seekTo(seconds, true);
          } catch (e) {
            // ignore
          }
        }
      },
      getCurrentTime: () => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            return playerRef.current.getCurrentTime();
          } catch (e) {
            return currentLocalTime;
          }
        }
        return currentLocalTime;
      },
      setPlaybackRate: (rate: number) => {
        if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
          try {
            playerRef.current.setPlaybackRate(rate);
          } catch (e) {
            // ignore
          }
        }
      },
      stopSegmentTracking: () => {
        clearTracking();
      },
      mute: () => {
        if (playerRef.current && typeof playerRef.current.mute === 'function') {
          try {
            playerRef.current.mute();
          } catch (e) {
            // ignore
          }
        }
      },
      unMute: () => {
        if (playerRef.current && typeof playerRef.current.unMute === 'function') {
          try {
            playerRef.current.unMute();
          } catch (e) {
            // ignore
          }
        }
      },
    }));

    const youtubeDirectUrl = `https://www.youtube.com/watch?v=${MOVIE_INFO.videoId}&t=${MOVIE_INFO.rangeStart}s`;

    return (
      <div className="w-full bg-[#0E2926] overflow-hidden shadow-sm">
        {/* 16:9 Player container */}
        <div className="relative w-full pb-[56.25%] bg-[#091C1A]">
          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
            id="zootopia-yt-player"
          />

          {/* Fallback overlay if YouTube blocks iframe or fails */}
          {hasError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-[#0E2926]/95 text-white">
              <AlertCircle className="w-10 h-10 text-[#F4D17A] mb-2 shrink-0" />
              <p className="text-base font-semibold text-[#EFFAF6] mb-1">
                This video can't play inside the app.
              </p>
              <p className="text-xs text-[#BCE2D5] mb-4 max-w-xs">
                YouTube restrictions or network policy may block embedded playback. You can still practice sentences, record, and self-check!
              </p>
              <a
                href={youtubeDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F9B76] hover:bg-[#0C8263] text-white rounded-xl text-sm font-semibold transition-colors shadow-md"
              >
                <span>Open on YouTube (YouTube에서 열기)</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Loading indicator while player initializes */}
          {!isReady && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0E2926] text-[#9ED4C4] text-sm">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#5ED9B0] animate-ping" />
                Loading Zootopia clip...
              </span>
            </div>
          )}
        </div>

        {/* Mandatory One-line Educational Credit (at least 13px) */}
        {showCredit && (
          <div className="px-3 py-1.5 bg-[#0E2926]/95 border-t border-[#1D4741] text-[13px] leading-snug text-[#9ED4C4] text-center select-none truncate">
            {MOVIE_INFO.oneLineCredit}
          </div>
        )}
      </div>
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';

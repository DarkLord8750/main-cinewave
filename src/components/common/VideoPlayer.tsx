import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Settings,
  ArrowLeft,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Headphones,
  Subtitles,
  Monitor,
  Cast as CastIcon
} from "lucide-react";
import { useWatchHistoryStore } from "../../stores/watchHistoryStore";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import Hls from "hls.js";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "videojs-hls-quality-selector";
import LoadingSpinner from "./LoadingSpinner";

interface VideoQuality {
  label: string;
  value: string;
}

interface VideoPlayerProps {
  title: string;
  description: string;
  masterUrl: string;  // Single master playlist URL
  contentId: string;
  onClose?: () => void;
  autoPlay?: boolean;
  isFullScreen?: boolean;
  episodeInfo?: {
    season: number;
    episode: number;
    title: string;
  };
  startTime?: number;
  subtitleUrls?: { [key: string]: string };  // Add subtitle URLs prop
  episodeId?: string; // <-- new
}

// Add audio track interface
interface AudioTrack {
  id: string;
  label: string;
  language: string;
}

// Add subtitle track interface
interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  url: string;
}

interface SubtitleStyle {
  fontSize: string;
  fontFamily: string;
  backgroundColor: string;
  textColor: string;
  backgroundOpacity: number;
}

// Add subtitle manager class
class SubtitleManager {
  private video: HTMLVideoElement;
  private currentTrack: string = 'off';
  private tracks: Map<string, TextTrack> = new Map();
  private isInitialized: boolean = false;
  private subtitleUrls: { [key: string]: string } = {};

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  initialize(subtitleUrls: { [key: string]: string }, onReady?: () => void) {
    // Always clear tracks before initializing to prevent duplication
    this.clearTracks();
    this.isInitialized = false;
    this.subtitleUrls = subtitleUrls;
    // Add new tracks
    Object.entries(subtitleUrls).forEach(([lang, url]) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = url;
      track.srclang = lang;
      track.label = this.getLanguageLabel(lang);
      track.default = lang === 'en';
      this.video.appendChild(track);
    });
    // Store track references
    setTimeout(() => {
      const textTracks = Array.from(this.video.textTracks);
      this.tracks.clear();
      textTracks.forEach(track => {
        this.tracks.set(track.language, track);
      });
      this.isInitialized = true;
      // Re-sync current track
      this.setTrack(this.currentTrack);
      if (onReady) onReady();
    }, 0);
  }

  private clearTracks() {
    // Remove all <track> elements
    const existingTracks = Array.from(this.video.getElementsByTagName('track'));
    existingTracks.forEach(track => track.remove());
    this.tracks.clear();
  }

  private getLanguageLabel(lang: string): string {
    const labels: { [key: string]: string } = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese'
    };
    return labels[lang] || lang;
  }

  setTrack(trackId: string) {
    this.currentTrack = trackId;
    this.tracks.forEach((track, lang) => {
      track.mode = lang === trackId ? 'showing' : 'hidden';
    });
  }

  getCurrentTrack(): string {
    return this.currentTrack;
  }

  getAvailableTracks(): SubtitleTrack[] {
    return Array.from(this.tracks.entries()).map(([lang, track]) => ({
      id: lang,
      label: track.label,
      language: lang,
      url: this.subtitleUrls[lang] || ''
    }));
  }

  refresh() {
    // Always re-initialize to ensure no duplication
    this.initialize(this.subtitleUrls);
  }

  destroy() {
    this.clearTracks();
    this.isInitialized = false;
    this.currentTrack = 'off';
    this.subtitleUrls = {};
  }
}

// Utility function to format time
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const VideoPlayer = ({
  title,
  masterUrl,
  contentId,
  onClose,
  autoPlay = true,
  isFullScreen = false,
  episodeInfo,
  startTime,
  subtitleUrls = {},  // Default to empty object
  episodeId,
}: VideoPlayerProps) => {
  // Navigation and State Management
  const navigate = useNavigate();
  const { currentProfile } = useAuthStore();
  const { updateWatchTime, getWatchTime } = useWatchHistoryStore();
  const { setIsVideoPlaying } = useUIStore();

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(isFullScreen);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>("720p");
  const [isMobile] = useState(window.innerWidth <= 768);
  const [isBuffering, setIsBuffering] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{
    time: number;
    x: number;
  } | null>(null);
  const [lastWatchedTime, setLastWatchedTime] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchType, setTouchType] = useState<'seek' | 'volume' | null>(null);
  const [touchProgress, setTouchProgress] = useState<number | null>(null);
  const [touchVolume, setTouchVolume] = useState<number | null>(null);
  const [showTouchIndicator, setShowTouchIndicator] = useState(false);
  const [touchIndicatorPosition, setTouchIndicatorPosition] = useState({ x: 0, y: 0 });
  const [touchIndicatorValue, setTouchIndicatorValue] = useState<number | null>(null);
  const [touchIndicatorType, setTouchIndicatorType] = useState<'seek' | 'volume' | null>(null);

  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<string>('default');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<VideoQuality[]>([]);
  const [isQualityChanging, setIsQualityChanging] = useState(false);
  const [qualityChangeProgress, setQualityChangeProgress] = useState(0);
  const [currentAutoQuality, setCurrentAutoQuality] = useState<string>("");
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<string>('off');
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontSize: '100%',
    fontFamily: 'Arial',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    backgroundOpacity: 0.5
  });

  const [isAutoQuality, setIsAutoQuality] = useState(true);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const watchTimeUpdateRef = useRef<NodeJS.Timeout>();
  const dragProgressRef = useRef<number | null>(null);
  const savedPositionRef = useRef<number>(0);
  // Track if initial quality has been set
  const initialQualitySet = useRef(false);

  // Add debounce ref for quality changes
  const qualityChangeTimeoutRef = useRef<NodeJS.Timeout>();

  // Add state for tracking if we're interacting with controls
  const [isInteractingWithControls, setIsInteractingWithControls] = useState(false);

  // Add state for touch controls
  const [isTouchingControls, setIsTouchingControls] = useState(false);

  // Add state for progress bar
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  const RAF_ID = useRef<number>();
  const seekTimeoutRef = useRef<NodeJS.Timeout>();
  const wasPlayingBeforeTouch = useRef<boolean>(false);

  // Add state for orientation
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // Add new state for Netflix-like UI
  const [showTitleOverlay, setShowTitleOverlay] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);

  // Add a ref to store the current subtitle track
  const currentSubtitleRef = useRef<string>('off');

  // Add subtitle manager ref
  const subtitleManagerRef = useRef<SubtitleManager | null>(null);

  // Add new state for watch history
  const [watchHistoryUpdatePending, setWatchHistoryUpdatePending] = useState(false);
  const watchHistoryDebounceRef = useRef<NodeJS.Timeout>();
  const lastWatchTimeRef = useRef<number>(0);

  // Add a ref for the controls area
  const controlsAreaRef = useRef<HTMLDivElement>(null);

  // Helper to check if mouse is over controls
  const isMouseOverControls = useRef(false);

  // Add state for hold-to-seek
  const [isHolding, setIsHolding] = useState(false);
  const [isHoldingToSeek, setIsHoldingToSeek] = useState(false);
  const [isTouchSeeking, setIsTouchSeeking] = useState(false);
  const [isSmoothSeeking, setIsSmoothSeeking] = useState(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout>();
  const seekAnimationRef = useRef<number>();
  const touchStartTimeRef = useRef<number>(0);
  const initialTouchXRef = useRef<number>(0);
  const initialTimeRef = useRef<number>(0);

  // New simplified touch handlers for smooth mobile seeking
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Only handle touches on the progress bar itself
    if (!progressRef.current?.contains(e.target as Node) || !videoRef.current) {
      return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    
    // Store initial touch state
    wasPlayingBeforeTouch.current = !videoRef.current.paused;
    initialTouchXRef.current = touch.clientX;
    initialTimeRef.current = videoRef.current.currentTime;
    
    // Set initial drag state
    setDragProgress(percent * videoRef.current.duration);
    setIsTouchSeeking(true);
    
    // Pause video during seek for better performance
    if (wasPlayingBeforeTouch.current) {
      videoRef.current.pause();
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Only handle moves if we're actively seeking and on the progress bar
    if (!progressRef.current || !videoRef.current || !isTouchSeeking) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    const rect = progressRef.current.getBoundingClientRect();
    // Ensure touch is within the progress bar bounds
    const clientX = Math.max(rect.left, Math.min(touch.clientX, rect.right));
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = percent * videoRef.current.duration;
    
    // Update drag preview
    setDragProgress(newTime);
    
    // Update hover position for tooltip
    setHoverPosition({
      x: clientX - rect.left,
      time: newTime
    });
  }, [isTouchSeeking]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Only handle end if we were seeking
    if (!videoRef.current || !isTouchSeeking) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // If this was a tap (not a drag), seek to that position
    if (dragProgress === null && progressRef.current) {
      const touch = e.changedTouches[0];
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const newTime = percent * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    } else if (dragProgress !== null) {
      // Seek to final position if we were dragging
      videoRef.current.currentTime = dragProgress;
      setCurrentTime(dragProgress);
    }
    
    // Resume playback if it was playing
    if (wasPlayingBeforeTouch.current) {
      videoRef.current.play().catch(console.error);
    }
    
    // Clean up
    setDragProgress(null);
    setIsTouchSeeking(false);
    setHoverPosition(null);
  }, [isTouchSeeking, dragProgress]);
  
  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      if (seekAnimationRef.current) {
        cancelAnimationFrame(seekAnimationRef.current);
      }
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);
  
  // Reset touch state helper
  const resetTouchState = useCallback(() => {
    setIsHolding(false);
    setIsHoldingToSeek(false);
    setIsTouchSeeking(false);
    setIsSmoothSeeking(false);
    setDragProgress(null);
    setHoverPosition(null);
    setIsBuffering(false);
    wasPlayingBeforeTouch.current = false;
  }, []);

  // Progress bar handlers moved to where they are used


  // Quality and audio handlers


  // Toggle fullscreen function
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(console.error);
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(console.error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
      if (seekAnimationRef.current) {
        cancelAnimationFrame(seekAnimationRef.current);
      }
    };
  }, []);

  // Add effect to manage video playing state
  useEffect(() => {
    setIsVideoPlaying(true);
    return () => {
      setIsVideoPlaying(false);
    };
  }, [setIsVideoPlaying]);

  // Initialize HLS if needed
  useEffect(() => {
    let localHls: Hls | null = null;
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // Clean up previous HLS instance
    if (hlsInstance) {
      hlsInstance.destroy();
    }

    if (masterUrl && typeof Hls !== "undefined" && Hls.isSupported()) {
      try {
        // Network-aware HLS startup
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        const downlink = connection?.downlink || 1; // Default to 1 Mbps if not available
        
        // Determine start level based on connection speed
        let startLevel = -1; // Auto by default
        if (downlink < 1) {
          startLevel = 0; // Start with lowest quality for slow connections
        } else if (downlink < 2) {
          startLevel = 1; // Start with second lowest for moderate connections
        }
        // For fast connections (>= 2 Mbps), use auto (-1)

        const hls = new Hls({
          maxBufferLength: 5,
          maxMaxBufferLength: 10,
          maxBufferSize: 5 * 1000 * 1000, // Lower buffer size for faster start
          maxBufferHole: 0.1, // allow smaller gaps for slow networks
          abrEwmaDefaultEstimate: downlink < 1 ? 64000 : 500000, // Adjust based on connection
          startLevel: startLevel,
          lowLatencyMode: true,
          backBufferLength: 30,
          autoStartLoad: true,
          startPosition: -1,
          manifestLoadingTimeOut: 20000,
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 20000,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 1000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 1000,
          testBandwidth: true,
          progressive: true,
          enableWorker: true,
          startFragPrefetch: false, // Don't prefetch for faster first play
          maxFragLookUpTolerance: 0.5,
          maxStarvationDelay: 2,
          maxLoadingDelay: 2,
          minAutoBitrate: 0,
          highBufferWatchdogPeriod: 2,
          nudgeMaxRetry: 5,
          nudgeOffset: 0.1,
          abrEwmaFastLive: 1,
          abrEwmaSlowLive: 3,
          abrBandWidthFactor: 0.7,
          abrBandWidthUpFactor: 0.7,
          abrMaxWithRealBitrate: true,
          xhrSetup: function(xhr: XMLHttpRequest, url: string) {
            xhr.withCredentials = false;
            if (/\.(ts|m4s|mp4)(\?|$)/i.test(url)) {
              if (url.indexOf('?') === -1) {
                url += '?_=' + Date.now();
              } else {
                url += '&_=' + Date.now();
              }
            }
          }
        });
        localHls = hls;
        
        // Add HLS event listeners
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS Error:', data);
          if (data.fatal) {
            let msg = 'A fatal playback error occurred.';
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              msg = 'Network error. Please check your connection.';
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              msg = 'Media error. Please try again.';
            }
            setFatalError(msg);
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          const qualities: VideoQuality[] = data.levels.map((level: any, index: number) => ({
            label: level.height ? `${level.height}p` : (level.bitrate ? `${Math.round(level.bitrate/1000)}kbps` : 'Unknown'),
            value: index.toString()
          }));
          qualities.unshift({ label: "AUTO", value: "-1" });
          setAvailableQualities(qualities);
          // Set initial auto quality if in auto mode
          if (hls.currentLevel === -1 && hls.levels && hls.levels.length > 0) {
            const autoLevel = hls.levels[hls.nextAutoLevel] || hls.levels[0];
            setCurrentAutoQuality(autoLevel.height ? `${autoLevel.height}p` : (autoLevel.bitrate ? `${Math.round(autoLevel.bitrate/1000)}kbps` : 'Unknown'));
          }
          // Set audio tracks
          if (data.audioTracks && data.audioTracks.length > 0) {
            const tracks: AudioTrack[] = data.audioTracks.map((track: any, index: number) => ({
              id: index.toString(),
              label: track.name || `Audio ${index + 1}`,
              language: track.lang || 'unknown'
            }));
            setAudioTracks(tracks);
          }
          // Only refresh subtitles after manifest parsed
          if (subtitleManagerRef.current) {
            subtitleManagerRef.current.refresh();
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          // Always update currentAutoQuality to reflect the actual playing quality
          const level = hls.autoLevelEnabled ? hls.levels[hls.nextAutoLevel] : hls.levels[hls.currentLevel];
          const qualityLabel = level && level.height ? `${level.height}P` : (level && level.bitrate ? `${Math.round(level.bitrate/1000)}kbps` : 'Unknown');
          setCurrentAutoQuality(qualityLabel);
          // UI always reflects currentQuality and isAutoQuality
        });
        // Sync currentAudioTrack with actual playing audio track
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
          if (typeof data.id === 'number') {
            setCurrentAudioTrack(data.id.toString());
          } else if (typeof hls.audioTrack === 'number') {
            setCurrentAudioTrack(hls.audioTrack.toString());
          }
        });

        hls.attachMedia(video);
        hls.loadSource(masterUrl);
        setTimeout(() => {
          video.play().catch(() => {});
        }, 0);
        setHlsInstance(hls);
      } catch (error) {
        setPlayerError("Failed to initialize video player. Please try refreshing the page.");
      }
    }
    // Cleanup function
    return () => {
      if (localHls) {
        localHls.destroy();
      }
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [masterUrl]);

  // Optimize watch history update function
  const updateWatchHistory = useCallback(async (time: number, completed: boolean = false) => {
    if (!currentProfile?.id || !contentId || watchHistoryUpdatePending) return;

    // Only update if time has changed significantly (more than 5 seconds)
    if (Math.abs(time - lastWatchTimeRef.current) < 5 && !completed) return;

    try {
      setWatchHistoryUpdatePending(true);
      lastWatchTimeRef.current = time;

      // Clear any pending updates
      if (watchHistoryDebounceRef.current) {
        clearTimeout(watchHistoryDebounceRef.current);
      }

      // Debounce the update
      watchHistoryDebounceRef.current = setTimeout(async () => {
        try {
          // If video is completed (90-95%), reset the watch time to 0
          if (completed) {
            await updateWatchTime(currentProfile.id, contentId, 0, true, episodeId);
            console.log("Video completed, resetting watch time to 0");
          } else {
            await updateWatchTime(currentProfile.id, contentId, Math.floor(time), false, episodeId);
            console.log(`Watch history updated: ${time}s, completed: ${completed}`);
          }
          } catch (error) {
            console.error("Error updating watch history:", error);
        } finally {
          setWatchHistoryUpdatePending(false);
        }
      }, 2000); // 2 second debounce
    } catch (error) {
      console.error("Error in watch history update:", error);
      setWatchHistoryUpdatePending(false);
    }
  }, [currentProfile?.id, contentId, updateWatchTime, episodeId]);

  // Update handleTimeUpdate to use the new function
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    
    const currentTime = videoRef.current.currentTime;
    const videoDuration = videoRef.current.duration || 1; // Avoid division by zero
    
    setCurrentTime(currentTime);
    savedPositionRef.current = currentTime;

    // Only consider video completed if we're at the very end (last 1%)
    const isAtEnd = currentTime >= videoDuration * 0.99;
    
    // Update watch history with current time
    updateWatchHistory(currentTime, isAtEnd);
    
    // Don't pause the video automatically, let it play to the end
    // The ended event will handle the completion
  }, [updateWatchHistory]);

  // Update handleLoadedMetadata to check for completed videos
  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);

    // Check if video was previously completed
    const isCompleted = lastWatchedTime && lastWatchedTime >= videoRef.current.duration * 0.9;
    
    if (isCompleted) {
      // Reset to beginning if video was completed
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      console.log("Video was previously completed, resetting to start");
    } else if (typeof startTime === "number" && startTime > 0) {
      videoRef.current.currentTime = startTime;
    } else if (typeof lastWatchedTime === "number" && lastWatchedTime > 0) {
      videoRef.current.currentTime = lastWatchedTime;
    }
  }, [startTime, lastWatchedTime]);

  // Update handleEnded to properly reset the video
  const handleEnded = useCallback(() => {
    if (!videoRef.current) return;
    
    setIsPlaying(false);
    setCurrentTime(0);
    videoRef.current.currentTime = 0; // Force reset to beginning
    
    if (currentProfile?.id) {
      try {
        // Reset watch time to 0 when video ends
        updateWatchHistory(0, true);
        console.log("Video ended, resetting watch time to 0");
      } catch (error) {
        console.error("Error updating watch history at end:", error);
      }
    }
  }, [currentProfile?.id, updateWatchHistory]);

  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
    setIsLoading(true);
  }, []);

  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
    setIsLoading(false);
    setIsPlaying(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsBuffering(false);
    setIsLoading(false);
  }, []);


  // Add error recovery effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleErrorRecovery = async () => {
      if (playerError) {
        try {
          // Try to recover playback
          await video.play();
          setPlayerError(null);
        } catch (error) {
          console.error("Error recovering playback:", error);
        }
      }
    };

    // Try to recover on user interaction
    const handleUserInteraction = () => {
      handleErrorRecovery();
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [playerError]);

  // Update video error handler to set fatalError
  const handleError = useCallback((event: ErrorEvent) => {
    const video = event.target as HTMLVideoElement;
    if (video.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
    if (video.error?.code === MediaError.MEDIA_ERR_NETWORK || video.error?.code === MediaError.MEDIA_ERR_DECODE) {
      setFatalError('A fatal video error occurred. Please try again.');
    }
  }, []);

  // Update video event listeners effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      if (watchTimeUpdateRef.current) {
        clearTimeout(watchTimeUpdateRef.current);
      }
    };
  }, [
    handleTimeUpdate,
    handleLoadedMetadata,
    handleEnded,
    handleWaiting,
    handlePlaying,
    handleCanPlay,
    handleError
  ]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Update fetch last watched time effect
  useEffect(() => {
    let isMounted = true;

    async function fetchLastWatched() {
      if (currentProfile?.id && contentId) {
            try {
              const time = await getWatchTime(currentProfile.id, contentId, episodeId);
              if (isMounted && typeof time === "number" && time > 0) {
                setLastWatchedTime(time);
            lastWatchTimeRef.current = time;
            console.log(`Restored watch time: ${time}s`);
              }
            } catch (error) {
              console.error("Error fetching last watched time:", error);
        }
      }
    }

    fetchLastWatched();
    return () => {
      isMounted = false;
    };
  }, [currentProfile?.id, contentId, episodeId, getWatchTime]);

  // Player Controls
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    try {
      // Force a small delay to ensure state is consistent
      setTimeout(() => {
    if (isPlaying) {
          // Force pause and ensure state is updated
          videoRef.current?.pause();
          setIsPlaying(false);
      setUserPaused(true);
          
          // Double check if video is actually paused
          if (videoRef.current && !videoRef.current.paused) {
            console.log("Forcing pause...");
      videoRef.current.pause();
            setIsPlaying(false);
          }
    } else {
      // Always unmute and set volume on user play
          if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
      videoRef.current.volume = volume || 1;
            setUserPaused(false);
            
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  setIsPlaying(true);
                  // Double check if video is actually playing
                  if (videoRef.current && videoRef.current.paused) {
                    console.log("Forcing play...");
                    videoRef.current.play().catch(console.error);
                  }
                })
                .catch(error => {
                  console.error("Error playing video:", error);
                  setPlayerError("Failed to play video. Please try again.");
                  setIsPlaying(false);
                });
            }
          }
        }
      }, 50); // Small delay to ensure state consistency
    } catch (error) {
      console.error("Error toggling play:", error);
      setIsPlaying(false);
    }
  }, [isPlaying, volume]);

  const handleVolumeChange = (value: number) => {
    if (!videoRef.current) return;

    const newVolume = value / 100;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    // Always unmute on volume change if volume > 0
    if (newVolume > 0) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;

    if (isMuted) {
      // When unmuting, restore to previous volume or default to 1 if volume is 0
      const newVolume = volume > 0 ? volume : 1;
      videoRef.current.volume = newVolume;
      videoRef.current.muted = false;
      setIsMuted(false);
      setVolume(newVolume);
    } else {
      // When muting, set volume to 0 and update state
      videoRef.current.volume = 0;
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  // Ref to store resume time after quality/audio change
  const resumeTimeRef = useRef<number | null>(null);
  const resumeWasPlayingRef = useRef<boolean>(false);

  // Update the quality change handler
  const handleQualityChange = (quality: string) => {
    if (!hlsInstance || isQualityChanging) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // If already on this quality, just update UI and return
    if ((quality === "-1" && isAutoQuality) || (quality === currentQuality && !isAutoQuality)) {
      setCurrentQuality(quality);
      setIsAutoQuality(quality === "-1");
      setIsQualityChanging(false);
      setShowQualityMenu(false);
      return;
    }

    setIsQualityChanging(true);
    // Fallback: always reset isQualityChanging after 2s
    setTimeout(() => setIsQualityChanging(false), 2000);

    // Save current state
    resumeTimeRef.current = videoEl.currentTime;
    resumeWasPlayingRef.current = !videoEl.paused;
    const currentAudioTrackId = currentAudioTrack;
    const currentSubtitleId = subtitleManagerRef.current?.getCurrentTrack();
    if (quality === "-1") {
      hlsInstance.currentLevel = -1;
      setCurrentQuality("-1");
      setIsAutoQuality(true);
      // Always update auto label
      const autoLevel = hlsInstance.levels[hlsInstance.nextAutoLevel] || hlsInstance.levels[0];
      setCurrentAutoQuality(autoLevel.height ? `${autoLevel.height}P` : (autoLevel.bitrate ? `${Math.round(autoLevel.bitrate/1000)}kbps` : 'Unknown'));
    } else {
      hlsInstance.currentLevel = parseInt(quality);
    setCurrentQuality(quality);
      setIsAutoQuality(false);
    }
    setShowQualityMenu(false);
    // Restore audio track
    if (currentAudioTrackId) {
      try {
        hlsInstance.audioTrack = parseInt(currentAudioTrackId);
      } catch (error) {}
    }
    // Restore subtitle track if needed
    if (currentSubtitleId && currentSubtitleId !== 'off' && subtitleManagerRef.current) {
        subtitleManagerRef.current.setTrack(currentSubtitleId);
      }
    // Do not setCurrentQuality here; wait for LEVEL_SWITCHED
  };

  // Resume playback after quality switch when video is ready and only if isQualityChanging
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    function tryResumePlayback() {
      if (!isQualityChanging) return;
      if (!videoEl) return;
      if (
        resumeTimeRef.current !== null &&
        Math.abs((videoEl.currentTime || 0) - resumeTimeRef.current) > 0.5 &&
        videoEl.duration > resumeTimeRef.current
      ) {
        videoEl.currentTime = resumeTimeRef.current;
      }
      if (resumeWasPlayingRef.current) {
        videoEl.play().catch(() => {});
      }
      resumeTimeRef.current = null;
      resumeWasPlayingRef.current = false;
      setIsQualityChanging(false);
    }
    videoEl.addEventListener('canplay', tryResumePlayback);
    videoEl.addEventListener('loadedmetadata', tryResumePlayback);
    return () => {
      videoEl.removeEventListener('canplay', tryResumePlayback);
      videoEl.removeEventListener('loadedmetadata', tryResumePlayback);
    };
  }, [isQualityChanging]);

  // LEVEL_SWITCHED event: update currentQuality and auto label
  useEffect(() => {
    if (!hlsInstance) return;
    const onLevelSwitched = (event: any, data: any) => {
      const hls = hlsInstance;
      let activeLevel = hls.autoLevelEnabled ? hls.levels[hls.nextAutoLevel] : hls.levels[hls.currentLevel];
      const qualityLabel = activeLevel && activeLevel.height ? `${activeLevel.height}P` : (activeLevel && activeLevel.bitrate ? `${Math.round(activeLevel.bitrate/1000)}kbps` : 'Unknown');
      setCurrentAutoQuality(qualityLabel);
      if (hls.autoLevelEnabled) {
        setCurrentQuality('-1');
        setIsAutoQuality(true);
      } else {
        setCurrentQuality(hls.currentLevel.toString());
        setIsAutoQuality(false);
      }
    };
    hlsInstance.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
    return () => {
      hlsInstance.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
    };
  }, [hlsInstance]);

  // Only refresh subtitles when subtitleUrls change
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitleUrls || Object.keys(subtitleUrls).length === 0) {
      return;
    }
    // Clean up previous subtitle manager
    if (subtitleManagerRef.current) {
      subtitleManagerRef.current.destroy();
      subtitleManagerRef.current = null;
    }
    // Initialize subtitle manager
    subtitleManagerRef.current = new SubtitleManager(video);
    subtitleManagerRef.current.initialize(subtitleUrls, () => {
      const tracks = subtitleManagerRef.current!.getAvailableTracks();
      setSubtitleTracks(tracks);
      if (tracks.length > 0) {
        const defaultTrack = tracks.find(track => track.language === 'en') || tracks[0];
        setCurrentSubtitleTrack(defaultTrack.id);
        subtitleManagerRef.current!.setTrack(defaultTrack.id);
      } else {
        setCurrentSubtitleTrack('off');
      }
    });
    // Add track change listener
    const handleTrackChange = () => {
      const textTracks = Array.from(video.textTracks);
      const showingTrack = textTracks.find(track => track.mode === 'showing');
      if (showingTrack) {
        setCurrentSubtitleTrack(showingTrack.language);
      } else {
        setCurrentSubtitleTrack('off');
      }
    };
    video.addEventListener('texttrackchange', handleTrackChange);
    return () => {
      video.removeEventListener('texttrackchange', handleTrackChange);
      if (subtitleManagerRef.current) {
        subtitleManagerRef.current.destroy();
        subtitleManagerRef.current = null;
      }
    };
  }, [subtitleUrls]);

  // Update the audio track change handler
  const handleAudioTrackChange = (audioTrackId: string) => {
    if (!hlsInstance || isQualityChanging) return;
    setIsQualityChanging(true);
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const wasPlaying = !videoEl.paused;
    const currentTime = videoEl.currentTime;
    const currentSubtitleId = subtitleManagerRef.current?.getCurrentTrack();
    resumeTimeRef.current = currentTime;
    resumeWasPlayingRef.current = wasPlaying;
    hlsInstance.audioTrack = parseInt(audioTrackId);
    setCurrentAudioTrack(audioTrackId);
    setShowAudioMenu(false);
    if (subtitleManagerRef.current) {
      subtitleManagerRef.current.refresh();
      if (currentSubtitleId && currentSubtitleId !== 'off') {
        subtitleManagerRef.current.setTrack(currentSubtitleId);
      }
    }
    setIsQualityChanging(false);
  };

  // Seek to resume time after quality/audio change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function tryResumePlayback() {
      if (!video) return;
      if (
        resumeTimeRef.current !== null &&
        Math.abs((video.currentTime || 0) - resumeTimeRef.current) > 0.5 &&
        video.duration > resumeTimeRef.current
      ) {
        video.currentTime = resumeTimeRef.current;
      }
      if (resumeWasPlayingRef.current) {
        video.play().catch(() => {});
      }
      resumeTimeRef.current = null;
      resumeWasPlayingRef.current = false;
    }
    video.addEventListener('loadedmetadata', tryResumePlayback);
    video.addEventListener('canplay', tryResumePlayback);
    return () => {
      video.removeEventListener('loadedmetadata', tryResumePlayback);
      video.removeEventListener('canplay', tryResumePlayback);
    };
  }, []);

  // Show controls on any mouse move (global)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // If mouse is over controls, don't hide
      if (controlsAreaRef.current && controlsAreaRef.current.contains(e.target as Node)) {
        isMouseOverControls.current = true;
    setShowControls(true);
        setShowTitleOverlay(true);
        return;
      } else {
        isMouseOverControls.current = false;
        setShowControls(true);
        setShowTitleOverlay(true);
        // Start hide timer
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
          if (!isMouseOverControls.current && isPlaying) {
        setShowControls(false);
            setShowTitleOverlay(false);
          }
        }, 2500);
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isPlaying]);

  // Prevent hiding when mouse is over controls
  const handleControlsMouseEnter = () => {
    isMouseOverControls.current = true;
    setShowControls(true);
    setShowTitleOverlay(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  };
  const handleControlsMouseLeave = () => {
    isMouseOverControls.current = false;
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isMouseOverControls.current && isPlaying) {
        setShowControls(false);
        setShowTitleOverlay(false);
      }
    }, 2500);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleBack = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      if (onClose) {
        onClose();
      } else {
        navigate(-1);
      }
    } catch (error) {
      console.error("Error handling back navigation:", error);
      if (onClose) {
        onClose();
      } else {
        navigate(-1);
      }
    }
  };

  const seek = (seconds: number) => {
    if (!videoRef.current || !duration || isNaN(duration) || duration === 0)
      return;
      
    // Calculate the new time position
    let newTime = videoRef.current.currentTime + seconds;
    newTime = Math.max(0, Math.min(newTime, duration));
    
    console.log(`Seeking ${seconds > 0 ? 'forward' : 'backward'} to ${newTime}s`);
    
    // Handle HLS seeking specially to avoid segment looping
    if (hlsInstance) {
      try {
        // Remember if we were playing
        const wasPlaying = !videoRef.current.paused;
        
        // Set the new time
        videoRef.current.currentTime = newTime;
        
        // Force playback to continue if it was playing
        if (wasPlaying) {
          videoRef.current.play()
            .then(() => console.log("Playback resumed after seek buttons"))
            .catch(err => console.error("Error resuming playback after seek buttons:", err));
        }
      } catch (error) {
        console.error("Error during seek button operation:", error);
      }
    } else {
      // Standard seek for non-HLS playback
      videoRef.current.currentTime = newTime;
    }
    
    // Update UI
    setCurrentTime(newTime);
  };

  // Touch handlers for the progress bar are defined at the top of the component

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard and Accessibility Enhancements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA")
      )
        return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowright":
          seek(5);
          break;
        case "arrowleft":
          seek(-5);
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        case "arrowup":
          handleVolumeChange(Math.min(100, (isMuted ? 0 : volume * 100) + 5));
          break;
        case "arrowdown":
          handleVolumeChange(Math.max(0, (isMuted ? 0 : volume * 100) - 5));
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMuted, volume, isPlaying]);

  // Update the progress bar handlers
  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    
    isDraggingRef.current = true;
    document.body.style.userSelect = 'none';

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(videoRef.current.duration, percent * videoRef.current.duration));
    
      setDragProgress(newTime);
      
    window.addEventListener('mousemove', handleDocumentMouseMove);
    window.addEventListener('mouseup', handleDocumentMouseUp);
  }, []);

  const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !progressRef.current || !videoRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(videoRef.current.duration, percent * videoRef.current.duration));
    
      setDragProgress(newTime);
  }, []);

  const handleDocumentMouseUp = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !videoRef.current || !progressRef.current) return;
    
    isDraggingRef.current = false;
    document.body.style.userSelect = '';
    
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(videoRef.current.duration, percent * videoRef.current.duration));
    
    // Seek to the new time
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setDragProgress(null);
    
    window.removeEventListener('mousemove', handleDocumentMouseMove);
    window.removeEventListener('mouseup', handleDocumentMouseUp);
  }, []);

  // Update the progress hover handler
  const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current || isDraggingRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percentage = x / rect.width;
    const time = percentage * videoRef.current.duration;

    setHoverPosition({ time, x: e.clientX - rect.left });
    setPreviewTime(time);
    setShowPreview(false);
  }, []);

  const handleProgressLeave = useCallback(() => {
    if (!isDraggingRef.current) {
      setHoverPosition(null);
      setShowPreview(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (RAF_ID.current) {
        cancelAnimationFrame(RAF_ID.current);
      }
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  const updateSeekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    dragProgressRef.current = newTime;
    setDragProgress(newTime);
    
    // Update video position immediately
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const updateSeekFromTouchEvent = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const touch = e.touches[0];
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (touch.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    dragProgressRef.current = newTime;
    setDragProgress(newTime);
    
    // Update video position immediately
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  // Debug: Log current state
  console.log("Video Player State:", {
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    isBuffering,
    currentQuality,
  });

  // Update the subtitle track change handler
  const handleSubtitleTrackChange = useCallback((trackId: string) => {
    if (!subtitleManagerRef.current) return;
    
    subtitleManagerRef.current.setTrack(trackId);
    setCurrentSubtitleTrack(trackId);
    setShowSubtitleMenu(false);
  }, []);

  // Update the subtitle restoration effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const restoreSubtitles = () => {
      const currentTrack = subtitleManagerRef.current?.getCurrentTrack();
      if (currentTrack && currentTrack !== 'off') {
        const textTracks = Array.from(video.textTracks);
        textTracks.forEach(track => {
          track.mode = track.language === currentTrack ? 'showing' : 'hidden';
        });
      }
    };

    // Add event listeners for quality and audio changes
    const handleQualityChange = () => {
      setTimeout(restoreSubtitles, 500); // Increased delay to ensure tracks are ready
    };

    const handleAudioChange = () => {
      setTimeout(restoreSubtitles, 500);
    };

    // Add more events to catch all cases where subtitles need to be restored
    video.addEventListener('loadedmetadata', restoreSubtitles);
    video.addEventListener('canplay', restoreSubtitles);
    video.addEventListener('loadeddata', restoreSubtitles);
    video.addEventListener('play', restoreSubtitles);

    if (hlsInstance) {
      hlsInstance.on(Hls.Events.LEVEL_SWITCHED, handleQualityChange);
      hlsInstance.on(Hls.Events.AUDIO_TRACK_SWITCHED, handleAudioChange);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, restoreSubtitles);
    }

    return () => {
      video.removeEventListener('loadedmetadata', restoreSubtitles);
      video.removeEventListener('canplay', restoreSubtitles);
      video.removeEventListener('loadeddata', restoreSubtitles);
      video.removeEventListener('play', restoreSubtitles);
      if (hlsInstance) {
        hlsInstance.off(Hls.Events.LEVEL_SWITCHED, handleQualityChange);
        hlsInstance.off(Hls.Events.AUDIO_TRACK_SWITCHED, handleAudioChange);
        hlsInstance.off(Hls.Events.MANIFEST_PARSED, restoreSubtitles);
      }
    };
  }, [hlsInstance]);



  // Add effect to handle HLS events
  useEffect(() => {
    if (!hlsInstance) return;

    const handleHlsEvent = (event: string, data: any) => {
      if (event === Hls.Events.LEVEL_SWITCHED || 
          event === Hls.Events.AUDIO_TRACK_SWITCHED ||
          event === Hls.Events.MANIFEST_PARSED) {
        // Refresh subtitle manager
        if (subtitleManagerRef.current) {
          subtitleManagerRef.current.refresh();
        }
      }
    };

    hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (event, data) => handleHlsEvent(Hls.Events.LEVEL_SWITCHED, data));
    hlsInstance.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => handleHlsEvent(Hls.Events.AUDIO_TRACK_SWITCHED, data));
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => handleHlsEvent(Hls.Events.MANIFEST_PARSED, data));

    return () => {
      hlsInstance.off(Hls.Events.LEVEL_SWITCHED, handleHlsEvent);
      hlsInstance.off(Hls.Events.AUDIO_TRACK_SWITCHED, handleHlsEvent);
      hlsInstance.off(Hls.Events.MANIFEST_PARSED, handleHlsEvent);
    };
  }, [hlsInstance]);

  // Update subtitle initialization effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitleUrls || Object.keys(subtitleUrls).length === 0) {
      return;
    }
    // Clean up previous subtitle manager
    if (subtitleManagerRef.current) {
      subtitleManagerRef.current.destroy();
      subtitleManagerRef.current = null;
    }
    // Initialize subtitle manager
    subtitleManagerRef.current = new SubtitleManager(video);
    subtitleManagerRef.current.initialize(subtitleUrls, () => {
      const tracks = subtitleManagerRef.current!.getAvailableTracks();
      setSubtitleTracks(tracks);
      if (tracks.length > 0) {
        const defaultTrack = tracks.find(track => track.language === 'en') || tracks[0];
        setCurrentSubtitleTrack(defaultTrack.id);
        subtitleManagerRef.current!.setTrack(defaultTrack.id);
      } else {
        setCurrentSubtitleTrack('off');
      }
    });
    // Add track change listener
    const handleTrackChange = () => {
      const textTracks = Array.from(video.textTracks);
      const showingTrack = textTracks.find(track => track.mode === 'showing');
      if (showingTrack) {
        setCurrentSubtitleTrack(showingTrack.language);
      } else {
        setCurrentSubtitleTrack('off');
      }
    };
    video.addEventListener('texttrackchange', handleTrackChange);
    return () => {
      video.removeEventListener('texttrackchange', handleTrackChange);
      if (subtitleManagerRef.current) {
        subtitleManagerRef.current.destroy();
        subtitleManagerRef.current = null;
      }
    };
  }, [subtitleUrls, currentQuality, currentAudioTrack]);

  // Add cleanup for watch history
  useEffect(() => {
    return () => {
      if (watchHistoryDebounceRef.current) {
        clearTimeout(watchHistoryDebounceRef.current);
      }
      // Save final position when component unmounts
      if (currentProfile?.id && contentId && videoRef.current) {
        const currentTime = videoRef.current.currentTime;
        const completed = currentTime >= videoRef.current.duration * 0.9;
        updateWatchHistory(completed ? 0 : currentTime, completed);
      }
    };
  }, [currentProfile?.id, contentId, episodeId, updateWatchHistory]);

  // Add click outside handler
  const handleClickOutside = useCallback((event: MouseEvent) => {
    // Check if click is outside of menus
    const target = event.target as HTMLElement;
    const isOutsideQualityMenu = !target.closest('.quality-menu');
    const isOutsideAudioMenu = !target.closest('.audio-menu');
    const isOutsideSubtitleMenu = !target.closest('.subtitle-menu');
    const isOutsideSubtitleSettings = !target.closest('.subtitle-settings');

    // Close menus if clicked outside
    if (isOutsideQualityMenu) setShowQualityMenu(false);
    if (isOutsideAudioMenu) setShowAudioMenu(false);
    if (isOutsideSubtitleMenu) setShowSubtitleMenu(false);
    if (isOutsideSubtitleSettings) setShowSubtitleSettings(false);
  }, []);

  // Add click outside effect
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  // Add HLS event handlers for better seeking
  useEffect(() => {
    if (!hlsInstance) return;

    // Only set buffering on actual seeking events
    const handleHlsSeeking = () => {
      if (videoRef.current && videoRef.current.readyState < 2) {
        setIsBuffering(true);
      } else {
        setIsBuffering(false);
      }
    };

    const handleHlsSeeked = () => {
      setIsBuffering(false);
    };

    // Remove BUFFER_APPENDING and BUFFER_APPENDED handlers
    hlsInstance.on(Hls.Events.LEVEL_LOADING, handleHlsSeeking);
    hlsInstance.on(Hls.Events.LEVEL_LOADED, handleHlsSeeked);

    return () => {
      hlsInstance.off(Hls.Events.LEVEL_LOADING, handleHlsSeeking);
      hlsInstance.off(Hls.Events.LEVEL_LOADED, handleHlsSeeked);
    };
  }, [hlsInstance]);

  // Add volume touch handlers with proper types
  const handleVolumeTouchStart = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const slider = e.currentTarget;
    const rect = slider.getBoundingClientRect();
    const percent = (touch.clientX - rect.left) / rect.width;
    const newVolume = Math.max(0, Math.min(1, percent));
    handleVolumeChange(newVolume * 100);
  }, []);

  const handleVolumeTouchMove = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const slider = e.currentTarget;
    const rect = slider.getBoundingClientRect();
    const percent = (touch.clientX - rect.left) / rect.width;
    const newVolume = Math.max(0, Math.min(1, percent));
    handleVolumeChange(newVolume * 100);
  }, []);

  // Debounced buffering spinner logic
  const bufferingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showBufferingSpinner, setShowBufferingSpinner] = useState(false);

  // Debounce spinner display: only show if buffering lasts > 300ms
  useEffect(() => {
    if (isBuffering) {
      if (!bufferingTimeoutRef.current) {
        bufferingTimeoutRef.current = setTimeout(() => {
          setShowBufferingSpinner(true);
        }, 300);
      }
    } else {
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
      setShowBufferingSpinner(false);
    }
    return () => {
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
    };
  }, [isBuffering]);

  // Add state for buffered ranges
  const [bufferedRanges, setBufferedRanges] = useState<{start: number, end: number}[]>([]);

  // Update buffered ranges on timeupdate and progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const updateBuffered = () => {
      const ranges: {start: number, end: number}[] = [];
      for (let i = 0; i < video.buffered.length; i++) {
        ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
      }
      setBufferedRanges(ranges);
    };
    video.addEventListener('progress', updateBuffered);
    video.addEventListener('timeupdate', updateBuffered);
    video.addEventListener('loadedmetadata', updateBuffered);
    return () => {
      video.removeEventListener('progress', updateBuffered);
      video.removeEventListener('timeupdate', updateBuffered);
      video.removeEventListener('loadedmetadata', updateBuffered);
    };
  }, []);

  // Show a notice when starting at lowest quality for faster start
  const [showLowQualityNotice, setShowLowQualityNotice] = useState(false);
  useEffect(() => {
    if (
      hlsInstance &&
      hlsInstance.currentLevel === 0 &&
      currentQuality === "-1"
    ) {
      setShowLowQualityNotice(true);
      const timeout = setTimeout(() => setShowLowQualityNotice(false), 5000);
      return () => clearTimeout(timeout);
    } else {
      setShowLowQualityNotice(false);
    }
  }, [hlsInstance && hlsInstance.currentLevel, currentQuality]);

  // Dynamically increase buffer after playback starts for smoother experience
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsInstance) return;

    const handleFirstPlay = () => {
      if (hlsInstance.config.maxBufferLength < 30) {
        hlsInstance.config.maxBufferLength = 30;
        hlsInstance.config.maxMaxBufferLength = 60;
      }
      video.removeEventListener('playing', handleFirstPlay);
    };

    video.addEventListener('playing', handleFirstPlay);
    return () => {
      video.removeEventListener('playing', handleFirstPlay);
    };
  }, [hlsInstance]);

  // Add a ref to track if the user is interacting with progress bar or volume slider
  const isTouchingInteractiveControl = useRef(false);

  // Update touch handlers for progress bar
  const handleProgressTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    isTouchingInteractiveControl.current = true;
    setShowControls(true);
    setShowTitleOverlay(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (typeof handleTouchStart === 'function') handleTouchStart(e);
  }, [handleTouchStart]);

  const handleProgressTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    isTouchingInteractiveControl.current = false;
    if (typeof handleTouchEnd === 'function') handleTouchEnd(e);
    // Start hide timer after interaction ends
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isMouseOverControls.current && isPlaying && !isTouchingInteractiveControl.current) {
          setShowControls(false);
          setShowTitleOverlay(false);
        }
      }, 2500);
    }
  }, [handleTouchEnd, isPlaying]);

  // Update touch handlers for volume slider
  const handleVolumeTouchStartWrapper = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    isTouchingInteractiveControl.current = true;
    setShowControls(true);
    setShowTitleOverlay(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (typeof handleVolumeTouchStart === 'function') handleVolumeTouchStart(e);
  }, [handleVolumeTouchStart]);

  const handleVolumeTouchEndWrapper = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    isTouchingInteractiveControl.current = false;
    // Start hide timer after interaction ends
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isMouseOverControls.current && isPlaying && !isTouchingInteractiveControl.current) {
          setShowControls(false);
          setShowTitleOverlay(false);
        }
      }, 2500);
    }
  }, [isPlaying]);

  // Update menu icon click handlers to toggle menus and close others
  const handleSubtitleMenuToggle = () => {
    setShowSubtitleMenu((prev) => {
      if (!prev) {
        setShowQualityMenu(false);
        setShowAudioMenu(false);
      }
      return !prev;
    });
  };
  const handleQualityMenuToggle = () => {
    setShowQualityMenu((prev) => {
      if (!prev) {
        setShowSubtitleMenu(false);
        setShowAudioMenu(false);
      }
      return !prev;
    });
  };
  const handleAudioMenuToggle = () => {
    setShowAudioMenu((prev) => {
      if (!prev) {
        setShowSubtitleMenu(false);
        setShowQualityMenu(false);
      }
      return !prev;
    });
  };

  // Add refs for menu icons and menus
  const subtitleIconRef = useRef<HTMLButtonElement>(null);
  const qualityIconRef = useRef<HTMLButtonElement>(null);
  const audioIconRef = useRef<HTMLButtonElement>(null);
  const subtitleMenuRef = useRef<HTMLDivElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const audioMenuRef = useRef<HTMLDivElement>(null);

  // Robust menu close logic
  useEffect(() => {
    if (!(showSubtitleMenu || showQualityMenu || showAudioMenu)) return;
    function handleDocumentClick(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      // If any menu is open, check if click is outside all menus and icons
      if (
        (showSubtitleMenu &&
          !subtitleMenuRef.current?.contains(target) &&
          !subtitleIconRef.current?.contains(target)) ||
        (showQualityMenu &&
          !qualityMenuRef.current?.contains(target) &&
          !qualityIconRef.current?.contains(target)) ||
        (showAudioMenu &&
          !audioMenuRef.current?.contains(target) &&
          !audioIconRef.current?.contains(target))
      ) {
        setShowSubtitleMenu(false);
        setShowQualityMenu(false);
        setShowAudioMenu(false);
      }
    }
    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('touchstart', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
    };
  }, [showSubtitleMenu, showQualityMenu, showAudioMenu]);

  // Aspect ratio state and logic
  const aspectRatios = [
    { label: 'Default', value: 'default' },
    { label: '16:9', value: '16-9' },
    { label: '4:3', value: '4-3' },
    { label: 'Fill', value: 'fill' },
    { label: 'Contain', value: 'contain' },
    { label: 'Cover', value: 'cover' },
  ];
  const [aspectRatioIdx, setAspectRatioIdx] = useState(4); // 4 = 'contain' in the array
 
  // Compute video style based on aspect ratio
  let videoStyle = {};
  if (aspectRatios[aspectRatioIdx].value === '16-9') {
    videoStyle = { aspectRatio: '16/9', width: '100%', height: 'auto', objectFit: 'contain' };
  } else if (aspectRatios[aspectRatioIdx].value === '4-3') {
    videoStyle = { aspectRatio: '4/3', width: '100%', height: 'auto', objectFit: 'contain' };
  } else if (aspectRatios[aspectRatioIdx].value === 'fill') {
    videoStyle = { width: '100%', height: '100%', objectFit: 'fill' };
  } else if (aspectRatios[aspectRatioIdx].value === 'contain') {
    videoStyle = { width: '100%', height: '100%', objectFit: 'contain' };
  } else if (aspectRatios[aspectRatioIdx].value === 'cover') {
    videoStyle = { width: '100%', height: '100%', objectFit: 'cover' };
  } // else default: no override

  // Add state to track cast availability
  const [isCastAvailable, setIsCastAvailable] = useState(false);

  // Check for cast support on mount
  useEffect(() => {
    function checkCast() {
      if ((window as any).chrome && (window as any).chrome.cast && (window as any).cast) {
        setIsCastAvailable(true);
      } else {
        setIsCastAvailable(false);
      }
    }
    // Try to check immediately and after a short delay (for async SDK load)
    checkCast();
    const timeout = setTimeout(checkCast, 2000);
    return () => clearTimeout(timeout);
  }, []);

  // Add after isCastAvailable state and useEffect for checking cast support
  useEffect(() => {
    // Initialize Cast context when SDK is available
    if ((window as any).cast && (window as any).cast.framework) {
      (window as any).cast.framework.CastContext.getInstance().setOptions({
        receiverApplicationId: (window as any).chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: (window as any).chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      });
    }
  }, [isCastAvailable]);

  // Helper to load media into Cast session
  const loadCastMedia = useCallback(() => {
    if (!(window as any).cast || !(window as any).chrome) return;
    const castSession = (window as any).cast.framework.CastContext.getInstance().getCurrentSession();
    if (castSession && masterUrl) {
      const mediaInfo = new (window as any).chrome.cast.media.MediaInfo(masterUrl, 'application/x-mpegurl');
      mediaInfo.metadata = new (window as any).chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title;
      // Optionally add more metadata (e.g., poster image)
      const request = new (window as any).chrome.cast.media.LoadRequest(mediaInfo);
      castSession.loadMedia(request).then(
        () => {},
        (error: any) => { console.error('Cast load error', error); }
      );
    }
  }, [masterUrl, title]);

  // Listen for Cast session start and load media
  useEffect(() => {
    if (!(window as any).cast || !(window as any).chrome) return;
    const context = (window as any).cast.framework.CastContext.getInstance();
    const listener = (event: any) => {
      if (event.sessionState === 'SESSION_STARTED' || event.sessionState === 'SESSION_RESUMED') {
        loadCastMedia();
      }
    };
    context.addEventListener((window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED, listener);
    return () => {
      context.removeEventListener((window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED, listener);
    };
  }, [loadCastMedia]);

  // Update Cast button handler
  const handleCastClick = () => {
    if ((window as any).chrome && (window as any).chrome.cast && (window as any).cast) {
      (window as any).cast.framework.CastContext.getInstance().requestSession();
      // The session event listener will load the media
    } else {
      alert("Casting is not available on this device/browser.");
    }
  };

  // Manifest preloading logic
  // Preload manifest in background when component mounts (before play)
  const manifestPreloadCache = new Map<string, string>();
  useEffect(() => {
    if (!masterUrl) return;
    if (manifestPreloadCache.has(masterUrl)) return;
    fetch(masterUrl, { method: 'GET', cache: 'reload' })
      .then(res => res.text())
      .then(text => {
        manifestPreloadCache.set(masterUrl, text);
      })
      .catch(() => {});
  }, [masterUrl]);

  // --- Persist and restore audio track across episode switches ---
  // Store last selected audio track in a ref
  const lastAudioTrackRef = useRef<string | null>(null);

  // When audio track changes, update the ref
  useEffect(() => {
    if (currentAudioTrack) {
      lastAudioTrackRef.current = currentAudioTrack;
    }
  }, [currentAudioTrack]);

  // On audio tracks change, restore last selected audio track if available
  useEffect(() => {
    if (!hlsInstance || !audioTracks.length) return;
    if (lastAudioTrackRef.current) {
      const found = audioTracks.find(t => t.id === lastAudioTrackRef.current);
      if (found) {
        try {
          hlsInstance.audioTrack = parseInt(found.id);
          setCurrentAudioTrack(found.id);
        } catch {}
      }
    }
  }, [hlsInstance, audioTracks]);

  // --- Resume overlay state ---
  const [showResumeOverlay, setShowResumeOverlay] = useState(false);
  const [resumeTime, setResumeTime] = useState<number | null>(null);

  // Show resume overlay if lastWatchedTime is valid and not near the end
  useEffect(() => {
    if (
      typeof lastWatchedTime === 'number' &&
      lastWatchedTime > 0 &&
      duration > 0 &&
      lastWatchedTime < duration * 0.9
    ) {
      setResumeTime(lastWatchedTime);
      setShowResumeOverlay(true);
    } else {
      setShowResumeOverlay(false);
    }
  }, [lastWatchedTime, duration]);

  // Prevent autoplay until resume overlay is handled
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  useEffect(() => {
    if (showResumeOverlay) {
      setAutoplayBlocked(true);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      setAutoplayBlocked(false);
    }
  }, [showResumeOverlay]);

  // Handler for resume/start over
  const handleResumeChoice = (resume: boolean) => {
    if (!videoRef.current) return;
    if (resume && typeof resumeTime === 'number') {
      videoRef.current.currentTime = resumeTime;
    } else {
      videoRef.current.currentTime = 0;
    }
    setShowResumeOverlay(false);
    setTimeout(() => {
      videoRef.current?.play().catch(() => {});
    }, 100);
  };

  // --- Toast notices for quality and aspect ratio changes ---
  const [showQualityToast, setShowQualityToast] = useState<string | null>(null);
  const [showAspectToast, setShowAspectToast] = useState(false);
  const [aspectToastMsg, setAspectToastMsg] = useState<string | null>(null);

  // Show toast when quality changes
  const handleQualityChangeWithToast = (quality: string) => {
    if (!hlsInstance || isQualityChanging) return;
    let label = '';
    const hls = hlsInstance;
    let activeLevel = hls.autoLevelEnabled ? hls.levels[hls.nextAutoLevel] : hls.levels[hls.currentLevel];
    if (quality === '-1') {
      label = `Auto${activeLevel ? ` (${activeLevel.height ? activeLevel.height + 'P' : Math.round(activeLevel.bitrate/1000) + 'kbps'})` : ''}`;
    } else {
      const q = availableQualities.find(q => q.value === quality);
      label = q ? q.label : quality;
    }
    setShowQualityToast(`Quality set to ${label}`);
    setTimeout(() => setShowQualityToast(null), 2000);
    handleQualityChange(quality);
  };

  // Show toast when aspect ratio changes
  const handleAspectRatioToggleWithToast = () => {
    setAspectRatioIdx((prev) => {
      const next = (prev + 1) % aspectRatios.length;
      setAspectToastMsg(`Aspect Ratio: ${aspectRatios[next].label}`);
      setShowAspectToast(true);
      setTimeout(() => setShowAspectToast(false), 2000);
      return next;
    });
  };

  // --- Buffering/Initial Spinner State ---
  const [showInitialSpinner, setShowInitialSpinner] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleCanPlay = () => setShowInitialSpinner(false);
    const handleLoadStart = () => setShowInitialSpinner(true);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadstart', handleLoadStart);
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, []);

  // --- Fatal error state for retry overlay ---
  const [fatalError, setFatalError] = useState<string | null>(null);

  // Retry logic
  const handleRetry = () => {
    setFatalError(null);
    setPlayerError(null);
    setCurrentQuality('-1');
    setCurrentAudioTrack('default');
    setIsQualityChanging(false);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      }
    }, 100);
  };

  // Overlay keyboard handler
  const handleErrorOverlayKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') setFatalError(null);
    if (e.key === 'Enter' || e.key === ' ') handleRetry();
  };

  // Add a helper to detect mobile
  const isMobileDevice = () => /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);

  // Add a ref for mobile auto-hide timer
  const mobileAutoHideTimer = useRef<NodeJS.Timeout | null>(null);

  // --- Tap to Toggle Controls (Netflix-Style, Mobile Only) ---
  const handlePlayerTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobileDevice()) return;
    const target = e.target as HTMLElement;
    // Ignore taps on interactive UI
    if (
      target.closest('.controls, .progress-bar, button, input, select, textarea') ||
      target.getAttribute('role') === 'slider' // for progress bar
    ) {
      return;
    }
    setShowControls(prev => {
      const next = !prev;
      // If showing controls, start auto-hide timer
      if (next) {
        if (mobileAutoHideTimer.current) clearTimeout(mobileAutoHideTimer.current);
        mobileAutoHideTimer.current = setTimeout(() => setShowControls(false), 5000);
      } else {
        if (mobileAutoHideTimer.current) clearTimeout(mobileAutoHideTimer.current);
      }
      return next;
    });
    e.stopPropagation();
    e.preventDefault();
  }, []);

  // Auto-hide controls after 5s of inactivity (mobile only)
  useEffect(() => {
    if (!isMobileDevice()) return;
    if (showControls) {
      if (mobileAutoHideTimer.current) clearTimeout(mobileAutoHideTimer.current);
      mobileAutoHideTimer.current = setTimeout(() => setShowControls(false), 5000);
    } else {
      if (mobileAutoHideTimer.current) clearTimeout(mobileAutoHideTimer.current);
    }
    return () => {
      if (mobileAutoHideTimer.current) clearTimeout(mobileAutoHideTimer.current);
    };
  }, [showControls]);

  // --- Block player interactions when controls are hidden (mobile only) ---
  function blockIfMobileAndControlsHidden<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      if (isMobileDevice() && !showControls) return;
      return fn(...args);
    }) as T;
  }

  // Wrap all player interaction handlers
  const mobileTogglePlay = blockIfMobileAndControlsHidden(togglePlay);
  const mobileSeek = blockIfMobileAndControlsHidden(seek);
  const mobileHandleVolumeChange = blockIfMobileAndControlsHidden(handleVolumeChange);
  const mobileHandleAspectRatioToggle = blockIfMobileAndControlsHidden(handleAspectRatioToggleWithToast);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={e => {
        handleTouchEnd(e);
        handlePlayerTouchEnd(e);
      }}
    >
      {/* Cast button at top right */}
      {isCastAvailable && (
        <button
          onClick={handleCastClick}
          className="absolute top-4 right-4 z-50 text-white hover:text-gray-300 transition-all duration-300 p-2 rounded-full hover:bg-white/10"
          aria-label="Cast to device"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          <CastIcon size={24} />
        </button>
      )}
      {/* Add back button */}
      <button
        onClick={handleBack}
        className={`absolute top-4 left-4 z-50 text-white hover:text-gray-300 transition-all duration-300 p-2 rounded-full hover:bg-white/10 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-label="Go back"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Netflix-style title overlay */}
      {showTitleOverlay && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-all duration-300 ease-in-out z-10">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-white text-2xl font-medium mb-1">
              {title}
              </h1>
            {episodeInfo && (
              <div className="text-gray-300 text-lg">
                Season {episodeInfo.season} • Episode {episodeInfo.episode}
                {episodeInfo.title && (
                  <span className="ml-2">• {episodeInfo.title}</span>
                )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto object-contain transition-all duration-500 z-0 ${
          isQualityChanging ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'
        }`}
        onPlay={() => {
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current && subtitleManagerRef.current) {
            const textTracks = Array.from(videoRef.current.textTracks);
            if (currentSubtitleTrack === 'off') {
              textTracks.forEach(track => track.mode = 'disabled');
            } else {
              textTracks.forEach(track => {
                track.mode = track.language === currentSubtitleTrack ? 'showing' : 'hidden';
              });
            }
          }
          // Prevent autoplay if resume overlay is showing
          if (autoplayBlocked && videoRef.current) {
            videoRef.current.pause();
          }
        }}
        playsInline
        muted={isMuted}
        tabIndex={0}
        preload="metadata"
        controls={false}
        crossOrigin="anonymous"
        style={videoStyle}
      >
        {masterUrl && (
          <source
            key={masterUrl}
            src={masterUrl}
            type="application/vnd.apple.mpegurl"
          />
        )}
        {Object.entries(subtitleUrls).map(([lang, url]) => (
          <track
            key={lang}
            kind="subtitles"
            src={url}
            srcLang={lang}
            label={lang === 'en' ? 'English' :
                   lang === 'es' ? 'Spanish' :
                   lang === 'fr' ? 'French' :
                   lang === 'de' ? 'German' :
                   lang === 'it' ? 'Italian' :
                   lang === 'pt' ? 'Portuguese' :
                   lang === 'ru' ? 'Russian' :
                   lang === 'ja' ? 'Japanese' :
                   lang === 'ko' ? 'Korean' :
                   lang === 'zh' ? 'Chinese' :
                   lang}
            default={lang === 'en'}
          />
        ))}
        Sorry, your browser does not support embedded videos.
      </video>

      {/* Loading indicator (initial load or buffering) */}
      {(showInitialSpinner || isBuffering) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <LoadingSpinner />
          </div>
        </div>
      )}

      {/* Netflix-style title overlay */}
      {showTitleOverlay && (
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex items-center space-x-8">
            <button
              onClick={() => seek(-10)}
              className="text-white hover:text-gray-300 transition-colors p-4 rounded-full hover:bg-white/10"
              aria-label="Rewind 10 seconds"
            >
              <RotateCcw size={32} />
            </button>
            
            <button
              onClick={mobileTogglePlay}
              className="text-white hover:text-gray-300 transition-colors p-4 rounded-full hover:bg-white/10"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={40} /> : <Play size={40} />}
            </button>
            
            <button
              onClick={() => seek(10)}
              className="text-white hover:text-gray-300 transition-colors p-4 rounded-full hover:bg-white/10"
              aria-label="Forward 10 seconds"
            >
              <RotateCw size={32} />
            </button>
          </div>
        </div>
      )}

      {/* Netflix-style skip intro button - commented out for future use
      {showSkipIntro && (
        <button
          className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-md transition-colors"
          onClick={() => seek(30)}
        >
          Skip Intro
        </button>
      )}
      */}



      {/* Center controls overlay */}
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ fontFamily: 'Inter, Arial, sans-serif', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
        <div className="flex items-center space-x-8 z-20">
            <button
            onClick={() => seek(-10)}
            className="text-white hover:text-red-500 transition-all duration-150 p-4 rounded-full bg-black/40 hover:bg-black/60 shadow-md hover:scale-110 focus:scale-110"
            aria-label="Rewind 10 seconds"
            >
            <RotateCcw size={32} />
            </button>
          
            <button
            onClick={mobileTogglePlay}
            className="text-white hover:text-red-500 transition-all duration-150 p-4 rounded-full bg-black/40 hover:bg-black/60 shadow-md hover:scale-110 focus:scale-110"
            aria-label={isPlaying ? "Pause" : "Play"}
            >
            {isPlaying ? <Pause size={40} /> : <Play size={40} />}
            </button>
          
            <button
              onClick={() => seek(10)}
            className="text-white hover:text-red-500 transition-all duration-150 p-4 rounded-full bg-black/40 hover:bg-black/60 shadow-md hover:scale-110 focus:scale-110"
            aria-label="Forward 10 seconds"
            >
            <RotateCw size={32} />
            </button>
            </div>
      </div>

      {/* Update the bottom controls layout */}
      {showControls && (
        <>
          {/* Progress bar with time */}
          <div className="absolute bottom-16 left-0 right-0 z-10">
            <div className="flex items-center space-x-2 px-4">
              <div className="flex-1 relative group">
                {/* Added padding container for better touch targets */}
                <div className="py-3 -my-3 px-4 -mx-4" style={{ margin: '0 -1rem', padding: '0.75rem 1rem' }}>
                  <div
                    ref={progressRef}
                    className="relative w-full h-4 cursor-pointer group transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                    onMouseDown={handleProgressMouseDown}
                    onMouseMove={handleProgressHover}
                    onMouseLeave={handleProgressLeave}
                    onTouchStart={handleProgressTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleProgressTouchEnd}
                    onTouchCancel={handleProgressTouchEnd}
                    style={{ touchAction: 'pan-x', minHeight: '1rem' }}
                    tabIndex={0}
                    aria-label="Seek bar"
                    role="slider"
                    aria-valuenow={Math.round((dragProgress ?? currentTime))}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    onKeyDown={e => {
                      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') seek(-5);
                      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') seek(5);
                    }}
                  >
                    {/* Background bar */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800 rounded-full -translate-y-1/2" />
                    {/* Buffered bar */}
                    {bufferedRanges.map((range, idx) => (
                      <div
                        key={idx}
                        className="absolute top-1/2 h-1 bg-[#e0e0e0]/90 rounded-full -translate-y-1/2"
                        style={{
                          left: `${(range.start / duration) * 100}%`,
                          width: `${((range.end - range.start) / duration) * 100}%`,
                          zIndex: 1,
                        }}
                      />
                    ))}
                    {/* Progress bar */}
                    <div
                      className="absolute top-1/2 left-0 h-2 bg-red-600 rounded-full shadow-md -translate-y-1/2"
                      style={{
                        width: `${((dragProgress ?? currentTime) / duration) * 100}%`,
                        zIndex: 2,
                      }}
                    />
                    {/* Handle */}
                    <div
                      className="absolute top-1/2"
                      style={{
                        left: `calc(${((dragProgress ?? currentTime) / duration) * 100}% - 0.5rem)`,
                        zIndex: 3,
                      }}
                    >
                      <div
                        className="w-4 h-4 bg-white border-2 border-red-600 rounded-full shadow-lg transition-transform duration-150 transform -translate-y-1/2 scale-90 group-hover:scale-125 group-focus:scale-125 focus:outline-none"
                        tabIndex={0}
                        aria-label="Seek handle"
                      />
                    </div>
                    {/* Tooltip above handle */}
                    {hoverPosition && (
                      <div
                        className="absolute -top-8 left-0 px-2 py-1 bg-black/80 text-white text-xs rounded shadow pointer-events-none transition-opacity duration-150 font-sans"
                        style={{ left: `${hoverPosition.x}px`, transform: 'translateX(-50%)', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
                      >
                        {formatTime(hoverPosition.time)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-white text-sm min-w-[100px]">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div 
            ref={controlsAreaRef}
            className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/60 to-transparent transition-all duration-300 ease-in-out z-10"
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{ fontFamily: 'Inter, Arial, sans-serif', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between">
              {/* Volume controls */}
              <div className="flex items-center space-x-2" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  tabIndex={0}
                >
                  {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
                <div className="relative group" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={volume * 100}
                    onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                    onTouchStart={handleVolumeTouchStartWrapper}
                    onTouchMove={handleVolumeTouchMove}
                    className="w-20 accent-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Volume"
                    role="slider"
                    aria-valuenow={Math.round(volume * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') handleVolumeChange(Math.max(0, Math.round(volume * 100) - 5));
                      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') handleVolumeChange(Math.min(100, Math.round(volume * 100) + 5));
                    }}
                  />
                </div>
              </div>

              {/* Other controls */}
              <div className="flex items-center space-x-2">
            <button
              ref={subtitleIconRef}
              onClick={e => { e.stopPropagation(); handleSubtitleMenuToggle(); }}
              className={`text-white transition-colors p-2 rounded-full hover:bg-white/10 ${currentSubtitleTrack !== 'off' ? 'text-red-500' : ''}`}
              aria-label="Subtitle settings"
            >
              <Subtitles size={24} />
            </button>

            <button
              ref={audioIconRef}
              onClick={e => { e.stopPropagation(); handleAudioMenuToggle(); }}
              className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
              aria-label="Audio settings"
            >
              <Headphones size={24} />
            </button>

            <button
              ref={qualityIconRef}
              onClick={e => { e.stopPropagation(); handleQualityMenuToggle(); }}
              className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
              aria-label="Quality settings"
            >
              <Settings size={24} />
            </button>

            <button
              onClick={mobileHandleAspectRatioToggle}
              className="text-white hover:text-red-500 transition-all duration-150 p-2 rounded-full bg-black/40 hover:bg-black/60 shadow-md hover:scale-110 focus:scale-110"
              aria-label="Change aspect ratio"
              title="Change aspect ratio"
              tabIndex={0}
            >
              <Monitor size={24} />
            </button>

            <button
              onClick={toggleFullscreen}
                  className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>
          </div>
        </>
      )}

      {/* Netflix-style menus */}
      {showQualityMenu && (
        <div
          ref={qualityMenuRef}
          className={`absolute bottom-16 right-4 bg-black/90 p-4 rounded-md shadow-lg transform transition-all duration-200 ease-in-out min-w-[200px] quality-menu z-20 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <h3 className="text-white text-lg font-medium mb-2">Quality</h3>
          {availableQualities.map((quality) => (
            <button
              key={quality.value}
              onClick={() => handleQualityChangeWithToast(quality.value)}
              className={`block w-full text-left px-4 py-2 rounded-md transition-colors duration-200 ${
                (isAutoQuality && quality.value === '-1') || (!isAutoQuality && currentQuality === quality.value)
                  ? "bg-white text-black"
                  : "text-white hover:bg-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>
                  {quality.label === "AUTO" 
                    ? `Auto${isAutoQuality && currentAutoQuality ? ` (${currentAutoQuality})` : ''}`
                    : quality.label}
                </span>
                {(isAutoQuality && quality.value === '-1') || (!isAutoQuality && currentQuality === quality.value) ? (
                  <span className="text-black">✓</span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {showSubtitleMenu && (
        <div
          ref={subtitleMenuRef}
          className={`absolute bottom-16 right-4 bg-black/90 p-4 rounded-md min-w-[200px] shadow-lg transform transition-all duration-200 ease-in-out subtitle-menu z-20 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <h3 className="text-white text-lg font-medium mb-2">Subtitles</h3>
          <button
            onClick={() => handleSubtitleTrackChange("off")}
            className={`block w-full text-left px-4 py-2 rounded-md transition-colors duration-200 ${
              currentSubtitleTrack === "off"
                ? "bg-white text-black"
                : "text-white hover:bg-white/20"
            }`}
          >
            Off
          </button>
          {subtitleTracks && subtitleTracks.length > 0 ? (
            subtitleTracks.map((track) => (
            <button
              key={track.id}
              onClick={() => handleSubtitleTrackChange(track.id)}
                className={`block w-full text-left px-4 py-2 rounded-md transition-colors duration-200 ${
                currentSubtitleTrack === track.id
                  ? "bg-white text-black"
                  : "text-white hover:bg-white/20"
              }`}
            >
              {track.label}
            </button>
            ))
          ) : (
            <div className="text-white px-4 py-2">No subtitles available</div>
          )}
        </div>
      )}

      {showAudioMenu && (
        <div
          ref={audioMenuRef}
          className={`absolute bottom-16 right-4 bg-black/90 p-4 rounded-md shadow-lg transform transition-all duration-200 ease-in-out audio-menu z-20 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <h3 className="text-white text-lg font-medium mb-2">Audio</h3>
          {audioTracks.map((track) => (
            <button
              key={track.id}
              onClick={() => handleAudioTrackChange(track.id)}
              className={`block w-full text-left px-4 py-2 rounded-md transition-colors duration-200 ${
                currentAudioTrack === track.id
                  ? "bg-white text-black font-medium"
                  : "text-white hover:bg-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{track.label}</span>
                {currentAudioTrack === track.id && (
                  <span className="text-black">✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showSubtitleSettings && (
        <div className={`absolute bottom-16 right-4 bg-black/90 p-4 rounded-md shadow-lg transform transition-all duration-200 ease-in-out subtitle-settings z-20 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}>
          <h3 className="text-white text-lg font-medium mb-2">Subtitle Settings</h3>
          {/* Subtitle settings content */}
        </div>
      )}

      {/* Loading indicator */}
      {showBufferingSpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <LoadingSpinner />
          </div>
        </div>
      )}

      {/* Add touch indicator */}
      {showTouchIndicator && (
        <div 
          className="fixed z-50 bg-black/80 text-white px-4 py-2 rounded-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ 
            left: touchIndicatorPosition.x,
            top: touchIndicatorPosition.y
          }}
        >
          {touchIndicatorType === 'seek' ? (
            <div className="flex flex-col items-center">
              <span className="text-lg font-medium">
                {formatTime(touchIndicatorValue || 0)}
              </span>
              <span className="text-sm text-gray-300">
                {touchProgress && videoRef.current ? 
                  `${Math.round((touchProgress / videoRef.current.duration) * 100)}%` : 
                  '0%'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-lg font-medium">
                {Math.round(touchIndicatorValue || 0)}%
              </span>
              <span className="text-sm text-gray-300">
                Volume
              </span>
            </div>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {showBufferingSpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <LoadingSpinner />
          </div>
        </div>
      )}

      {/* Low quality notice */}
      {showLowQualityNotice && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded shadow z-30 text-sm animate-fade-in">
          Playing in low quality for faster start
        </div>
      )}

      

      {/* Resume overlay (Netflix-style) */}
      {showResumeOverlay && resumeTime !== null && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onKeyDown={e => {
            if (e.key === 'Escape') setShowResumeOverlay(false);
            if (e.key === 'Enter' || e.key === ' ') handleResumeChoice(true);
          }}
        >
          <div className="bg-black/90 rounded-lg p-8 shadow-xl flex flex-col items-center">
            <div className="text-white text-xl font-semibold mb-4">
              Resume from {formatTime(resumeTime)}?
            </div>
            <div className="flex space-x-4">
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-bold text-lg shadow"
                onClick={() => handleResumeChoice(true)}
                aria-label="Resume playback"
              >
                Resume
              </button>
              <button
                className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded font-bold text-lg shadow"
                onClick={() => handleResumeChoice(false)}
                aria-label="Start from beginning"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast for quality change */}
      {showQualityToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded shadow z-30 text-sm animate-fade-in">
          {showQualityToast}
        </div>
      )}
      {/* Toast for aspect ratio change */}
      {showAspectToast && aspectToastMsg && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded shadow z-30 text-sm animate-fade-in">
          {aspectToastMsg}
        </div>
      )}
      {fatalError && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
          tabIndex={-1}
          aria-modal="true"
          role="dialog"
          onKeyDown={handleErrorOverlayKey}
        >
          <div className="bg-black/95 rounded-lg p-8 shadow-xl flex flex-col items-center max-w-md">
            <div className="text-red-500 text-xl font-semibold mb-4">Playback Error</div>
            <div className="text-white text-base mb-6 text-center">{fatalError}</div>
            <div className="flex space-x-4">
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-bold text-lg shadow focus:outline-none focus:ring-2 focus:ring-red-500"
                onClick={handleRetry}
                aria-label="Retry playback"
                tabIndex={0}
              >
                Retry
              </button>
              <button
                className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded font-bold text-lg shadow focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={handleBack}
                aria-label="Go back"
                tabIndex={0}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;

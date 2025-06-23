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
  SkipForward,
  SkipBack,
} from "lucide-react";
import { useWatchHistoryStore } from "../../stores/watchHistoryStore";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import Hls from "hls.js";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "videojs-hls-quality-selector";

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
  episodes?: any[];
  currentEpisodeIndex?: number;
  onChangeEpisode?: (newIndex: number) => void;
  startTime?: number;
  subtitleUrls?: { [key: string]: string };  // Add subtitle URLs prop
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

  initialize(subtitleUrls: { [key: string]: string }) {
    if (this.isInitialized) return;
    
    this.subtitleUrls = subtitleUrls;
    
    // Clear existing tracks
    this.clearTracks();
    
    // Add new tracks
    Object.entries(subtitleUrls).forEach(([lang, url]) => {
      console.log(`Adding subtitle track: ${lang} - ${url}`);
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = url;
      track.srclang = lang;
      track.label = this.getLanguageLabel(lang);
      track.default = lang === 'en';
      this.video.appendChild(track);
    });

    // Store track references
    const textTracks = Array.from(this.video.textTracks);
    console.log('Text tracks after adding:', textTracks);
    
    textTracks.forEach(track => {
      this.tracks.set(track.language, track);
    });

    this.isInitialized = true;
  }

  private clearTracks() {
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
    console.log('Setting track to:', trackId);
    this.currentTrack = trackId;
    this.tracks.forEach((track, lang) => {
      track.mode = lang === trackId ? 'showing' : 'hidden';
    });
  }

  getCurrentTrack(): string {
    return this.currentTrack;
  }

  getAvailableTracks(): SubtitleTrack[] {
    const tracks = Array.from(this.tracks.entries()).map(([lang, track]) => ({
      id: lang,
      label: track.label,
      language: lang,
      url: this.subtitleUrls[lang] || ''
    }));
    console.log('Getting available tracks:', tracks);
    return tracks;
  }

  refresh() {
    if (!this.isInitialized) return;
    
    const currentTrack = this.currentTrack;
    this.isInitialized = false;
    this.initialize(this.subtitleUrls);
    
    if (currentTrack !== 'off') {
      this.setTrack(currentTrack);
    }
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
  episodes,
  currentEpisodeIndex,
  onChangeEpisode,
  startTime,
  subtitleUrls = {},  // Default to empty object
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
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTapPosition, setLastTapPosition] = useState<{ x: number; y: number } | null>(null);
  const [seekAmount, setSeekAmount] = useState<number | null>(null);
  const [showSeekIndicator, setShowSeekIndicator] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<string>('default');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  // Debounce spinner visibility
  useEffect(() => {
    let spinnerTimeout: NodeJS.Timeout;
    if (isBuffering || isLoading) {
      spinnerTimeout = setTimeout(() => setShowSpinner(true), 100); // Show spinner after 100ms delay
    } else {
      clearTimeout(spinnerTimeout);
      setShowSpinner(false);
    }
    return () => clearTimeout(spinnerTimeout);
  }, [isBuffering, isLoading]);
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
  const [buffered, setBuffered] = useState<TimeRanges | null>(null);

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
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
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
    const initializeHls = async () => {
      const video = videoRef.current;
      if (!video) {
        console.error("Video element not found");
        return;
      }

      // Clean up previous HLS instance if it exists
      if (hlsInstance) {
        hlsInstance.destroy();
        setHlsInstance(null);
      }

      // Set initial loading state
      setIsLoading(true);
      setIsBuffering(true);

      // Initialize HLS if the browser supports it
      if (masterUrl && typeof Hls !== "undefined" && Hls.isSupported()) {
        try {
          const hls = new Hls({
            // Ultra-fast startup settings - minimal buffering
            maxBufferLength: 30, // Increased buffer for smoother playback
            maxMaxBufferLength: 60, // Increased max buffer
            maxBufferSize: 60 * 1000 * 1000, // 60MB buffer - allows more segments to download
            maxBufferHole: 0.5, // Increased tolerance for smoother playback
            lowLatencyMode: true, // Enable for faster startup
            backBufferLength: 10, // Minimal back buffer
            
            // Ultra-fast loading settings
            manifestLoadingTimeOut: 5000, // Very short timeout
            manifestLoadingMaxRetry: 1, // Single retry only
            manifestLoadingRetryDelay: 200, // Very fast retry
            levelLoadingTimeOut: 5000, // Very short timeout
            levelLoadingMaxRetry: 1, // Single retry only
            levelLoadingRetryDelay: 200, // Very fast retry
            fragLoadingTimeOut: 5000, // Very short timeout
            fragLoadingMaxRetry: 1, // Single retry only
            fragLoadingRetryDelay: 200, // Very fast retry
            
            // Instant playback settings
            startLevel: 0, // Always start with lowest quality
            abrEwmaDefaultEstimate: 1000000, // More realistic initial estimate for ABR
            testBandwidth: true, // Enable bandwidth testing for better ABR decisions
            progressive: true,
            enableWorker: true,
            startFragPrefetch: true,
            
            // Minimal buffering settings
            maxFragLookUpTolerance: 0.05, // Minimal tolerance
            maxStarvationDelay: 1, // Very short starvation delay
            maxLoadingDelay: 1, // Very short loading delay
            minAutoBitrate: 0,
            highBufferWatchdogPeriod: 2, // Less frequent checks to allow more buffering
            nudgeMaxRetry: 1, // Single retry
            nudgeOffset: 0.01, // Tiny offset
            
            // Instant startup specific settings
            liveSyncDurationCount: 1, // Minimal sync
            liveMaxLatencyDurationCount: 2, // Minimal latency
            maxLiveSyncPlaybackRate: 1.5, // Faster catchup
            
            // Aggressive network settings
            xhrSetup: function(xhr: XMLHttpRequest, url: string) {
              xhr.withCredentials = false;
              xhr.timeout = 3000; // Very short timeout
              // Disable caching for faster loading
              xhr.setRequestHeader('Cache-Control', 'no-cache');
              xhr.setRequestHeader('Pragma', 'no-cache');
            }
          });

          // Add error recovery
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error("Fatal HLS error:", data);
              
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log("Network error, trying to recover...");
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log("Media error, trying to recover...");
                  hls.recoverMediaError();
                  break;
                default:
                  console.log("Fatal error, destroying HLS instance");
                  hls.destroy();
                  setHlsInstance(null);
                  break;
              }
            }
          });

          // Ultra-fast buffering event handlers - minimal delays
          let bufferingTimeout: NodeJS.Timeout;
          let isInitialLoad = true;
          let hasStartedPlaying = false;
          
          const setBufferingInstant = (buffering: boolean, forceDelay: number = 0) => {

          video.addEventListener('progress', () => {
            setBuffered(video.buffered);
          });
            if (bufferingTimeout) clearTimeout(bufferingTimeout);
            
            // During initial load, minimize buffering indicators
            if (isInitialLoad && buffering && !forceDelay) {
              return; // Skip showing buffering during initial load
            }
            
            if (buffering && forceDelay > 0) {
              bufferingTimeout = setTimeout(() => setIsBuffering(true), forceDelay);
            } else {
              setIsBuffering(buffering);
            }
          };

          // HLS events for instant startup
          hls.on(Hls.Events.BUFFER_CREATED, () => {
            setBufferingInstant(false);
            setIsLoading(false);
          });

          hls.on(Hls.Events.BUFFER_APPENDED, () => {
            setBufferingInstant(false);
            setIsLoading(false);
          });

          hls.on(Hls.Events.BUFFER_FLUSHED, () => {
            // Only show buffering after initial playback has started
            if (hasStartedPlaying) {
              setBufferingInstant(true, 200); // Very short delay
            }
          });

          // Ultra-fast video event listeners
          video.addEventListener('loadstart', () => {
            setIsBuffering(true);
            setIsLoading(true);
          });

          video.addEventListener('loadedmetadata', () => {
            setBufferingInstant(false);
            setIsLoading(false);
          });

          video.addEventListener('loadeddata', () => {
            setBufferingInstant(false);
            setIsLoading(false);
          });

          video.addEventListener('canplay', () => {
            setBufferingInstant(false);
            setIsLoading(false);
            
            // Auto-play immediately when ready
            if (autoPlay && !hasStartedPlaying) {
              video.play().catch(console.error);
            }
          });

          video.addEventListener('canplaythrough', () => {
            setBufferingInstant(false);
            setIsLoading(false);
          });

          video.addEventListener('playing', () => {
            isInitialLoad = false;
            hasStartedPlaying = true;
            setBufferingInstant(false);
            setIsLoading(false);
          });

          video.addEventListener('waiting', () => {
            // Only show waiting after initial startup
            if (hasStartedPlaying) {
              setBufferingInstant(true, 100); // Very short delay
            }
          });

          video.addEventListener('stalled', () => {
            if (hasStartedPlaying) {
              setBufferingInstant(true, 200); // Short delay
            }
          });

          // Aggressive progress monitoring for instant startup
          video.addEventListener('progress', () => {
            if (video.readyState >= 2) {
              setBufferingInstant(false);
              setIsLoading(false);
              
              // Try to start playing if auto-play is enabled and not started yet
              if (autoPlay && !hasStartedPlaying && video.paused) {
                video.play().catch(console.error);
              }
            }
          });

          // Add quality level monitoring
          hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log(`Switched to quality level: ${data.level}`);
            
            // Update auto quality if we're in auto mode
            if (currentQuality === "-1") {
              const qualityLabel = hls.levels[data.level]?.height + "P";
              setCurrentAutoQuality(qualityLabel);
              console.log(`Auto quality switched to: ${qualityLabel}`);
            }
          });

          // Add audio tracks handler
          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
            console.log("Audio tracks updated:", data);
            if (data.audioTracks && data.audioTracks.length > 0) {
              const tracks = data.audioTracks.map((track, index) => ({
                id: index.toString(),
                label: track.name || `Audio ${index + 1}`,
                language: track.lang || 'unknown'
              }));
              console.log("Setting audio tracks:", tracks);
              setAudioTracks(tracks);
              
              // Set initial audio track if not set
              if (!currentAudioTrack && tracks.length > 0) {
                const defaultTrack = tracks.find(track => track.language === 'hi') || tracks[0];
                setCurrentAudioTrack(defaultTrack.id);
                hls.audioTrack = parseInt(defaultTrack.id);
                console.log(`Set initial audio track to ${defaultTrack.id} (${defaultTrack.label})`);
              } else if (currentAudioTrack) {
                // Restore previously selected audio track
                try {
                  hls.audioTrack = parseInt(currentAudioTrack);
                  console.log(`Restored audio track to ${currentAudioTrack} after tracks update`);
                } catch (error) {
                  console.error('Error restoring audio track after tracks update:', error);
                }
              }
            }
          });

          // Add audio track switched handler
          hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
            console.log('Audio track switched:', data);
            if (data.id !== undefined) {
              setCurrentAudioTrack(data.id.toString());
              console.log(`Updated current audio track to ${data.id}`);
            }
          });

          // Attach media and load source
          hls.attachMedia(video);
          hls.loadSource(masterUrl);

          // Handle HLS events for instant startup
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
          
            // Set available qualities
            if (hls.levels && hls.levels.length > 0) {
              const hlsQualities = [
                { label: "AUTO", value: "-1" },
                ...hls.levels.map((level, index) => ({
                  label: `${level.height}P`,
                  value: index.toString()
                }))
              ];
              setAvailableQualities(hlsQualities);
              
              // Always start with lowest quality for instant startup
              hls.currentLevel = 0;
              setCurrentQuality("0");
              initialQualitySet.current = true;
              
              // Switch to auto quality after just 1 second of playback
              setTimeout(() => {
                if (hls && !hls.destroyed && hasStartedPlaying) {
                  hls.currentLevel = -1;
                  setCurrentQuality("-1");
                }
              }, 1000);
            }
            
            // Force immediate playback attempt
            if (autoPlay) {
              // Multiple aggressive playback attempts
              const attemptPlay = async () => {
                try {
                  await video.play();
                } catch (error) {
                  // Retry after minimal delay
                  setTimeout(async () => {
                    try {
                      await video.play();
                    } catch (retryError) {
                      setPlayerError("Click to start video playback");
                    }
                  }, 50);
                }
              };
              
              // Immediate attempt
              attemptPlay();
              
              // Also try when any data is available
              if (video.readyState < 2) {
                const playOnReady = () => {
                  attemptPlay();
                  video.removeEventListener('loadeddata', playOnReady);
                };
                video.addEventListener('loadeddata', playOnReady);
              }
            }
          });

          // Ultra-aggressive auto-play mechanism
          const forceAutoPlay = () => {
            if (!autoPlay || !video) return;
            
            let playAttempts = 0;
            const maxAttempts = 5;
            
            const attemptPlay = async () => {
              if (playAttempts >= maxAttempts || !video.paused) return;
              
              playAttempts++;
              
              try {
                await video.play();
                return;
              } catch (error) {
                if (playAttempts < maxAttempts) {
                  // Try again with increasing delays
                  setTimeout(attemptPlay, playAttempts * 100);
                } else {
                  setPlayerError("Click to start video playback");
                }
              }
            };
            
            // Start attempting immediately
            attemptPlay();
          };

          // Progressive buffer optimization - start with minimal buffer, then increase
          let bufferOptimizationTimeout: NodeJS.Timeout;
          
          const optimizeBufferAfterStartup = () => {
            if (hls && !hls.destroyed) {
              // After 2 seconds of playback, increase buffer for smoother experience
              bufferOptimizationTimeout = setTimeout(() => {
                if (hls && !hls.destroyed) {
                  // Update buffer settings for better streaming experience
                  hls.config.maxBufferLength = 15;
                  hls.config.maxMaxBufferLength = 30;
                  hls.config.maxBufferSize = 30 * 1000 * 1000;
                  console.log("Buffer settings optimized for streaming");
                }
              }, 2000);
            }
          };

          // Start buffer optimization and auto-play after first play
          video.addEventListener('playing', optimizeBufferAfterStartup, { once: true });
          
          // Multiple auto-play triggers
          video.addEventListener('loadedmetadata', forceAutoPlay, { once: true });
          video.addEventListener('canplay', forceAutoPlay, { once: true });
          
          // Immediate auto-play attempt
          if (autoPlay) {
            setTimeout(forceAutoPlay, 100);
          }

          setHlsInstance(hls);
        } catch (error) {
          console.error("Error initializing HLS:", error);
          setPlayerError("Failed to initialize video player. Please try refreshing the page.");
        }
      } else {
        console.error("No HLS playback method available for this browser");
        setPlayerError("Your browser does not support HLS video playback. Please try using Chrome, Firefox, Safari, or Edge.");
      }
    };

    // Execute the async function
    initializeHls();

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [masterUrl, currentQuality, currentAudioTrack]);

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
            await updateWatchTime(currentProfile.id, contentId, 0, true);
            console.log("Video completed, resetting watch time to 0");
          } else {
            await updateWatchTime(currentProfile.id, contentId, Math.floor(time), false);
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
  }, [currentProfile?.id, contentId, updateWatchTime]);

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

      if (
        typeof currentEpisodeIndex === "number" &&
        onChangeEpisode &&
        currentEpisodeIndex < (episodes?.length || 0) - 1
      ) {
        onChangeEpisode(currentEpisodeIndex + 1);
    }
  }, [currentProfile?.id, currentEpisodeIndex, episodes?.length, onChangeEpisode, updateWatchHistory]);

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

  // Add error recovery for buffering issues
  const handleError = useCallback((event: ErrorEvent) => {
    const video = event.target as HTMLVideoElement;
    console.error("Video error:", video.error);
    
    if (video.error?.code === MediaError.MEDIA_ERR_ABORTED) {
      return;
    }
    
    // Try to recover from buffering issues
    if (video.error?.code === MediaError.MEDIA_ERR_NETWORK || 
        video.error?.code === MediaError.MEDIA_ERR_DECODE) {
      // Reset to beginning if stuck at end
      if (video.currentTime >= video.duration * 0.9) {
        video.currentTime = 0;
        setCurrentTime(0);
        console.log("Recovering from buffering issue by resetting to start");
      }
      
      // Try to reload the video
      video.load();
      video.play().catch(console.error);
    }
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
              const time = await getWatchTime(currentProfile.id, contentId);
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
  }, [currentProfile?.id, contentId, getWatchTime]);

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

  const handleQualityChange = (quality: string) => {
    if (!hlsInstance || isQualityChanging) return;

    try {
      setIsQualityChanging(true);
      const video = videoRef.current;
      if (!video) return;
      
      // Save current state
      const wasPlaying = !video.paused;
      const currentTime = video.currentTime;
      const currentAudioTrackId = currentAudioTrack;
      const currentSubtitleId = subtitleManagerRef.current?.getCurrentTrack();
      
      // Change quality
      const qualityLevel = parseInt(quality);
      hlsInstance.currentLevel = qualityLevel;
      setCurrentQuality(quality);
      setShowQualityMenu(false);
      
      if (quality === "-1") {
        setCurrentAutoQuality("");
      }
      
      // Restore playback state
      video.currentTime = currentTime;
        if (wasPlaying) {
        video.play().catch(error => {
          console.error("Error resuming playback after quality change:", error);
          // If play fails, try to seek to the correct position
          video.currentTime = currentTime;
        });
      }

      // Restore audio track
      if (currentAudioTrackId) {
        try {
          hlsInstance.audioTrack = parseInt(currentAudioTrackId);
        } catch (error) {
          console.error('Error restoring audio track:', error);
        }
      }

      // Restore subtitle track
      if (currentSubtitleId && currentSubtitleId !== 'off' && subtitleManagerRef.current) {
        subtitleManagerRef.current.setTrack(currentSubtitleId);
      }
    } catch (error) {
      console.error('Error during quality change:', error);
    } finally {
      setTimeout(() => {
        setIsQualityChanging(false);
      }, 500);
    }
  };

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
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (hlsInstance) {
        hlsInstance.destroy();
        setHlsInstance(null);
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

  // Debug: Log current state (only when needed)
  // console.log("Video Player State:", {
  //   isPlaying,
  //   isMuted,
  //   volume,
  //   currentTime,
  //   duration,
  //   isBuffering,
  //   currentQuality,
  // });

  // Update the audio track change handler
  const handleAudioTrackChange = (trackId: string) => {
    if (!hlsInstance || isQualityChanging) return;
    
    try {
      setIsQualityChanging(true);
      const video = videoRef.current;
      if (!video) return;
      
      // Save current state
      const wasPlaying = !video.paused;
      const currentTime = video.currentTime;
      const currentSubtitleId = subtitleManagerRef.current?.getCurrentTrack();
      
      // Change audio track
      hlsInstance.audioTrack = parseInt(trackId);
      setCurrentAudioTrack(trackId);
      setShowAudioMenu(false);
      
      // Restore playback state
      video.currentTime = currentTime;
      if (wasPlaying) {
        video.play().catch(error => {
          console.error("Error resuming playback after audio change:", error);
          // If play fails, try to seek to the correct position
      video.currentTime = currentTime;
        });
      }

      // Restore subtitle track
      if (currentSubtitleId && currentSubtitleId !== 'off' && subtitleManagerRef.current) {
        subtitleManagerRef.current.setTrack(currentSubtitleId);
      }
    } catch (error) {
      console.error('Error changing audio track:', error);
    } finally {
      setIsQualityChanging(false);
    }
  };

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

  // Update episode handling
  const handleEpisodeChange = useCallback((newIndex: number) => {
    if (!episodes || !onChangeEpisode) return;
    
    try {
      // Save current playback state
      const wasPlaying = !videoRef.current?.paused;
      const currentTime = videoRef.current?.currentTime || 0;
      
      // Update episode
      onChangeEpisode(newIndex);
      
      // Reset player state
      setIsPlaying(false);
      setCurrentTime(0);
      setShowControls(true);
      setShowTitleOverlay(true);
      
      // Clear any existing error
      setPlayerError(null);
      
      // Wait for the new video to load
      if (videoRef.current) {
        videoRef.current.load();
        
        // Try to restore playback state
        if (wasPlaying) {
          videoRef.current.play().catch(console.error);
        }
      }
    } catch (error) {
      console.error('Error changing episode:', error);
    }
  }, [episodes, onChangeEpisode]);

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
      console.log('No subtitle URLs provided');
      return;
    }

    console.log('Initializing subtitles with URLs:', subtitleUrls);

    // Initialize subtitle manager
    if (!subtitleManagerRef.current) {
      subtitleManagerRef.current = new SubtitleManager(video);
    }
    
    // Initialize tracks
    subtitleManagerRef.current.initialize(subtitleUrls);
    
    // Update available tracks state
    const tracks = subtitleManagerRef.current.getAvailableTracks();
    console.log('Available subtitle tracks:', tracks);
    
    if (tracks.length > 0) {
      setSubtitleTracks(tracks);
      
      // Set initial track to English or first available
      const defaultTrack = tracks.find(track => track.language === 'en') || tracks[0];
      console.log('Setting default subtitle track:', defaultTrack);
      setCurrentSubtitleTrack(defaultTrack.id);
      subtitleManagerRef.current.setTrack(defaultTrack.id);
    } else {
      console.log('No subtitle tracks found after initialization');
    }

    // Add track change listener
    const handleTrackChange = () => {
      const textTracks = Array.from(video.textTracks);
      console.log('Text tracks changed:', textTracks.map(t => ({
        language: t.language,
        mode: t.mode,
        label: t.label
      })));
      
      const showingTrack = textTracks.find(track => track.mode === 'showing');
      if (showingTrack) {
        console.log('Setting current subtitle track to:', showingTrack.language);
        setCurrentSubtitleTrack(showingTrack.language);
      } else {
        console.log('No showing track found, setting to off');
        setCurrentSubtitleTrack('off');
      }
    };

    video.addEventListener('texttrackchange', handleTrackChange);

    return () => {
      video.removeEventListener('texttrackchange', handleTrackChange);
      if (subtitleManagerRef.current) {
        subtitleManagerRef.current.refresh();
      }
    };
  }, [subtitleUrls]);

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
  }, [currentProfile?.id, contentId, updateWatchHistory]);

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

    const handleHlsSeeking = () => {
      setIsBuffering(true);
    };

    const handleHlsSeeked = () => {
      setIsBuffering(false);
    };

    const handleHlsBuffering = (event: any, data: any) => {
      if (data.stats) {
        setIsBuffering(data.stats.loading);
      }
    };

    // Use the correct HLS event types from the Hls.Events enum
    hlsInstance.on(Hls.Events.LEVEL_LOADING, handleHlsSeeking);
    hlsInstance.on(Hls.Events.LEVEL_LOADED, handleHlsSeeked);
    hlsInstance.on(Hls.Events.BUFFER_APPENDING, handleHlsBuffering);
    hlsInstance.on(Hls.Events.BUFFER_APPENDED, handleHlsBuffering);

    return () => {
      hlsInstance.off(Hls.Events.LEVEL_LOADING, handleHlsSeeking);
      hlsInstance.off(Hls.Events.LEVEL_LOADED, handleHlsSeeked);
      hlsInstance.off(Hls.Events.BUFFER_APPENDING, handleHlsBuffering);
      hlsInstance.off(Hls.Events.BUFFER_APPENDED, handleHlsBuffering);
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

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
        // Fallback auto-play on any click
        if (videoRef.current && videoRef.current.paused && autoPlay) {
          videoRef.current.play().catch(console.error);
          setPlayerError(null);
        }
      }}
    >
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
        className={`absolute inset-0 w-full h-full object-contain transition-all duration-300 z-0 ${
          isQualityChanging ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'
        }`}
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
          setIsLoading(false);
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
          // Try auto-play immediately when metadata is loaded
          if (autoPlay && videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(console.error);
          }
        }}
        playsInline
        muted={isMuted}
        tabIndex={0}
        aria-label="Video player"
        preload="none"
        controls={false}
        crossOrigin="anonymous"
        autoPlay={autoPlay}
        // Reduce rendering overhead
        style={{
          willChange: 'auto',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
          transform: 'translateZ(0)', // Force hardware acceleration
          imageRendering: 'auto' // Fix: use valid value for type
        }}
        // Additional performance attributes
        onLoadStart={() => {
          if (autoPlay && videoRef.current) {
            // Pre-emptive play attempt
            setTimeout(() => {
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
              }
            }, 10);
          }
        }}
        onCanPlay={() => {
          if (autoPlay && videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(console.error);
          }
        }}
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
              onClick={togglePlay}
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

      {/* Netflix-style next episode button */}
      {showNextEpisode && episodes && currentEpisodeIndex !== undefined && (
        <div className="absolute bottom-20 right-4 bg-black/80 p-4 rounded-md">
          <h3 className="text-white text-lg font-medium mb-2">Next Episode</h3>
          <p className="text-gray-300 text-sm mb-4">
            {episodes[currentEpisodeIndex + 1]?.title}
          </p>
          <button
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
            onClick={() => handleEpisodeChange(currentEpisodeIndex + 1)}
          >
            Play Next
          </button>
        </div>
      )}

      {/* Center controls overlay */}
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
            onClick={togglePlay}
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
                    className="h-1.5 bg-gray-600/50 rounded-full cursor-pointer relative group"
                    onMouseDown={handleProgressMouseDown}
                    onMouseMove={handleProgressHover}
                    onMouseLeave={handleProgressLeave}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    style={{ touchAction: 'pan-x' }}
                  >
                    {buffered && duration > 0 && Array.from({ length: buffered.length }).map((_, i) => {
                      const start = buffered.start(i);
                      const end = buffered.end(i);
                      const left = (start / duration) * 100;
                      const width = ((end - start) / duration) * 100;
                      return (
                        <div
                          key={i}
                          className="absolute h-full bg-gray-400/50 rounded-full"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                          }}
                        />
                      );
                    })}
                    <div
                      className="h-full bg-red-600 rounded-full relative transition-all duration-100"
                      style={{
                        width: `${((dragProgress ?? currentTime) / duration) * 100}%`,
                      }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-100 group-hover:scale-110" />
                    </div>
                    {((hoverPosition && !isDraggingRef.current) || isHoldingToSeek) && (
                      <div
                        className="absolute top-0 h-full w-1 bg-white opacity-50 transition-opacity duration-200"
                        style={{ left: `${hoverPosition?.x}px` }}
                      />
                    )}
                  </div>
                </div>
                {((hoverPosition && !isDraggingRef.current) || isHoldingToSeek) && (
                  <div
                    className="absolute bottom-full left-0 transform -translate-x-1/2 mb-2 px-2 py-1 text-white text-sm pointer-events-none"
                    style={{ left: `${hoverPosition?.x}px` }}
                  >
                    {formatTime(hoverPosition?.time || 0)}
                  </div>
                )}
              </div>
              <div className="text-white text-sm min-w-[100px]">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div 
            ref={controlsAreaRef}
            className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-all duration-300 ease-in-out z-10"
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              {/* Volume controls */}
              <div className="flex items-center space-x-2" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                  aria-label={isMuted ? "Unmute" : "Mute"}
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
                    onTouchStart={handleVolumeTouchStart}
                    onTouchMove={handleVolumeTouchMove}
                    className="w-20 accent-white cursor-pointer"
                    aria-label="Volume"
                  />
                </div>
              </div>

              {/* Other controls */}
              <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                  className={`text-white transition-colors p-2 rounded-full hover:bg-white/10 ${
                    currentSubtitleTrack !== 'off' ? 'text-red-500' : ''
                  }`}
                  aria-label="Subtitle settings"
            >
              <Subtitles size={24} />
            </button>

            <button
              onClick={() => setShowAudioMenu(!showAudioMenu)}
                  className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                  aria-label="Audio settings"
            >
              <Headphones size={24} />
            </button>

            <button
              onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                  aria-label="Quality settings"
            >
              <Settings size={24} />
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
        <div className={`absolute bottom-16 right-4 bg-black/90 p-4 rounded-md shadow-lg transform transition-all duration-200 ease-in-out min-w-[200px] quality-menu z-20 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}>
          <h3 className="text-white text-lg font-medium mb-2">Quality</h3>
          {availableQualities.map((quality) => (
            <button
              key={quality.value}
              onClick={() => handleQualityChange(quality.value)}
              className={`block w-full text-left px-4 py-2 rounded-md transition-colors duration-200 ${
                currentQuality === quality.value
                  ? "bg-white text-black"
                  : "text-white hover:bg-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>
                  {quality.label === "AUTO" 
                    ? `Auto${currentAutoQuality ? ` (${currentAutoQuality})` : ''}`
                    : quality.label}
                </span>
                {currentQuality === quality.value && (
                  <span className="text-black">✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showSubtitleMenu && (
        <div className={`absolute bottom-16 right-4 bg-black/90 p-4 rounded-md min-w-[200px] shadow-lg transform transition-all duration-200 ease-in-out subtitle-menu z-20 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}>
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
        <div className={`absolute bottom-16 right-4 bg-black/90 p-4 rounded-md shadow-lg transform transition-all duration-200 ease-in-out audio-menu z-20 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}>
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
      {showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
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
    </div>
  );
};

export default VideoPlayer;

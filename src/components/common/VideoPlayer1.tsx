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
  const { updateWatchTime } = useWatchHistoryStore();
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

  // Add state for orientation
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

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

      // Store current playback position in the ref so it persists across renders
      savedPositionRef.current = video.currentTime > 0 ? video.currentTime : savedPositionRef.current;
      const wasPlaying = !video.paused;
      const currentAudioTrackId = currentAudioTrack;
      
      console.log(`QUALITY CHANGE: Saving position ${savedPositionRef.current}s, video was ${wasPlaying ? 'playing' : 'paused'}, audio track: ${currentAudioTrackId}`);
      
      // Update watch history before changing quality
      if (currentProfile?.id && savedPositionRef.current > 0) {
        try {
          const completed = savedPositionRef.current >= video.duration * 0.9;
          console.log(`Quality change - updating watch history: time=${Math.floor(savedPositionRef.current)}, completed=${completed}`);
          updateWatchTime(
            currentProfile.id,
            contentId,
            Math.floor(savedPositionRef.current),
            completed
          );
        } catch (error) {
          console.error("Error updating watch history on quality change:", error);
        }
      }

      // Clean up previous HLS instance if it exists
      if (hlsInstance) {
        hlsInstance.destroy();
        setHlsInstance(null);
      }

      // Initialize HLS if the browser supports it
      if (masterUrl && typeof Hls !== "undefined" && Hls.isSupported()) {
        try {
          const hls = new Hls({
            // Optimize buffer settings
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferHole: 0.5,
            lowLatencyMode: true,
            backBufferLength: 90,
            
            // Optimize loading settings
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 4,
            manifestLoadingRetryDelay: 1000,
            levelLoadingTimeOut: 20000,
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 1000,
            fragLoadingTimeOut: 20000,
            fragLoadingMaxRetry: 4,
            fragLoadingRetryDelay: 1000,
            
            // Optimize playback settings
            startLevel: -1, // Auto quality selection
            abrEwmaDefaultEstimate: 500000, // 500 kbps
            testBandwidth: true,
            progressive: true,
            enableWorker: true,
            startFragPrefetch: true,
            
            // Optimize network settings
            xhrSetup: function(xhr: XMLHttpRequest, url: string) {
              xhr.withCredentials = false;
              if (url.indexOf('?') === -1) {
                url += '?_=' + Date.now();
              } else {
                url += '&_=' + Date.now();
              }
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

          // Add quality level monitoring
          hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log(`Switched to quality level: ${data.level}`);
            
            // Only update auto quality if we're in auto mode
            if (currentQuality === "-1") {
              const qualityLabel = hls.levels[data.level]?.height + "P";
              setCurrentAutoQuality(qualityLabel);
            }
          });

          // Attach media and load source
          hls.attachMedia(video);
          hls.loadSource(masterUrl);

          // Handle HLS events
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS manifest parsed successfully");
          
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
              
              // Set initial quality
              if (!initialQualitySet.current) {
                hls.currentLevel = -1; // Start with auto
                setCurrentQuality("-1");
                initialQualitySet.current = true;
              } else {
                // Restore previous quality if set
                const qualityLevel = parseInt(currentQuality);
                if (!isNaN(qualityLevel)) {
                  hls.currentLevel = qualityLevel;
                }
              }
            }
            
            // Restore audio track if we had one selected
            if (currentAudioTrackId) {
              try {
                hls.audioTrack = parseInt(currentAudioTrackId);
                console.log(`Restored audio track to ${currentAudioTrackId} after manifest parse`);
              } catch (error) {
                console.error('Error restoring audio track after manifest parse:', error);
              }
            }
            
            video.play().catch(error => {
              console.error("Error playing video:", error);
              setPlayerError("Failed to play video. Please try refreshing the page.");
            });
          });

          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
            console.log("Audio tracks updated:", hls.audioTracks);
            if (hls.audioTracks && hls.audioTracks.length > 0) {
              const tracks = hls.audioTracks.map((track, index) => ({
                id: index.toString(),
                label: track.name || `Audio ${index + 1}`,
                language: track.lang || 'unknown'
              }));
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

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Always save the current position to our ref for quality changes
      savedPositionRef.current = video.currentTime;
      if (watchTimeUpdateRef.current) {
        clearTimeout(watchTimeUpdateRef.current);
      }
      watchTimeUpdateRef.current = setTimeout(() => {
        if (currentProfile?.id) {
          try {
            const completed = video.currentTime >= video.duration * 0.9;
            console.log(`Updating watch history: time=${Math.floor(video.currentTime)}, completed=${completed}`);
            updateWatchTime(
              currentProfile.id,
              contentId,
              Math.floor(video.currentTime),
              completed
            );
          } catch (error) {
            console.error("Error updating watch history:", error);
          }
        } else {
          console.warn("Cannot update watch history: No current profile ID");
        }
      }, 5000); // Reduced timeout to update more frequently
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (currentProfile?.id) {
        try {
          console.log(`Video ended, updating watch history as completed`);
          updateWatchTime(
            currentProfile.id,
            contentId,
            Math.floor(video.duration),
            true
          );
        } catch (error) {
          console.error("Error updating watch history at end:", error);
        }
      } else {
        console.warn("Cannot update watch history on end: No current profile ID");
      }
      if (
        typeof currentEpisodeIndex === "number" &&
        onChangeEpisode &&
        currentEpisodeIndex < (episodes?.length || 0) - 1
      ) {
        onChangeEpisode(currentEpisodeIndex + 1);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleCanPlay = () => setIsBuffering(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      if (watchTimeUpdateRef.current) {
        clearTimeout(watchTimeUpdateRef.current);
      }
    };
  }, [
    contentId,
    updateWatchTime,
    currentProfile?.id,
    currentEpisodeIndex,
    episodes?.length,
    onChangeEpisode,
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

  // Fetch last watched time on mount/contentId change
  useEffect(() => {
    let isMounted = true;

    async function fetchLastWatched() {
      if (currentProfile?.id && contentId) {
        if (typeof useWatchHistoryStore.getState === "function") {
          const getWatchTime = useWatchHistoryStore.getState().getWatchTime;
          const updateWatchTime =
            useWatchHistoryStore.getState().updateWatchTime;

          if (
            typeof getWatchTime === "function" &&
            typeof updateWatchTime === "function"
          ) {
            try {
              const time = await getWatchTime(currentProfile.id, contentId);
              if (isMounted && typeof time === "number" && time > 0) {
                setLastWatchedTime(time);
                updateWatchTime(currentProfile.id, contentId, time);
              }
            } catch (error) {
              console.error("Error fetching last watched time:", error);
            }
          }
        }
      }
    }

    fetchLastWatched();
    return () => {
      isMounted = false;
    };
  }, [currentProfile?.id, contentId]);

  // Set initial playback position if startTime or lastWatchedTime is provided, but only after metadata is loaded
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setTime = () => {
      if (typeof startTime === "number" && startTime > 0) {
        video.currentTime = startTime;
      } else if (typeof lastWatchedTime === "number" && lastWatchedTime > 0) {
        video.currentTime = lastWatchedTime;
      }
    };
    video.addEventListener("loadedmetadata", setTime, { once: true });
    // If already loaded
    if (video.readyState >= 1) setTime();
    return () => video.removeEventListener("loadedmetadata", setTime);
  }, [startTime, lastWatchedTime, currentQuality]);

  // Function to handle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Function to handle source element errors
  const handleSourceError = (event: Event) => {
    const source = event.target as HTMLSourceElement;
    if (source.onerror) {
      source.onerror(event);
    }
  };

  // Function to check source element ready state
  const checkSourceReadyState = (source: HTMLSourceElement) => {
    const readyState = (source as any).readyState;
    return readyState === 'complete' || readyState === 'interactive';
  };

  // Player Controls
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      setUserPaused(true);
      videoRef.current.pause();
    } else {
      setUserPaused(false);
      // Always unmute and set volume on user play
      videoRef.current.muted = false;
      setIsMuted(false);
      videoRef.current.volume = volume || 1;
      videoRef.current.play();
    }
    // Do not set isPlaying here; let onPlay/onPause handle it
  };

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

  const toggleMute = () => {
    if (!videoRef.current) return;

    if (isMuted) {
      videoRef.current.volume = volume || 1;
      videoRef.current.muted = false;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const handleQualityChange = (quality: string) => {
    if (!hlsInstance || isQualityChanging) return;
    
    // Clear any pending quality changes
    if (qualityChangeTimeoutRef.current) {
      clearTimeout(qualityChangeTimeoutRef.current);
    }

    // Prevent rapid changes
    if (quality === currentQuality) return;

    try {
      setIsQualityChanging(true);
      
      // Save current playback state
      const wasPlaying = !videoRef.current?.paused;
      const currentTime = videoRef.current?.currentTime || 0;
      const currentAudioTrackId = currentAudioTrack;
      
      // Change quality immediately
      const qualityLevel = parseInt(quality);
      console.log(`Changing quality to level: ${qualityLevel}`);
      
      // Set the quality level directly
      hlsInstance.currentLevel = qualityLevel;
      setCurrentQuality(quality);
      setShowQualityMenu(false);
      
      // If switching to auto, clear the current auto quality
      if (quality === "-1") {
        setCurrentAutoQuality("");
      }
      
      // Restore playback state and audio track
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        if (wasPlaying) {
          videoRef.current.play().catch(console.error);
        }
      }

      if (currentAudioTrackId) {
        try {
          hlsInstance.audioTrack = parseInt(currentAudioTrackId);
        } catch (error) {
          console.error('Error restoring audio track after quality change:', error);
        }
      }
    } catch (error) {
      console.error('Error during quality change:', error);
    } finally {
      // Ensure loading state is cleared after a minimum duration
      setTimeout(() => {
        setIsQualityChanging(false);
      }, 500);
    }
  };

  // Function to show controls temporarily
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowQualityMenu(false);
        setShowAudioMenu(false);
      }
    }, 2000); // Hide after 2 seconds
  }, [isPlaying]);

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
    showControlsTemporarily();
  };

  // Enhanced touch handlers
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isTouchingControls) return;
    // Prevent default touch move behavior
    e.preventDefault();
  }, [isTouchingControls]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Check if touch is on controls
    const target = e.target as HTMLElement;
    const isControlElement = target.closest('.video-controls') !== null;
    
    if (isControlElement) {
      setIsTouchingControls(true);
      showControlsTemporarily();
      return;
    }

    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    
    // Check for double tap
    const currentTime = Date.now();
    if (currentTime - lastTapTime < 300 && lastTapPosition) {
      const screenWidth = window.innerWidth;
      const tapX = touch.clientX;
      
      if (tapX < screenWidth / 2) {
        seek(-10);
        setShowSeekIndicator(true);
        setSeekAmount(-10);
        setTimeout(() => setShowSeekIndicator(false), 1000);
      } else {
        seek(10);
        setShowSeekIndicator(true);
        setSeekAmount(10);
        setTimeout(() => setShowSeekIndicator(false), 1000);
      }
    } else {
      // Single tap - show controls
      showControlsTemporarily();
    }
    
    setLastTapTime(currentTime);
    setLastTapPosition({ x: touch.clientX, y: touch.clientY });
  }, [lastTapTime, lastTapPosition, showControlsTemporarily]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isTouchingControls) {
      setIsTouchingControls(false);
    }
  }, [isTouchingControls]);

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

  // Optimized progress bar handlers
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = true;
    dragProgressRef.current = null;
    updateSeekFromEvent(e);
    setShowControls(true);
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleDocumentMouseMove);
    window.addEventListener("mouseup", handleDocumentMouseUp);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = true;
    dragProgressRef.current = null;
    updateSeekFromTouchEvent(e);
    setShowControls(true);
    document.body.style.userSelect = "none";
    window.addEventListener("touchmove", handleDocumentTouchMove);
    window.addEventListener("touchend", handleDocumentTouchEnd);
  };

  const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !progressRef.current) return;
    
    const now = performance.now();
    if (now - lastUpdateTimeRef.current < 16) return; // Limit to ~60fps
    lastUpdateTimeRef.current = now;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    
    // Use RAF for smooth updates
    if (RAF_ID.current) {
      cancelAnimationFrame(RAF_ID.current);
    }
    
    RAF_ID.current = requestAnimationFrame(() => {
      dragProgressRef.current = newTime;
      setDragProgress(newTime);
      
      // Update video position while dragging
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    });
  }, [duration]);

  const handleDocumentTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current || !progressRef.current) return;
    
    const now = performance.now();
    if (now - lastUpdateTimeRef.current < 16) return; // Limit to ~60fps
    lastUpdateTimeRef.current = now;

    const touch = e.touches[0];
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (touch.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    
    // Use RAF for smooth updates
    if (RAF_ID.current) {
      cancelAnimationFrame(RAF_ID.current);
    }
    
    RAF_ID.current = requestAnimationFrame(() => {
      dragProgressRef.current = newTime;
      setDragProgress(newTime);
      
      // Update video position while dragging
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    });
  }, [duration]);

  const handleDocumentMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    
    // Get the latest drag position
    const seekTime = dragProgressRef.current !== null ? dragProgressRef.current : currentTime;
    
    // Update video position
    if (videoRef.current) {
      console.log(`Seeking to ${seekTime}s via mouse`);
      
      // Ensure HLS is at the right segment by seeking
      if (hlsInstance) {
        try {
          // Save a reference to the current state
          const wasPlaying = !videoRef.current.paused;
          
          // Set the time on the video element
          videoRef.current.currentTime = seekTime;
          
          // Force media to continue playing if it was playing
          if (wasPlaying) {
            videoRef.current.play()
              .then(() => console.log("Playback resumed after seek"))
              .catch(err => console.error("Error resuming playback after seek:", err));
          }
        } catch (error) {
          console.error("Error during seek operation:", error);
        }
      } else {
        // Standard seek for non-HLS playback
        videoRef.current.currentTime = seekTime;
      }
    }
    
    // Update UI state
    setCurrentTime(seekTime);
    setDragProgress(null);
    dragProgressRef.current = null;
    
    // Clean up
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", handleDocumentMouseMove);
    window.removeEventListener("mouseup", handleDocumentMouseUp);
    
    if (RAF_ID.current) {
      cancelAnimationFrame(RAF_ID.current);
    }
  }, [currentTime, hlsInstance]);

  const handleDocumentTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    
    // Get the latest drag position
    const seekTime = dragProgressRef.current !== null ? dragProgressRef.current : currentTime;
    
    // Update video position
    if (videoRef.current) {
      console.log(`Seeking to ${seekTime}s via touch`);
      
      // Ensure HLS is at the right segment by seeking
      if (hlsInstance) {
        try {
          // Save a reference to the current state
          const wasPlaying = !videoRef.current.paused;
          
          // Set the time on the video element
          videoRef.current.currentTime = seekTime;
          
          // Force media to continue playing if it was playing
          if (wasPlaying) {
            videoRef.current.play()
              .then(() => console.log("Playback resumed after touch seek"))
              .catch(err => console.error("Error resuming playback after touch seek:", err));
          }
        } catch (error) {
          console.error("Error during touch seek operation:", error);
        }
      } else {
        // Standard seek for non-HLS playback
        videoRef.current.currentTime = seekTime;
      }
    }
    
    // Update UI state
    setCurrentTime(seekTime);
    setDragProgress(null);
    dragProgressRef.current = null;
    
    // Clean up
    document.body.style.userSelect = "";
    window.removeEventListener("touchmove", handleDocumentTouchMove);
    window.removeEventListener("touchend", handleDocumentTouchEnd);
    
    if (RAF_ID.current) {
      cancelAnimationFrame(RAF_ID.current);
    }
  }, [currentTime, hlsInstance]);

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

  // Add audio track change handler
  const handleAudioTrackChange = (trackId: string) => {
    if (!hlsInstance || isQualityChanging) return;
    
    try {
      setIsQualityChanging(true);
      const video = videoRef.current;
      if (!video) return;
      
      // Save current playback state
      const wasPlaying = !video.paused;
      const currentTime = video.currentTime;
      
      // Change audio track
      hlsInstance.audioTrack = parseInt(trackId);
      setCurrentAudioTrack(trackId);
      setShowAudioMenu(false);
      
      // Restore playback state immediately
      if (wasPlaying) {
        video.play().catch(console.error);
      }
      video.currentTime = currentTime;
    } catch (error) {
      console.error('Error changing audio track:', error);
    } finally {
      setIsQualityChanging(false);
    }
  };

  // Update the audio track detection useEffect
  useEffect(() => {
    if (!hlsInstance) return;

    const handleAudioTracksUpdated = () => {
      if (hlsInstance.audioTracks && hlsInstance.audioTracks.length > 0) {
        const tracks = hlsInstance.audioTracks.map((track, index) => ({
          id: index.toString(),
          label: track.name || `Audio ${index + 1}`,
          language: track.lang || 'unknown'
        }));
        setAudioTracks(tracks);
        
        // Set initial audio track if not set
        if (!currentAudioTrack && tracks.length > 0) {
          const defaultTrack = tracks.find(track => track.language === 'hi') || tracks[0];
          setCurrentAudioTrack(defaultTrack.id);
          hlsInstance.audioTrack = parseInt(defaultTrack.id);
          console.log(`Set initial audio track to ${defaultTrack.id} (${defaultTrack.label})`);
        }
      }
    };

    hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, handleAudioTracksUpdated);
    
    // Initial check for audio tracks
    if (hlsInstance.audioTracks && hlsInstance.audioTracks.length > 0) {
      handleAudioTracksUpdated();
    }

    return () => {
      hlsInstance.off(Hls.Events.AUDIO_TRACKS_UPDATED, handleAudioTracksUpdated);
    };
  }, [hlsInstance, currentAudioTrack]);

  // Update loading state management
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => {
      if (!isBuffering) {
        setIsBuffering(true);
        setIsLoading(true);
      }
    };

    const handlePlaying = () => {
      setIsBuffering(false);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
      setIsLoading(false);
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  // Update the progress bar hover handler
  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const hoverTime = Math.max(0, Math.min(duration, percent * duration));
    setHoverPosition({ time: hoverTime, x: e.clientX });
  };

  // Add video sync monitoring with improved error handling
  const checkVideoSync = useCallback(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Check if video is playing but not advancing
    if (!video.paused && video.currentTime === lastSyncTimeRef.current) {
      console.log('Video playback stalled, attempting to recover...');
      const currentTime = video.currentTime;
      video.currentTime = currentTime + 0.1; // Small jump to trigger playback
    }
    
    // Update last sync time
    lastSyncTimeRef.current = video.currentTime;
  }, []);

  // Add ref for tracking last sync time
  const lastSyncTimeRef = useRef(0);

  // Add periodic sync check with cleanup
  useEffect(() => {
    const syncInterval = setInterval(checkVideoSync, 1000);
    return () => {
      clearInterval(syncInterval);
      lastSyncTimeRef.current = 0;
    };
  }, [checkVideoSync]);

  // Add video error recovery with improved handling
  const handleVideoError = useCallback(() => {
    if (!videoRef.current) return;
    
    console.log('Video error detected, attempting to recover...');
    const currentTime = videoRef.current.currentTime;
    const wasPlaying = !videoRef.current.paused;
    
    // Try to recover by seeking slightly
    videoRef.current.currentTime = currentTime + 0.1;
    
    if (wasPlaying) {
      videoRef.current.play().catch(console.error);
    }
  }, []);

  // Add error event listener
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('error', handleVideoError);
    return () => video.removeEventListener('error', handleVideoError);
  }, [handleVideoError]);

  // Add orientation change handler with debounce
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const orientationTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleOrientationChange = () => {
      if (orientationTimeoutRef.current) {
        clearTimeout(orientationTimeoutRef.current);
      }
      
      orientationTimeoutRef.current = setTimeout(() => {
        setIsPortrait(window.innerHeight > window.innerWidth);
      }, 100);
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (orientationTimeoutRef.current) {
        clearTimeout(orientationTimeoutRef.current);
      }
    };
  }, []);

  // Modify click handler for controls with debounce
  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    // Check if the click is on the video container itself or its immediate children
    const target = e.target as HTMLElement;
    const isVideoArea = target === containerRef.current || 
                       target === videoRef.current ||
                       target.parentElement === containerRef.current;
    
    if (isVideoArea) {
      setShowControls(prev => !prev);
      setShowQualityMenu(false);
      setShowAudioMenu(false);
    }
  }, []);

  // Add click handler for control buttons
  const handleControlClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Add seek indicator component
  const SeekIndicator = ({ amount }: { amount: number }) => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-black/80 text-white px-4 py-2 rounded-lg flex items-center gap-2">
        {amount > 0 ? (
          <>
            <RotateCw size={24} />
            <span>+{Math.abs(amount)}s</span>
          </>
        ) : (
          <>
            <RotateCw size={24} />
            <span>-{Math.abs(amount)}s</span>
          </>
        )}
      </div>
    </div>
  );

  // Update the quality display text
  const getQualityDisplayText = () => {
    if (currentQuality === "-1") {
      return currentAutoQuality ? `AUTO (${currentAutoQuality})` : "AUTO";
    }
    return availableQualities.find(q => q.value === currentQuality)?.label || currentQuality.toUpperCase();
  };

  // Initialize subtitle tracks
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Initialize subtitle tracks from subtitleUrls
    const tracks = Object.entries(subtitleUrls).map(([lang, url]) => ({
      id: lang,
      label: lang === 'en' ? 'English' :
             lang === 'es' ? 'Spanish' :
             lang === 'fr' ? 'French' :
             lang === 'de' ? 'German' :
             lang === 'it' ? 'Italian' :
             lang === 'pt' ? 'Portuguese' :
             lang === 'ru' ? 'Russian' :
             lang === 'ja' ? 'Japanese' :
             lang === 'ko' ? 'Korean' :
             lang === 'zh' ? 'Chinese' :
             lang,
      language: lang,
      url: url
    }));

    setSubtitleTracks(tracks);

    // Clear existing tracks first
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }

    // Add source back
    if (masterUrl) {
      const source = document.createElement('source');
      source.src = masterUrl;
      source.type = 'application/vnd.apple.mpegurl';
      video.appendChild(source);
    }

    // Add subtitle tracks
    Object.entries(subtitleUrls).forEach(([lang, url]) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = url;
      track.srclang = lang;
      track.label = lang === 'en' ? 'English' :
                   lang === 'es' ? 'Spanish' :
                   lang === 'fr' ? 'French' :
                   lang === 'de' ? 'German' :
                   lang === 'it' ? 'Italian' :
                   lang === 'pt' ? 'Portuguese' :
                   lang === 'ru' ? 'Russian' :
                   lang === 'ja' ? 'Japanese' :
                   lang === 'ko' ? 'Korean' :
                   lang === 'zh' ? 'Chinese' :
                   lang;
      track.default = lang === 'en';
      video.appendChild(track);
    });

    // Add single event listener for text track changes
    const handleTextTrackChange = () => {
      const textTracks = Array.from(video.textTracks);
      const showingTrack = textTracks.find(track => track.mode === 'showing');
      if (showingTrack) {
        setCurrentSubtitleTrack(showingTrack.language);
      } else {
        setCurrentSubtitleTrack('off');
      }
    };

    video.addEventListener('texttrackchange', handleTextTrackChange);

    return () => {
      video.removeEventListener('texttrackchange', handleTextTrackChange);
    };
  }, [subtitleUrls, masterUrl]);

  // Add debug logging for subtitle tracks
  useEffect(() => {
    console.log('Subtitle tracks:', subtitleTracks);
    console.log('Current subtitle track:', currentSubtitleTrack);
  }, [subtitleTracks, currentSubtitleTrack]);

  // Handle subtitle track changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const textTracks = Array.from(video.textTracks);
    textTracks.forEach(track => {
      if (currentSubtitleTrack === 'off') {
        track.mode = 'disabled';
      } else {
        track.mode = track.language === currentSubtitleTrack ? 'showing' : 'disabled';
      }
    });
  }, [currentSubtitleTrack]);

  // Add subtitle track change handler
  const handleSubtitleTrackChange = (trackId: string) => {
    console.log('Subtitle track change requested:', trackId);
    setCurrentSubtitleTrack(trackId);
    setShowSubtitleMenu(false);
  };

  // Add effect to handle orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', handleOrientationChange);
    return () => window.removeEventListener('resize', handleOrientationChange);
  }, []);

  // Add effect to apply subtitle styles
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const styleElement = document.createElement('style');
    styleElement.textContent = `
      ::cue {
        font-size: ${subtitleStyle.fontSize};
        font-family: ${subtitleStyle.fontFamily};
        color: ${subtitleStyle.textColor};
        background-color: ${subtitleStyle.backgroundColor}${Math.round(subtitleStyle.backgroundOpacity * 255).toString(16).padStart(2, '0')};
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, [subtitleStyle]);

  // Update click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const subtitleSettings = document.querySelector('.subtitle-settings');
      const subtitleButton = document.querySelector('.subtitle-button');
      const selectElements = document.querySelectorAll('select');
      
      // Check if click is inside any select element or its dropdown
      const isClickInSelect = Array.from(selectElements).some(select => 
        select.contains(event.target as Node) || 
        select.nextElementSibling?.contains(event.target as Node)
      );
      
      if (subtitleSettings && 
          !subtitleSettings.contains(event.target as Node) && 
          !subtitleButton?.contains(event.target as Node) &&
          !isClickInSelect) {
        setShowSubtitleSettings(false);
      }
    };

    if (showSubtitleSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSubtitleSettings]);

  // Add subtitle settings menu component
  const SubtitleSettings = () => {
    // Memoize the subtitle style updates to prevent unnecessary re-renders
    const updateSubtitleStyle = useCallback((updates: Partial<typeof subtitleStyle>) => {
      setSubtitleStyle(prev => ({ ...prev, ...updates }));
    }, []);

    return (
      <div 
        className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 min-w-[280px] z-[10003] subtitle-settings border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-sm font-semibold">Subtitle Settings</h3>
          <button 
            onClick={() => setShowSubtitleSettings(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Font Size */}
        <div className="mb-4">
          <label className="text-gray-300 text-xs font-medium mb-2 block">Font Size</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: '75%', label: 'S' },
              { value: '100%', label: 'M' },
              { value: '125%', label: 'L' },
              { value: '150%', label: 'XL' }
            ].map((size) => (
              <button
                key={size.value}
                onClick={() => updateSubtitleStyle({ fontSize: size.value })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  subtitleStyle.fontSize === size.value
                    ? 'bg-cinewave-red text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text Color */}
        <div className="mb-4">
          <label className="text-gray-300 text-xs font-medium mb-2 block">Text Color</label>
          <div className="flex gap-2">
            {[
              { color: '#FFFFFF', label: 'White' },
              { color: '#FFFF00', label: 'Yellow' },
              { color: '#00FF00', label: 'Green' },
              { color: '#00FFFF', label: 'Cyan' },
              { color: '#FF00FF', label: 'Magenta' }
            ].map(({ color, label }) => (
              <button
                key={color}
                onClick={() => updateSubtitleStyle({ textColor: color })}
                className={`group relative w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  subtitleStyle.textColor === color 
                    ? 'border-cinewave-red scale-110' 
                    : 'border-transparent hover:border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                title={label}
              >
                {subtitleStyle.textColor === color && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Background Opacity */}
        <div className="mb-2">
          <label className="text-gray-300 text-xs font-medium mb-2 block">Background Opacity</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: 0, label: '0%' },
              { value: 0.25, label: '25%' },
              { value: 0.75, label: '75%' },
              { value: 1, label: '100%' }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => updateSubtitleStyle({ backgroundOpacity: value })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  subtitleStyle.backgroundOpacity === value
                    ? 'bg-cinewave-red text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Memoize the SubtitleSettings component
  const MemoizedSubtitleSettings = useMemo(() => {
    return <SubtitleSettings />;
  }, [subtitleStyle, setShowSubtitleSettings]);

  // Update the subtitle style effect to be more efficient
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const tracks = Array.from(video.textTracks);

    tracks.forEach(track => {
      if (track.mode === 'showing') {
        track.mode = 'hidden';
        track.mode = 'showing';
      }
    });
  }, [subtitleStyle]);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black w-full h-full ${
        isFullscreen ? "fixed inset-0 z-[9999]" : ""
      }`}
      onMouseMove={!isMobile ? showControlsTemporarily : undefined}
      onMouseLeave={() => !isMobile && setShowControls(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleVideoClick}
    >
      {/* Video Container */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto object-contain transition-all duration-500 ${
            isQualityChanging ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'
          }`}
          onPlay={() => {
            console.log("Video play event");
            setIsPlaying(true);
          }}
          onPause={() => {
            console.log("Video pause event");
            setIsPlaying(false);
          }}
          onLoadedMetadata={() => {
            console.log("Video metadata loaded");
            // Ensure subtitle tracks are properly initialized
            const video = videoRef.current;
            if (video) {
              const textTracks = Array.from(video.textTracks);
              console.log('Available text tracks:', textTracks);
              textTracks.forEach(track => {
                console.log(`Track ${track.language}:`, {
                  mode: track.mode,
                  kind: track.kind,
                  label: track.label
                });
              });
            }
          }}
          playsInline
          muted={isMuted}
          tabIndex={0}
          aria-label="Video player"
          preload="auto"
          controls={false}
          crossOrigin="anonymous"
        >
          {masterUrl && (
            <source
              key={masterUrl}
              src={masterUrl}
              type="application/vnd.apple.mpegurl"
            />
          )}
          {/* Add subtitle tracks */}
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
          Sorry, your browser does not support embedded videos. Please try a
          different browser.
        </video>
        
        {/* Seek Indicator */}
        {showSeekIndicator && seekAmount && (
          <SeekIndicator amount={seekAmount} />
        )}

        {/* Loading Overlay */}
        {(isBuffering || isQualityChanging) && (
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="relative">
              {/* Background blur */}
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-full" />
              
              {/* Loading spinner */}
              <div className="w-16 h-16 border-4 border-white/30 border-t-cinewave-red rounded-full animate-spin" />
            </div>
          </div>
        )}
      </div>

      {showControls && (
        <div 
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-[10000] video-controls"
          onClick={handleControlClick}
        >
          {/* Title Bar */}
          <div 
            className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-[10000]"
            onClick={handleControlClick}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBack(e);
                }}
                className="text-white hover:text-cinewave-red transition-colors duration-200 cursor-pointer p-2 rounded-full hover:bg-black/20"
                aria-label="Go back"
              >
                <ArrowLeft size={24} />
              </button>

              <div className="text-white">
                <h2 className="text-xl font-bold">{title}</h2>
                {episodeInfo && (
                  <p className="text-sm opacity-90">
                    S{episodeInfo.season} E{episodeInfo.episode} •{" "}
                    {episodeInfo.title}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Center Play/Pause Button */}
          <div 
            className="absolute inset-0 flex items-center justify-center gap-x-12"
            onClick={handleControlClick}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                seek(-10);
              }}
              className="relative text-white hover:text-cinewave-red transition"
              aria-label="Rewind 10 seconds"
            >
              <RotateCcw size={isMobile ? 48 : 36} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                10
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="text-white transform hover:scale-110 transition"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={isMobile ? 64 : 48} /> : <Play size={isMobile ? 64 : 48} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                seek(10);
              }}
              className="relative text-white hover:text-cinewave-red transition"
              aria-label="Forward 10 seconds"
            >
              <RotateCw size={isMobile ? 48 : 36} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                10
              </span>
            </button>
          </div>

          {/* Bottom Controls */}
          <div 
            className="absolute bottom-0 left-0 right-0 p-4"
            onClick={handleControlClick}
          >
            {/* Progress Bar */}
            <div className="relative mb-2">
              <div
                ref={progressRef}
                className={`w-full ${isMobile ? 'h-4' : 'h-3'} bg-gray-600/50 cursor-pointer group relative rounded-full overflow-visible`}
                onMouseDown={handleProgressMouseDown}
                onTouchStart={handleProgressTouchStart}
                style={{ touchAction: "none" }}
              >
                {/* Progress Background */}
                <div className="absolute inset-0 bg-gray-600/30 group-hover:bg-gray-600/40 transition-colors rounded-full" />
                
                {/* Progress Fill */}
                <div
                  className="h-full bg-cinewave-red relative group-hover:h-full transition-all duration-150 ease-out rounded-full"
                  style={{
                    width: `${((dragProgress !== null ? dragProgress : currentTime) / duration) * 100}%`,
                  }}
                />

                {/* Progress Ball (Always visible) */}
                <div 
                  className="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-lg transform scale-100 group-hover:scale-110 transition-transform duration-150 z-10"
                  style={{
                    left: `${((dragProgress !== null ? dragProgress : currentTime) / duration) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
            </div>

            {/* Control Buttons */}
            <div 
              className="flex items-center justify-between px-1"
              onClick={handleControlClick}
            >
              {/* Left side controls */}
              <div className="flex items-center gap-4">
                {/* Volume Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="text-white hover:text-cinewave-red transition p-2"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX size={isMobile ? 28 : 24} /> : <Volume2 size={isMobile ? 28 : 24} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume * 100}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleVolumeChange(parseInt(e.target.value));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`${isMobile ? 'w-32' : 'w-24'}`}
                    aria-label="Volume"
                  />
                </div>

                {/* Time Display */}
                <div className="flex items-center gap-1 text-white text-sm">
                  <span className="font-medium">{formatTime(currentTime)}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-400">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right side controls */}
              <div className="flex items-center gap-4">
                {/* Subtitle Button - Always show when subtitles are available */}
                {Object.keys(subtitleUrls).length > 0 && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSubtitleMenu(!showSubtitleMenu);
                        setShowSubtitleSettings(false); // Close settings when opening menu
                      }}
                      className="p-2 text-white hover:text-cinewave-red transition subtitle-button"
                      title="Subtitles"
                    >
                      <Subtitles size={20} />
                    </button>
                    
                    {/* Subtitle Menu */}
                    {showSubtitleMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-black/90 rounded-lg shadow-lg p-2 min-w-[150px] z-[10002]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubtitleTrackChange('off');
                            setShowSubtitleMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-white/10 ${
                            currentSubtitleTrack === 'off' ? 'text-cinewave-red' : 'text-white'
                          }`}
                        >
                          Off
                        </button>
                        {Object.entries(subtitleUrls).map(([lang, url]) => (
                          <button
                            key={lang}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubtitleTrackChange(lang);
                              setShowSubtitleMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-white/10 ${
                              currentSubtitleTrack === lang ? 'text-cinewave-red' : 'text-white'
                            }`}
                          >
                            {lang === 'en' ? 'English' :
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
                          </button>
                        ))}
                        <div className="border-t border-white/10 my-2" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSubtitleSettings(!showSubtitleSettings);
                            setShowSubtitleMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/10 text-white"
                        >
                          Settings
                        </button>
                      </div>
                    )}
                    
                    {/* Subtitle Settings */}
                    {showSubtitleSettings && MemoizedSubtitleSettings}
                  </div>
                )}

                {/* Audio Track Selector - Only show in landscape mode */}
                {audioTracks.length > 1 && isLandscape && (
                  <div className="relative z-[10002]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAudioMenu(!showAudioMenu);
                      }}
                      className={`text-white hover:text-cinewave-red transition flex items-center gap-1 p-2 ${
                        isQualityChanging ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={isQualityChanging}
                      aria-label="Audio track settings"
                    >
                      <Headphones size={20} />
                      <span className="text-sm">
                        {audioTracks.find(track => track.id === currentAudioTrack)?.label || 
                         (audioTracks.length > 0 ? audioTracks[0].label : 'Audio')}
                      </span>
                    </button>
                    {showAudioMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-md overflow-hidden shadow-lg">
                        {audioTracks.map((track) => (
                          <button
                            key={track.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAudioTrackChange(track.id);
                            }}
                            disabled={isQualityChanging}
                            className={`block w-full px-4 py-2 text-sm text-left hover:bg-cinewave-red transition ${
                              currentAudioTrack === track.id ? "bg-cinewave-red" : ""
                            } ${isQualityChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {track.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quality Selector - Only show in landscape mode */}
                {availableQualities.length > 1 && isLandscape && (
                  <div className="relative z-[10002]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQualityMenu(!showQualityMenu);
                      }}
                      className={`text-white hover:text-cinewave-red transition flex items-center gap-1 p-2 ${
                        isQualityChanging ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={isQualityChanging}
                      aria-label="Video quality settings"
                    >
                      <Settings size={20} />
                      <span className="text-sm">
                        {getQualityDisplayText()}
                      </span>
                    </button>
                    {showQualityMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-md overflow-hidden shadow-lg">
                        {availableQualities.map((quality) => (
                          <button
                            key={quality.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQualityChange(quality.value);
                            }}
                            disabled={isQualityChanging}
                            className={`block w-full px-4 py-2 text-sm text-left hover:bg-cinewave-red transition ${
                              currentQuality === quality.value ? "bg-cinewave-red" : ""
                            } ${isQualityChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {quality.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Episode Navigation - Only show in landscape mode */}
                {isLandscape && episodes &&
                  episodes.length > 0 &&
                  typeof currentEpisodeIndex === "number" &&
                  onChangeEpisode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeEpisode(currentEpisodeIndex - 1);
                        }}
                        disabled={currentEpisodeIndex === 0}
                        className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeEpisode(currentEpisodeIndex + 1);
                        }}
                        disabled={currentEpisodeIndex === episodes.length - 1}
                        className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}

                {/* Fullscreen Toggle - Always show */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                  }}
                  className="text-white hover:text-cinewave-red transition p-2"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;

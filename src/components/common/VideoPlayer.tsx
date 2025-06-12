import { useState, useEffect, useRef, useCallback } from "react";
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
}

// Add audio track interface
interface AudioTrack {
  id: string;
  label: string;
  language: string;
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
      const currentAudioTrackId = currentAudioTrack; // Save current audio track
      
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

          // Add buffer monitoring
          hls.on(Hls.Events.BUFFER_CREATED, () => {
            console.log("Buffer created");
          });

          hls.on(Hls.Events.BUFFER_APPENDED, () => {
            console.log("Buffer appended");
          });

          hls.on(Hls.Events.BUFFER_FLUSHED, () => {
            console.log("Buffer flushed");
          });

          // Add quality level monitoring
          hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log(`Switched to quality level: ${data.level}`);
          });

          // Add bandwidth monitoring
          hls.on(Hls.Events.BANDWIDTH_ESTIMATE, (event, data) => {
            console.log(`Bandwidth estimate: ${data.bandwidth} bps`);
          });

          // Fix HLS event types
          interface HlsEventData {
            level?: number;
            bandwidth?: number;
          }

          // Add proper event types for monitoring
          hls.on(Hls.Events.LEVEL_LOADED, (event: Event, data: HlsEventData) => {
            console.log(`Level loaded: ${data.level}`);
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
              // Only set initial quality to AUTO on first manifest parse
              if (!initialQualitySet.current) {
                hls.currentLevel = -1;
                setCurrentQuality("-1");
                initialQualitySet.current = true;
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
      
      // Change quality with a slight delay to allow for smooth transition
      qualityChangeTimeoutRef.current = setTimeout(() => {
        try {
          hlsInstance.currentLevel = parseInt(quality);
    setCurrentQuality(quality);
    setShowQualityMenu(false);
    
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
      }, 100);
    } catch (error) {
      console.error('Error initiating quality change:', error);
      setIsQualityChanging(false);
    }
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (isPlaying) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowQualityMenu(false);
      }, 3000);
    }
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
    showControlsTemporarily();
  };

  // Add tap handlers
  const handleTap = useCallback((e: React.TouchEvent) => {
    const currentTime = Date.now();
    const touch = e.touches[0];
    
    // Check for double tap
    if (currentTime - lastTapTime < 300 && lastTapPosition) {
      const screenWidth = window.innerWidth;
      const tapX = touch.clientX;
      
      // Determine if tap is on left or right side
      if (tapX < screenWidth / 2) {
        seek(-10); // Seek backward
        setShowSeekIndicator(true);
        setTimeout(() => setShowSeekIndicator(false), 1000);
      } else {
        seek(10); // Seek forward
        setShowSeekIndicator(true);
        setTimeout(() => setShowSeekIndicator(false), 1000);
      }
    } else {
      // Single tap - toggle controls
      setShowControls(prev => !prev);
      setShowQualityMenu(false);
      setShowAudioMenu(false);
    }
    
    setLastTapTime(currentTime);
    setLastTapPosition({ x: touch.clientX, y: touch.clientY });
  }, [lastTapTime, lastTapPosition]);

  // Add touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    handleTap(e);
  }, [handleTap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY || !touchStartTime) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      const seekTime = Math.round((deltaX / window.innerWidth) * 30); // More precise seeking
      setSeekAmount(seekTime);
      setShowSeekIndicator(true);
      e.preventDefault();
    }
  }, [touchStartX, touchStartY, touchStartTime]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY || !touchStartTime) return;

    // Handle seek
    if (seekAmount) {
      seek(seekAmount);
      setShowSeekIndicator(false);
    }

    setTouchStartX(null);
    setTouchStartY(null);
    setTouchStartTime(null);
    setSeekAmount(null);
  }, [touchStartX, touchStartY, touchStartTime, seekAmount]);

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

  // Double Tap and Draggable Seekbar Enhancements
  // --- Draggable Seekbar (Improved, YouTube-like) ---
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  useEffect(() => {
    dragProgressRef.current = dragProgress;
  }, [dragProgress]);

  // Mouse events
  const handleDocumentMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = Math.max(0, Math.min(duration, percent * duration));
      setDragProgress(newTime);
      setShowControls(true);
    },
    [duration]
  );

  const handleDocumentMouseUp = useCallback(() => {
    setTimeout(() => setShowControls(false), 2000);
    setTimeout(() => setShowQualityMenu(false), 2000);
    
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
    
    // Clean up event listeners
    window.removeEventListener("mousemove", handleDocumentMouseMove);
    window.removeEventListener("mouseup", handleDocumentMouseUp);
  }, [handleDocumentMouseMove, currentTime, hlsInstance]);

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    setDragProgress(null);
    updateSeekFromEvent(e);
    setShowControls(true);
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleDocumentMouseMove);
    window.addEventListener("mouseup", handleDocumentMouseUp);
  };

  // Touch events
  const handleDocumentTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!progressRef.current) return;
      const touch = e.touches[0];
      const rect = progressRef.current.getBoundingClientRect();
      const percent = (touch.clientX - rect.left) / rect.width;
      const newTime = Math.max(0, Math.min(duration, percent * duration));
      setDragProgress(newTime);
      setShowControls(true);
    },
    [duration]
  );

  const handleDocumentTouchEnd = useCallback(() => {
    setTimeout(() => setShowControls(false), 2000);
    setTimeout(() => setShowQualityMenu(false), 2000);
    
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
    
    // Clean up event listeners
    window.removeEventListener("touchmove", handleDocumentTouchMove);
    window.removeEventListener("touchend", handleDocumentTouchEnd);
  }, [handleDocumentTouchMove, currentTime, hlsInstance]);

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    setDragProgress(null);
    updateSeekFromTouchEvent(e);
    setShowControls(true);
    document.body.style.userSelect = "none";
    window.addEventListener("touchmove", handleDocumentTouchMove);
    window.addEventListener("touchend", handleDocumentTouchEnd);
  };
  const updateSeekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    setDragProgress(newTime);
  };
  const updateSeekFromTouchEvent = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const touch = e.touches[0];
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (touch.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    setDragProgress(newTime);
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
    if (e.target === containerRef.current) {
      // Only toggle controls visibility, don't trigger play/pause
      setShowControls(prev => !prev);
      setShowQualityMenu(false);
      setShowAudioMenu(false);
    }
  }, []);

  // Add touch handler for controls with improved handling
  const handleVideoTouch = useCallback((e: React.TouchEvent) => {
    if (e.target === containerRef.current) {
      e.preventDefault(); // Prevent default touch behavior
      // Only toggle controls visibility, don't trigger play/pause
      setShowControls(prev => !prev);
      setShowQualityMenu(false);
      setShowAudioMenu(false);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black w-full h-full ${
        isFullscreen ? "fixed inset-0 z-[9999]" : ""
      }`}
      onMouseMove={!isMobile ? showControlsTemporarily : undefined}
      onMouseLeave={() => !isMobile && setShowControls(false)}
      onTouchStart={handleVideoTouch}
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
          onError={(e) => {
            console.error("Video error:", e);
            const video = e.target as HTMLVideoElement;
            if (video.error) {
              console.error("Video error details:", {
                code: video.error.code,
                message: video.error.message,
              });
            }
            // Try to reload with a different quality if HLS is available
            if (availableQualities.length > 1) {
              const currentQualityIndex = availableQualities.findIndex(
                (q) => q.value === currentQuality
              );
              if (currentQualityIndex !== -1) {
                const nextQualityIndex =
                  (currentQualityIndex + 1) % availableQualities.length;
                const nextQuality = availableQualities[nextQualityIndex].value;
                console.log(
                  `Video error - trying next quality: ${nextQuality}`
                );
                setCurrentQuality(nextQuality);
              }
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
              onError={(e) => {
                const target = e.target as HTMLSourceElement;
                const videoElement = target.parentElement as HTMLVideoElement;

                console.error("Video source error:", {
                  src: target.src,
                  networkState: videoElement.networkState,
                  errorState: videoElement.error,
                });
              }}
              onLoadStart={() => console.log("Video source loading started")}
              onLoadedData={() => {
                console.log("Video source loaded data");
                if (videoRef.current) {
                  // Add a small delay to ensure the video is ready to play
                  setTimeout(() => {
                    videoRef.current?.play().catch((e) => {
                      console.error("Error playing video:", e);
                      // Only log the error, don't display it
                    });
                  }, 100);
                }
              }}
            />
          )}
          <track kind="captions" />
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-[10000]">
          {/* Title Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-[10000]">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
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

          {/* Center Play/Pause Button - Larger on mobile */}
          <div className="absolute inset-0 flex items-center justify-center gap-x-12">
            <button
              onClick={() => seek(-10)}
              className="relative text-white hover:text-cinewave-red transition"
              aria-label="Rewind 10 seconds"
            >
              <RotateCcw size={isMobile ? 48 : 36} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                10
              </span>
            </button>
            <button
              onClick={togglePlay}
              className="text-white transform hover:scale-110 transition"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={isMobile ? 64 : 48} /> : <Play size={isMobile ? 64 : 48} />}
            </button>
            <button
              onClick={() => seek(10)}
              className="relative text-white hover:text-cinewave-red transition"
              aria-label="Forward 10 seconds"
            >
              <RotateCw size={isMobile ? 48 : 36} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                10
              </span>
            </button>
          </div>

          {/* Bottom Controls - Mobile Optimized */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Progress Bar - Reduced margin */}
            <div className="relative mb-2">
            <div
              ref={progressRef}
                className={`w-full ${isMobile ? 'h-2' : 'h-1.5'} bg-gray-600/50 cursor-pointer group relative rounded-full overflow-hidden`}
              onMouseDown={handleProgressMouseDown}
              onTouchStart={handleProgressTouchStart}
                onMouseMove={handleProgressHover}
                onMouseLeave={() => {
                  setHoverPosition(null);
                }}
              style={{ touchAction: "none" }}
            >
                {/* Progress Background */}
                <div className="absolute inset-0 bg-gray-600/30 group-hover:bg-gray-600/40 transition-colors" />
                
                {/* Progress Fill */}
                <div
                  className="h-full bg-cinewave-red relative group-hover:h-2 transition-all duration-150 ease-out"
                  style={{
                    width: `${((dragProgress !== null ? dragProgress : currentTime) / duration) * 100}%`,
                  }}
                >
                  {/* Progress Handle */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-cinewave-red rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg transform scale-100 group-hover:scale-110" />
                </div>
              </div>
            </div>

            {/* Control Buttons - Adjusted padding */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleMute}
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
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  className={`${isMobile ? 'w-32' : 'w-24'}`}
                  aria-label="Volume"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-1 text-white text-sm">
                  <span className="font-medium">{formatTime(currentTime)}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-400">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Audio Track Selector - Hidden in portrait mode on mobile */}
                {audioTracks.length > 1 && (!isMobile || !isPortrait) && (
                  <div className="relative z-[10002]">
                    <button
                      onClick={() => setShowAudioMenu(!showAudioMenu)}
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
                            onClick={() => handleAudioTrackChange(track.id)}
                            disabled={isQualityChanging}
                            className={`block w-full px-4 py-2 text-sm text-left hover:bg-cinewave-red transition ${
                              currentAudioTrack === track.id ? "bg-cinewave-red" : ""
                            } ${isQualityChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {track.label} {track.language !== 'unknown' ? `(${track.language})` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quality Selector - Hidden in portrait mode on mobile */}
                {availableQualities.length > 1 && (!isMobile || !isPortrait) && (
                  <div className="relative z-[10002]">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className={`text-white hover:text-cinewave-red transition flex items-center gap-1 p-2 ${
                        isQualityChanging ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={isQualityChanging}
                      aria-label="Video quality settings"
                    >
                      <Settings size={20} />
                      <span className="text-sm">
                        {currentQuality === "-1"
                          ? "AUTO"
                          : availableQualities.find(q => q.value === currentQuality)?.label || currentQuality.toUpperCase()}
                      </span>
                    </button>

                    {showQualityMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-md overflow-hidden shadow-lg">
                        {availableQualities.map((quality) => (
                          <button
                            key={quality.value}
                            onClick={() => handleQualityChange(quality.value)}
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

                {/* Episode Navigation */}
                {episodes &&
                  episodes.length > 0 &&
                  typeof currentEpisodeIndex === "number" &&
                  onChangeEpisode && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => onChangeEpisode(currentEpisodeIndex - 1)}
                        disabled={currentEpisodeIndex === 0}
                        className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => onChangeEpisode(currentEpisodeIndex + 1)}
                        disabled={currentEpisodeIndex === episodes.length - 1}
                        className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}

                {/* Fullscreen Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="text-white hover:text-cinewave-red transition z-[10002] relative ml-4 p-2"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize size={24} />
                  ) : (
                    <Maximize size={24} />
                  )}
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

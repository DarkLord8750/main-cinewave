import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, Settings, ArrowLeft, Maximize, Minimize, RotateCcw, RotateCw } from 'lucide-react';
import { useWatchHistoryStore } from '../../stores/watchHistoryStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';

interface VideoQuality {
  label: string;
  value: string;
}

interface VideoPlayerProps {
  title: string;
  description: string;
  videoUrls: {
    '480p'?: string;
    '720p'?: string;
    '1080p'?: string;
    '4k'?: string;
  };
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

const VideoPlayer = ({
  title,
  videoUrls,
  contentId,
  onClose,
  autoPlay = true,
  isFullScreen = false,
  episodeInfo,
  episodes,
  currentEpisodeIndex,
  onChangeEpisode,
  startTime
}: VideoPlayerProps) => {
  // Navigation and State Management
  const navigate = useNavigate();
  const { currentProfile } = useAuthStore();
  const { updateWatchTime } = useWatchHistoryStore();
  const { setIsVideoPlaying } = useUIStore();

  // Add effect to manage video playing state
  useEffect(() => {
    setIsVideoPlaying(true);
    return () => {
      setIsVideoPlaying(false);
    };
  }, [setIsVideoPlaying]);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(isFullScreen);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>('720p');
  const [isMobile] = useState(window.innerWidth <= 768);
  const [isBuffering, setIsBuffering] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  // Add this state to store the last watched time
  const [lastWatchedTime, setLastWatchedTime] = useState<number | null>(null);

  // Touch state
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [seekAmount, setSeekAmount] = useState<number | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const watchTimeUpdateRef = useRef<NodeJS.Timeout>();
  const dragProgressRef = useRef<number | null>(null);

  // Available video qualities
  const availableQualities: VideoQuality[] = Object.entries(videoUrls)
    .filter(([_, url]) => url)
    .map(([quality]) => ({
      label: quality === '4k' ? '4K' : quality.toUpperCase(),
      value: quality
    }))
    .sort((a, b) => {
      const qualityOrder = { '480p': 1, '720p': 2, '1080p': 3, '4k': 4 };
      return qualityOrder[a.value as keyof typeof qualityOrder] - qualityOrder[b.value as keyof typeof qualityOrder];
    });

  // Initialize with best available quality (prefer 720p if available)
  useEffect(() => {
    if (availableQualities.length > 0) {
      const has720p = availableQualities.find(q => q.value === '720p');
      if (has720p) {
        setCurrentQuality('720p');
      } else {
        const bestQuality = availableQualities[availableQualities.length - 1].value;
        setCurrentQuality(bestQuality);
      }
    }
  }, []);

  // Handle autoplay
  useEffect(() => {
    if (autoPlay && videoRef.current && !userPaused) {
      videoRef.current.play();
    }
  }, [autoPlay, videoUrls, currentQuality, userPaused]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (watchTimeUpdateRef.current) {
        clearTimeout(watchTimeUpdateRef.current);
      }
      watchTimeUpdateRef.current = setTimeout(() => {
        if (currentProfile?.id) {
          const completed = video.currentTime >= video.duration * 0.9;
          updateWatchTime(currentProfile.id, contentId, Math.floor(video.currentTime), completed);
        }
      }, 10000);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (currentProfile?.id) {
        updateWatchTime(currentProfile.id, contentId, Math.floor(video.duration), true);
      }
      if (typeof currentEpisodeIndex === 'number' && onChangeEpisode && currentEpisodeIndex < (episodes?.length || 0) - 1) {
        onChangeEpisode(currentEpisodeIndex + 1);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleCanPlay = () => setIsBuffering(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      if (watchTimeUpdateRef.current) {
        clearTimeout(watchTimeUpdateRef.current);
      }
    };
  }, [contentId, updateWatchTime, currentProfile?.id, currentEpisodeIndex, episodes?.length, onChangeEpisode]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Fetch last watched time on mount/contentId change
  useEffect(() => {
    let isMounted = true;
    async function fetchLastWatched() {
      if (currentProfile?.id && contentId) {
        if (typeof useWatchHistoryStore.getState === 'function') {
          const getWatchTime = useWatchHistoryStore.getState().getWatchTime;
          if (typeof getWatchTime === 'function') {async function fetchLastWatched() {
            if (currentProfile?.id && contentId) {
              if (typeof useWatchHistoryStore.getState === 'function') {
                const getWatchTime = useWatchHistoryStore.getState().getWatchTime;
                const updateWatchTime = useWatchHistoryStore.getState().updateWatchTime;
                if (typeof getWatchTime === 'function' && typeof updateWatchTime === 'function') {
                  try {
                    const time = await getWatchTime(currentProfile.id, contentId);
                    if (isMounted && typeof time === 'number' && time > 0) {
                      setLastWatchedTime(time);
                      updateWatchTime(currentProfile.id, contentId, time);
                    }
                  } catch (error) {
                    console.error('Error fetching last watched time:', error);
                  }
                }
              }
            }
          }
            const time = await getWatchTime(currentProfile.id, contentId);
            if (isMounted && typeof time === 'number' && time > 0) {
              setLastWatchedTime(time);
            }
          }
        }
      }
    }
    fetchLastWatched();
    return () => { isMounted = false; };
  }, [currentProfile?.id, contentId]);

  // Set initial playback position if startTime or lastWatchedTime is provided, but only after metadata is loaded
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setTime = () => {
      if (typeof startTime === 'number' && startTime > 0) {
        video.currentTime = startTime;
      } else if (typeof lastWatchedTime === 'number' && lastWatchedTime > 0) {
        video.currentTime = lastWatchedTime;
      }
    };
    video.addEventListener('loadedmetadata', setTime, { once: true });
    // If already loaded
    if (video.readyState >= 1) setTime();
    return () => video.removeEventListener('loadedmetadata', setTime);
  }, [startTime, lastWatchedTime, videoUrls, currentQuality]);

  // Cross-browser fullscreen helpers
  const requestFullscreen = (element: HTMLElement) => {
    if (element.requestFullscreen) return element.requestFullscreen();
    // @ts-ignore
    if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
    // @ts-ignore
    if (element.mozRequestFullScreen) return element.mozRequestFullScreen();
    // @ts-ignore
    if (element.msRequestFullscreen) return element.msRequestFullscreen();
  };
  const exitFullscreen = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    // @ts-ignore
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    // @ts-ignore
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    // @ts-ignore
    if (document.msExitFullscreen) return document.msExitFullscreen();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement &&
          // @ts-ignore
          !document.webkitFullscreenElement &&
          // @ts-ignore
          !document.mozFullScreenElement &&
          // @ts-ignore
          !document.msFullscreenElement) {
        await requestFullscreen(containerRef.current);
      } else {
        await exitFullscreen();
      }
      setIsFullscreen(!isFullscreen);
    } catch (error) {
      console.error('Error attempting to toggle fullscreen:', error);
    }
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
    if (!videoRef.current) return;

    const currentTime = videoRef.current.currentTime;
    const wasPlaying = !videoRef.current.paused;

    setCurrentQuality(quality);

    videoRef.current.addEventListener('loadeddata', () => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        if (wasPlaying) {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => setIsPlaying(false));
          }
        }
      }
    }, { once: true });

    setShowQualityMenu(false);
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
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
      console.error('Error handling back navigation:', error);
      if (onClose) {
        onClose();
      } else {
        navigate(-1);
      }
    }
  };

  const seek = (seconds: number) => {
    if (!videoRef.current || !duration || isNaN(duration) || duration === 0) return;
    let newTime = videoRef.current.currentTime + seconds;
    newTime = Math.max(0, Math.min(newTime, duration));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    showControlsTemporarily();
  };

  // Mobile touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setTouchStartTime(Date.now());
    showControlsTemporarily();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY || !touchStartTime) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      const seekTime = Math.round((deltaX / window.innerWidth) * 60);
      setSeekAmount(seekTime);
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY || !touchStartTime) return;

    const touchEndTime = Date.now();
    const timeDiff = touchEndTime - touchStartTime;

    // Handle double tap
    if (timeDiff < 300) {
      const currentTime = Date.now();
      if (currentTime - lastTapTime < 300) {
        toggleFullscreen();
        e.preventDefault();
      }
      setLastTapTime(currentTime);
    }

    // Handle seek
    if (seekAmount) {
      seek(seekAmount);
    }

    setTouchStartX(null);
    setTouchStartY(null);
    setTouchStartTime(null);
    setSeekAmount(null);
  };

  // Keyboard and Accessibility Enhancements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowright':
          seek(5);
          break;
        case 'arrowleft':
          seek(-5);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'arrowup':
          handleVolumeChange(Math.min(100, (isMuted ? 0 : volume * 100) + 5));
          break;
        case 'arrowdown':
          handleVolumeChange(Math.max(0, (isMuted ? 0 : volume * 100) - 5));
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMuted, volume, isPlaying]);

  // Double Tap and Draggable Seekbar Enhancements
  // --- Draggable Seekbar (Improved, YouTube-like) ---
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  useEffect(() => {
    dragProgressRef.current = dragProgress;
  }, [dragProgress]);

  // Mouse events
  const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    setDragProgress(newTime);
    setShowControls(true);
  }, [duration]);

  const handleDocumentMouseUp = useCallback(() => {
    setTimeout(() => setShowControls(false), 2000);
    setTimeout(() => setShowQualityMenu(false), 2000);
    setCurrentTime((prev) => {
      const seekTime = dragProgressRef.current !== null ? dragProgressRef.current : prev;
      if (videoRef.current) {
        videoRef.current.currentTime = seekTime;
      }
      return seekTime;
    });
    setDragProgress(null);
    window.removeEventListener('mousemove', handleDocumentMouseMove);
    window.removeEventListener('mouseup', handleDocumentMouseUp);
  }, [handleDocumentMouseMove]);

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    setDragProgress(null);
    updateSeekFromEvent(e);
    setShowControls(true);
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleDocumentMouseMove);
    window.addEventListener('mouseup', handleDocumentMouseUp);
  };

  // Touch events
  const handleDocumentTouchMove = useCallback((e: TouchEvent) => {
    if (!progressRef.current) return;
    const touch = e.touches[0];
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (touch.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    setDragProgress(newTime);
    setShowControls(true);
  }, [duration]);

  const handleDocumentTouchEnd = useCallback(() => {
    setTimeout(() => setShowControls(false), 2000);
    setTimeout(() => setShowQualityMenu(false), 2000);
    setCurrentTime((prev) => {
      const seekTime = dragProgressRef.current !== null ? dragProgressRef.current : prev;
      if (videoRef.current) {
        videoRef.current.currentTime = seekTime;
      }
      return seekTime;
    });
    setDragProgress(null);
    window.removeEventListener('touchmove', handleDocumentTouchMove);
    window.removeEventListener('touchend', handleDocumentTouchEnd);
  }, [handleDocumentTouchMove]);

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    setDragProgress(null);
    updateSeekFromTouchEvent(e);
    setShowControls(true);
    document.body.style.userSelect = 'none';
    window.addEventListener('touchmove', handleDocumentTouchMove);
    window.addEventListener('touchend', handleDocumentTouchEnd);
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

  return (
    <div
      ref={containerRef}
      className={`relative bg-black w-full h-full ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}
      onMouseMove={!isMobile ? showControlsTemporarily : undefined}
      onMouseLeave={() => !isMobile && setShowControls(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={toggleFullscreen}
      // Hide controls on single click/tap on the screen (not on controls)
      onClick={(e) => {
        // Only hide if controls are visible and click is not on a button or input
        if (showControls && e.target === containerRef.current) {
          setShowControls(false);
          setShowQualityMenu(false);
        }
      }}
    >
      {/* Video Container */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={videoUrls[currentQuality as keyof typeof videoUrls]}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto object-contain"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
          muted={isMuted} // Always use isMuted state
          tabIndex={0}
          aria-label="Video player"
          preload="auto"
          controls={false}
        >
          <track kind="captions" />
          Sorry, your browser does not support embedded videos. Please try a different browser.
        </video>
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="w-12 h-12 border-4 border-white border-t-cinewave-red rounded-full animate-spin" />
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
                    S{episodeInfo.season} E{episodeInfo.episode} • {episodeInfo.title}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Center Play/Pause Button */}
          <div className="absolute inset-0 flex items-center justify-center gap-x-12">
            <button
              onClick={() => seek(-10)}
              className="relative text-white hover:text-cinewave-red transition"
              aria-label="Rewind 10 seconds"
            >
              <RotateCcw size={36} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">10</span>
            </button>
            <button
              onClick={togglePlay}
              className="text-white transform hover:scale-110 transition"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={48} /> : <Play size={48} />}
            </button>
            <button
              onClick={() => seek(10)}
              className="relative text-white hover:text-cinewave-red transition"
              aria-label="Forward 10 seconds"
            >
              <RotateCw size={36} />
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">10</span>
            </button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Progress Bar */}
            <div
              ref={progressRef}
              className="w-full h-1 bg-gray-600 mb-4 cursor-pointer group relative"
              onMouseDown={handleProgressMouseDown}
              onTouchStart={handleProgressTouchStart}
              style={{ touchAction: 'none' }}
            >
              <div
                className="h-full bg-cinewave-red relative group-hover:h-2 transition-all"
                style={{ width: `${((dragProgress !== null ? dragProgress : currentTime) / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-cinewave-red rounded-full opacity-0 group-hover:opacity-100 cursor-pointer" />
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-cinewave-red transition"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume * 100}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  className="w-24"
                  aria-label="Volume"
                  // --- FIX: Prevent touch/mouse events from bubbling to progress bar ---
                  onTouchStart={e => e.stopPropagation()}
                  onTouchMove={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                />
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Quality Selector */}
                {availableQualities.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="text-white hover:text-cinewave-red transition flex items-center gap-1"
                      aria-label="Video quality settings"
                    >
                      <Settings size={20} />
                      <span className="text-sm">{currentQuality === '4k' ? '4K' : currentQuality.toUpperCase()}</span>
                    </button>

                    {showQualityMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-md overflow-hidden">
                        {availableQualities.map((quality) => (
                          <button
                            key={quality.value}
                            onClick={() => handleQualityChange(quality.value)}
                            className={`block w-full px-4 py-2 text-sm text-left hover:bg-cinewave-red transition ${
                              currentQuality === quality.value ? 'bg-cinewave-red' : ''
                            }`}
                          >
                            {quality.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Episode Navigation */}
                {episodes && episodes.length > 0 && typeof currentEpisodeIndex === 'number' && onChangeEpisode && (
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
                  className="text-white hover:text-cinewave-red transition"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
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

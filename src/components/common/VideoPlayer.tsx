import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, Settings, ArrowLeft, Maximize, Minimize, ChevronLeft, ChevronRight, RotateCcw, RotateCw } from 'lucide-react';
import { useWatchHistoryStore } from '../../stores/watchHistoryStore';
import { useAuthStore } from '../../stores/authStore';

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
  description,
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

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const watchTimeUpdateRef = useRef<NodeJS.Timeout>();

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

  // Initialize with best available quality
  useEffect(() => {
    if (availableQualities.length > 0) {
      const bestQuality = availableQualities[availableQualities.length - 1].value;
      setCurrentQuality(bestQuality);
    }
  }, []);

  // Handle autoplay
  useEffect(() => {
    if (autoPlay && videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  }, [autoPlay, videoUrls, currentQuality]);

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
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      if (watchTimeUpdateRef.current) {
        clearTimeout(watchTimeUpdateRef.current);
      }
    };
  }, [contentId, updateWatchTime, currentProfile?.id]);

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

  // Set initial playback position if startTime is provided
  useEffect(() => {
    if (videoRef.current && typeof startTime === 'number' && startTime > 0) {
      videoRef.current.currentTime = startTime;
    }
  }, [startTime, videoUrls, currentQuality]);

  // Player Controls
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (value: number) => {
    if (!videoRef.current) return;
    
    const newVolume = value / 100;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    
    if (isMuted) {
      videoRef.current.volume = volume;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
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

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Error attempting to toggle fullscreen:', error);
    }
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    
    if (isPlaying) {
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
    e.stopPropagation(); // Prevent event from bubbling to video click handler
    
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
      // Fallback to navigation even if fullscreen exit fails
      if (onClose) {
        onClose();
      } else {
        navigate(-1);
      }
    }
  };

  // Add handlers for 10s forward/backward
  const seek = (seconds: number) => {
    if (!videoRef.current) return;
    let newTime = videoRef.current.currentTime + seconds;
    newTime = Math.max(0, Math.min(newTime, duration));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black w-full h-full ${
        isFullscreen ? 'fixed inset-0 z-[9999]' : ''
      }`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => setShowControls(false)}
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
        />
      </div>

      {/* Title Bar */}
      {showControls && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-[10001]">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="text-white hover:text-cinewave-red transition-colors duration-200 cursor-pointer p-2 rounded-full hover:bg-black/20 z-[10002]"
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
      )}

      {/* Controls Overlay */}
      {showControls && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-[10000]">
          {/* Center Play/Pause Button */}
          <div className="absolute inset-0 flex items-center justify-center gap-x-6 md:gap-x-12">
            <button
              onClick={() => seek(-10)}
              className="relative text-white hover:text-cinewave-red transition px-2"
              aria-label="Rewind 10 seconds"
            >
              <RotateCcw size={36} className="md:size-[48px]" />
              <span className="absolute inset-0 flex items-center justify-center text-base md:text-lg font-bold text-white pointer-events-none">10</span>
            </button>
            <button
              onClick={togglePlay}
              className="text-white transform hover:scale-110 transition px-2"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={36} className="md:size-[48px]" /> : <Play size={36} className="md:size-[48px]" />}
            </button>
            <button
              onClick={() => seek(10)}
              className="relative text-white hover:text-cinewave-red transition px-2"
              aria-label="Forward 10 seconds"
            >
              <RotateCw size={36} className="md:size-[48px]" />
              <span className="absolute inset-0 flex items-center justify-center text-base md:text-lg font-bold text-white pointer-events-none">10</span>
            </button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Progress Bar */}
            <div 
              ref={progressRef}
              className="w-full h-1 bg-gray-600 mb-4 cursor-pointer group"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-cinewave-red relative group-hover:h-2 transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-cinewave-red rounded-full opacity-0 group-hover:opacity-100" />
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
                  />
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
                {/* Next/Previous Episode Buttons */}
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
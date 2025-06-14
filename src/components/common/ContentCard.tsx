import { useState } from 'react';
import { Play, Plus, Check, ThumbsUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Content, useContentStore } from '../../stores/contentStore';
import { useWatchHistoryStore } from '../../stores/watchHistoryStore';
import { useAuthStore } from '../../stores/authStore';

interface ContentCardProps {
  content: Content & { _watch?: any };
  onPlay?: (content: Content) => void;
  className?: string;
}

const ContentCard = ({ content, onPlay, className }: ContentCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { addToMyList, removeFromMyList, isInMyList } = useContentStore();
  const { history } = useWatchHistoryStore();
  const { currentProfile } = useAuthStore();
  const navigate = useNavigate();
  const inMyList = isInMyList(content.id);

  // Use _watch if present (from Continue Watching row), otherwise fallback to store
  const watchProgress = content._watch
    ? content._watch
    : (currentProfile
    ? history.find(h => h.contentId === content.id && h.profileId === currentProfile.id)
      : null);

  const progressPercentage = watchProgress?.watchTime ? (watchProgress.watchTime / 7200) * 100 : 0;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (content.type === 'series') {
      navigate(`/series/${content.id}`);
    } else {
    navigate(`/movie/${content.id}`);
    }
  };

  const handleMyList = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inMyList) {
      removeFromMyList(content.id);
    } else {
      addToMyList(content.id);
    }
  };

  const handleCardClick = () => {
    if (content.type === 'series') {
      navigate(`/series/${content.id}`);
    } else {
    navigate(`/movie/${content.id}`);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`${className || ''} block relative w-[140px] sm:w-[180px] md:w-[200px] group cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Image Container */}
      <div className="relative h-[200px] sm:h-[250px] md:h-[280px] rounded-lg overflow-hidden">
        <img
          src={content.posterImage}
          alt={content.title}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110 rounded-lg"
        />

        {/* Content Info Overlay - Always Visible */}
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="space-y-1 sm:space-y-2">
            <h3 className="font-medium text-white text-sm sm:text-base line-clamp-1">{content.title}</h3>
            
            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <span className="text-green-500 font-medium">98% Match</span>
              <span className="text-white/70 px-1 py-0.5 border border-white/30">
                {content.maturityRating}
              </span>
            </div>

            <div className="flex flex-wrap gap-1 sm:gap-2 text-xs sm:text-sm text-white/70">
              {content.genre.slice(0, 2).map((genre, index) => (
                <span key={genre}>
                  {genre}
                  {index < Math.min(content.genre.length, 2) - 1 && ' •'}
                </span>
              ))}
            </div>

            {/* Watch Progress */}
            {watchProgress && !watchProgress.completed && (
              <div className="space-y-1">
                <div className="relative h-1 bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-netflix-red rounded-full"
                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-white/70">
                  {content.type === 'series' && watchProgress.episode_number
                    ? `S${watchProgress.season_number || 1} E${watchProgress.episode_number} • ${watchProgress.episode_title || ''}`
                    : ''}
                  {formatTime(watchProgress.watchTime)} remaining
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Hover Actions Overlay */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/20 flex items-end p-2 sm:p-4 z-20 hidden group-hover:flex group-focus:flex">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlay}
                className="bg-white text-black rounded-full p-1.5 hover:bg-white/90 transition-colors"
                aria-label="Play"
              >
                <Play fill="currentColor" size={18} />
              </button>
              
              <button
                onClick={handleMyList}
                className="border border-white/50 text-white rounded-full p-1.5 hover:border-white transition-colors"
                aria-label={inMyList ? "Remove from My List" : "Add to My List"}
              >
                {inMyList ? <Check size={18} /> : <Plus size={18} />}
              </button>
              
              <button
                className="border border-white/50 text-white rounded-full p-1.5 hover:border-white transition-colors"
                aria-label="Like"
              >
                <ThumbsUp size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentCard;

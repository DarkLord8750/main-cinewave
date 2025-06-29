import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContentStore, Content } from '../stores/contentStore';
import { Play, Plus, Check, Download, ChevronDown } from 'lucide-react';
import VideoPlayer from '../components/common/VideoPlayer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuthStore } from '../stores/authStore';
import { useWatchHistoryStore } from '../stores/watchHistoryStore';

const MoviePage = () => {
  const [showVideo, setShowVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [content, setContent] = useState<Content | null>(null);
  const [similarMovies, setSimilarMovies] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showFullCast, setShowFullCast] = useState(false);

  const params = useParams();
  const id = params.id as string | undefined;
  const { currentProfile } = useAuthStore();
  const { fetchHistory, history } = useWatchHistoryStore();
  const { 
    contents, 
    fetchContents, 
    getContentById, 
    getContentsByGenre,
    addToMyList,
    removeFromMyList,
    isInMyList 
  } = useContentStore();
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (contents.length === 0) {
          await fetchContents();
        }
        
        if (id) {
          const movieContent = getContentById(id);
          if (movieContent) {
            // Check if content is actually a movie
            if (movieContent.type !== 'movie') {
              navigate(`/series/${id}`);
              return;
            }
            setContent(movieContent);
            
            // Get similar movies based on genre
            const similar = movieContent.genre
              .map(g => getContentsByGenre(g))
              .flat()
              .filter((c, i, arr) => 
                c.id !== movieContent.id && 
                c.type === 'movie' &&
                arr.findIndex(item => item.id === c.id) === i
              )
              .slice(0, 12);
            setSimilarMovies(similar);

            if (currentProfile?.id) {
              await fetchHistory(currentProfile.id);
            }
          } else {
            navigate('/browse');
          }
        }
      } catch (error) {
        console.error('Error loading content:', error);
        navigate('/browse');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [id, fetchContents, getContentById, contents.length, navigate, fetchHistory, currentProfile?.id]);

  const handlePlay = () => {
    setShowVideo(true);
    setIsFullscreen(true);
  };

  const handleClose = () => {
    console.log('Closing video player');
    // First set fullscreen to false, then hide the video with a slight delay
    setIsFullscreen(false);
    // Use setTimeout to ensure state updates don't conflict
    setTimeout(() => {
      setShowVideo(false);
    }, 100);
  };

  const handleMyList = () => {
    if (!content) return;
    
    if (isInMyList(content.id)) {
      removeFromMyList(content.id);
    } else {
      addToMyList(content.id);
    }
  };

  const getMasterUrls = () => {
    if (!content) return { masterUrl: '' };
    return {
      masterUrl: content.master_url || '',
      masterUrl480p: content.master_url_480p || '',
      masterUrl720p: content.master_url_720p || '',
      masterUrl1080p: content.master_url_1080p || ''
    };
  };

  const getVideoUrls = () => {
    if (!content) return {
      videoUrl: '',
      videoUrl480p: '',
      videoUrl720p: '',
      videoUrl1080p: ''
    };
    return {
      videoUrl: content.videoUrl4k ?? '',
      videoUrl480p: content.videoUrl480p ?? '',
      videoUrl720p: content.videoUrl720p ?? '',
      videoUrl1080p: content.videoUrl1080p ?? ''
    };
  };

  const handleDownload = (quality: string) => {
    if (!content) return;
    
    const urls = getVideoUrls();
    let url = '';
    
    switch (quality) {
      case '1080p':
        url = urls.videoUrl1080p;
        break;
      case '720p':
        url = urls.videoUrl720p;
        break;
      case '480p':
        url = urls.videoUrl480p;
        break;
      case '4K':
        url = urls.videoUrl;
        break;
    }

    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${content.title}_${quality}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading || !content) {
    return <LoadingSpinner />;
  }

  const inMyList = isInMyList(content.id);
  
  // Get watch progress for this content
  const watchProgress = content && currentProfile 
    ? history.find(h => h.contentId === content.id && h.profileId === currentProfile.id)
    : null;
  const startTime = watchProgress?.watchTime || 0;

  // Progress bar logic for movie
  let duration = 0;
  if (content.duration) {
    const durStr = String(content.duration);
    if (durStr.endsWith('m')) {
      duration = parseInt(durStr.replace('m', ''), 10);
    } else {
      duration = parseInt(durStr, 10);
    }
  }
  const durationSeconds = duration * 60;
  const progress = watchProgress?.watchTime || 0;
  const percent = durationSeconds > 0 ? Math.min(100, (progress / durationSeconds) * 100) : 0;
  const remaining = durationSeconds > 0 ? Math.max(0, durationSeconds - progress) : 0;
  const isWatched = watchProgress?.completed || (durationSeconds > 0 && progress >= durationSeconds - 5);

  return (
    <div className="min-h-screen bg-netflix-dark">
      {isFullscreen ? (
        <div className="fixed inset-0 z-50 bg-black">
          <VideoPlayer
            title={content.title}
            description={content.description}
            masterUrl={content.master_url ?? ''}
            contentId={content.id}
            onClose={handleClose}
            isFullScreen={true}
            autoPlay={true}
            startTime={startTime}
            subtitleUrls={content.subtitle_urls}
          />
        </div>
      ) : (
        <div className="min-h-screen bg-netflix-dark">
          {/* Hero Section */}
          <div className="relative w-full h-[60vh] sm:h-[56.25vw] sm:max-h-[80vh]">
            <img 
              src={content.backdropImage} 
              alt={content.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
          </div>

          {/* Content Section */}
          <div className="relative -mt-[20vh] sm:-mt-[150px] px-4 sm:px-8 md:px-12">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              {/* Poster */}
              <div className="hidden md:block w-[300px] flex-shrink-0">
                <div className="relative group">
                <img
                  src={content.posterImage}
                  alt={content.title}
                    className="w-full rounded-md shadow-lg transition-transform duration-300 group-hover:scale-105"
                />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 md:mb-4">
                  {content.title}
                </h1>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 md:mb-6 text-white text-sm sm:text-base">
                  <span>{content.releaseYear}</span>
                  <span className="border px-2 py-0.5 text-sm rounded bg-white/10 backdrop-blur-sm">
                    {content.maturityRating}
                  </span>
                  <span className="px-2 py-0.5 border rounded bg-white/10 backdrop-blur-sm">HD</span>
                  <span className="text-netflix-red font-medium">New</span>
                </div>
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6 w-full">
                  <button
                    onClick={handlePlay}
                    className="group relative flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3 bg-netflix-red hover:bg-red-700 rounded-lg text-white transition-all duration-300 shadow-lg hover:shadow-red-500/30 overflow-hidden text-base sm:text-base"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex items-center gap-2">
                      <Play className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                      <span className="font-medium tracking-wide">Play</span>
                    </div>
                  </button>
                  <button
                    onClick={handleMyList}
                    className="group relative flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-300 border border-white/10 hover:border-white/20 overflow-hidden text-base sm:text-base"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex items-center gap-2">
                      {inMyList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      <span className="font-medium tracking-wide">My List</span>
                    </div>
                  </button>
                  <div className="relative w-full sm:w-auto">
                    <button
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      className="group relative flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-300 border border-white/10 hover:border-white/20 overflow-hidden text-base sm:text-base"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="relative flex items-center gap-2">
                        <Download className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span className="font-medium tracking-wide">Download</span>
                      </div>
                    </button>
                    {showDownloadMenu && (
                      <div className="absolute right-0 mt-2 w-56 bg-[#1f1f1f]/95 rounded-lg shadow-xl z-10 border border-white/10 backdrop-blur-md">
                        <div className="py-1.5">
                          {content.videoUrl1080p && (
                            <button
                              onClick={() => handleDownload('1080p')}
                              className="group w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">1080p</span>
                                <span className="text-xs text-gray-400 group-hover:text-white">Full HD</span>
                              </div>
                              <span className="text-xs text-gray-500 group-hover:text-white">Best Quality</span>
                            </button>
                          )}
                          {content.videoUrl720p && (
                            <button
                              onClick={() => handleDownload('720p')}
                              className="group w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">720p</span>
                                <span className="text-xs text-gray-400 group-hover:text-white">HD</span>
                              </div>
                              <span className="text-xs text-gray-500 group-hover:text-white">Good Quality</span>
                            </button>
                          )}
                          {content.videoUrl480p && (
                            <button
                              onClick={() => handleDownload('480p')}
                              className="group w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">480p</span>
                                <span className="text-xs text-gray-400 group-hover:text-white">SD</span>
                              </div>
                              <span className="text-xs text-gray-500 group-hover:text-white">Standard</span>
                            </button>
                          )}
                          {content.videoUrl4k && (
                            <button
                              onClick={() => handleDownload('4K')}
                              className="group w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">4K</span>
                                <span className="text-xs text-gray-400 group-hover:text-white">Ultra HD</span>
                              </div>
                              <span className="text-xs text-gray-500 group-hover:text-white">Premium</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress Bar & Remaining Time */}
                {duration > 0 && watchProgress && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400"><span>⏱</span><span>{duration}m</span></span>
                      {progress > 0 && !isWatched && durationSeconds > 0 && (
                        <span className="flex items-center gap-1 text-xs text-yellow-400"><span>⏳</span><span>{Math.ceil(remaining / 60)}m left</span></span>
                      )}
                      {isWatched && <span className="flex items-center gap-1 text-xs text-green-500"><span>✔</span><span>Watched</span></span>}
                    </div>
                    {progress > 0 && durationSeconds > 0 && !isWatched && (
                      <div className="relative h-2 w-full min-w-[60px] max-w-[200px] bg-gray-700 rounded-full shadow-inner">
                        <div
                          className="h-2 bg-gradient-to-r from-red-500 to-red-700 rounded-full transition-all duration-500 shadow-lg"
                          style={{ width: `${percent}%` }}
                          title={`${Math.floor((progress / durationSeconds) * 100)}% watched`}
                        />
                      </div>
                    )}
                  </div>
                )}

                <p className="text-white text-sm sm:text-base md:text-lg mb-6 md:mb-8 line-clamp-3 sm:line-clamp-none">
                  {content.description}
                </p>

                {/* Cast & Genres */}
                <div className="space-y-4">
                  {content.cast && content.cast.length > 0 && (
                    <div>
                      <span className="text-netflix-gray">Cast:</span>
                      <div className="text-white mt-2 flex flex-wrap gap-3">
                        {content.cast.slice(0, 3).map(member => (
                          <div key={member.id} className="flex items-center gap-2">
                            {member.photoUrl && (
                              <img
                                src={member.photoUrl}
                                alt={member.name}
                                className="w-7 h-7 rounded-full object-cover ring-2 ring-white/20"
                              />
                            )}
                            <div>
                              <div className="font-medium text-sm">{member.name}</div>
                              <div className="text-netflix-gray text-xs">{member.role}</div>
                            </div>
                          </div>
                        ))}
                        {!showFullCast && content.cast.length > 3 && (
                          <button
                            className="text-netflix-gray text-sm self-center underline hover:text-white transition"
                            onClick={() => setShowFullCast(true)}
                          >
                            +{content.cast.length - 3} more
                          </button>
                        )}
                        {showFullCast && (
                          <>
                            <div className="mt-3 flex flex-wrap gap-3">
                              {content.cast.slice(3).map(member => (
                                <div key={member.id} className="flex items-center gap-2">
                                  {member.photoUrl && (
                                    <img
                                      src={member.photoUrl}
                                      alt={member.name}
                                      className="w-7 h-7 rounded-full object-cover ring-2 ring-white/20"
                                    />
                                  )}
                                  <div>
                                    <div className="font-medium text-sm">{member.name}</div>
                                    <div className="text-netflix-gray text-xs">{member.role}</div>
                                  </div>
                                </div>
                              ))}
                              <button
                                className="text-netflix-gray text-sm self-center underline hover:text-white transition ml-2"
                                onClick={() => setShowFullCast(false)}
                              >
                                - less
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Genres */}
                  <div>
                    <span className="text-netflix-gray">Genres:</span>
                    <div className="text-white mt-2 flex flex-wrap gap-2">
                      {content.genre.map((genre, index) => (
                        <span key={genre} className="bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full text-xs">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Similar Movies */}
          {similarMovies.length > 0 && (
            <section className="mt-8 sm:mt-12 px-4 sm:px-8 md:px-12 pb-20">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">More Like This</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {similarMovies.map((movie) => (
                  <div 
                    key={movie.id} 
                    className="group relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/movie/${movie.id}`)}
                  >
                      <img
                        src={movie.posterImage}
                        alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="text-white font-semibold text-sm md:text-base mb-1 line-clamp-2">
                        {movie.title}
                      </h3>
                        <div className="flex items-center gap-2 text-gray-300 text-xs">
                        <span>{movie.releaseYear}</span>
                        <span>•</span>
                        <span className="truncate">{movie.genre.slice(0, 2).join(', ')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default MoviePage;

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

  const { id } = useParams<{ id: string }>();
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
            <div className="absolute inset-0 bg-gradient-to-t from-netflix-black via-netflix-black/90 to-transparent" />
          </div>

          {/* Content Section */}
          <div className="relative -mt-[20vh] sm:-mt-[150px] px-4 sm:px-8 md:px-12">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              {/* Poster */}
              <div className="hidden md:block w-[300px] flex-shrink-0">
                <img
                  src={content.posterImage}
                  alt={content.title}
                  className="w-full rounded-md shadow-lg"
                />
              </div>

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 md:mb-4">
                  {content.title}
                </h1>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 md:mb-6 text-white text-sm sm:text-base">
                  <span>{content.releaseYear}</span>
                  <span className="border px-2 py-0.5 text-sm rounded">
                    {content.maturityRating}
                  </span>
                  <span className="px-2 py-0.5 border rounded">HD</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={handlePlay}
                    className="flex items-center justify-center gap-2 px-6 sm:px-8 py-2 sm:py-3 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition shadow-lg"
                  >
                    <Play size={20} fill="black" />
                    <span>Play</span>
                  </button>
                  <button
                    onClick={handleMyList}
                    className="flex items-center justify-center gap-2 px-6 sm:px-8 py-2 sm:py-3 bg-gray-700/80 text-white font-bold rounded-md hover:bg-gray-600 transition shadow-lg"
                  >
                    {inMyList ? <Check size={20} /> : <Plus size={20} />}
                    <span className="hidden sm:inline">{inMyList ? 'Remove from List' : 'My List'}</span>
                  </button>
                  
                  {/* Download Button with Quality Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      className="flex items-center justify-center gap-2 px-6 sm:px-8 py-2 sm:py-3 bg-gray-700/80 text-white font-bold rounded-md hover:bg-gray-600 transition shadow-lg"
                    >
                      <Download size={20} />
                      <span className="hidden sm:inline">Download</span>
                      <ChevronDown size={16} className={`transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showDownloadMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-netflix-gray rounded-lg shadow-lg z-10">
                        <div className="py-1">
                          {content.videoUrl1080p && (
                            <button
                              onClick={() => handleDownload('1080p')}
                              className="w-full px-4 py-2 text-left text-white hover:bg-netflix-gray-hover"
                            >
                              1080p
                            </button>
                          )}
                          {content.videoUrl720p && (
                            <button
                              onClick={() => handleDownload('720p')}
                              className="w-full px-4 py-2 text-left text-white hover:bg-netflix-gray-hover"
                            >
                              720p
                            </button>
                          )}
                          {content.videoUrl480p && (
                            <button
                              onClick={() => handleDownload('480p')}
                              className="w-full px-4 py-2 text-left text-white hover:bg-netflix-gray-hover"
                            >
                              480p
                            </button>
                          )}
                          {content.videoUrl4k && (
                            <button
                              onClick={() => handleDownload('4K')}
                              className="w-full px-4 py-2 text-left text-white hover:bg-netflix-gray-hover"
                            >
                              4K
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-white text-sm sm:text-base md:text-lg mb-6 md:mb-8 line-clamp-3 sm:line-clamp-none">
                  {content.description}
                </p>

                {/* Cast & Genres */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  {/* Cast */}
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
                                className="w-7 h-7 rounded-full object-cover"
                              />
                            )}
                            <div>
                              <div className="font-medium text-sm">{member.name}</div>
                              <div className="text-netflix-gray text-xs">{member.role}</div>
                            </div>
                          </div>
                        ))}
                        {content.cast.length > 3 && (
                          <span className="text-netflix-gray text-sm self-center">+{content.cast.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Genres */}
                  <div>
                    <span className="text-netflix-gray">Genres:</span>
                    <div className="text-white mt-2 flex flex-wrap gap-2">
                      {content.genre.map((genre, index) => (
                        <span key={genre} className="bg-netflix-gray/20 px-2 py-1 rounded-full text-xs">
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
                    className="netflix-card cursor-pointer"
                    onClick={() => navigate(`/movie/${movie.id}`)}
                  >
                    <div className="aspect-[2/3] rounded-md overflow-hidden">
                      <img
                        src={movie.posterImage}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-2">
                      <h3 className="text-white text-sm font-medium truncate">
                        {movie.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-netflix-gray mt-1">
                        <span>{movie.releaseYear}</span>
                        <span>•</span>
                        <span className="truncate">{movie.genre.slice(0, 2).join(', ')}</span>
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

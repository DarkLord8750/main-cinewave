import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/common/LoadingSpinner';
// import JWPlayer from '../components/common/JWPlayer';
import VideoPlayer from '../components/common/VideoPlayer';
import { useContentStore } from '../stores/contentStore';
import { useAuthStore } from '../stores/authStore';
import { Play, Plus, Check, ChevronDown, X, Download } from 'lucide-react';
import { useWatchHistoryStore } from '../stores/watchHistoryStore';
import { Link } from 'react-router-dom';

interface Series {
  id: string;
  title: string;
  description: string;
  backdropImage: string;
  posterImage: string;
  releaseYear: number;
  maturityRating: string;
  type: string;
  genre: string[];
  cast?: { id: string; name: string; photoUrl?: string; role?: string }[];
}

interface Season {
  id: string;
  season_number: number;
  title: string;
  description: string;
}

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  description: string;
  video_url_480p?: string;
  video_url_720p?: string;
  video_url_1080p?: string;
  video_url_4k?: string;
  master_url?: string;
  master_url_480p?: string;
  master_url_720p?: string;
  master_url_1080p?: string;
  subtitle_urls?: { [key: string]: string };
}

const SeriesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [similarSeries, setSimilarSeries] = useState<Series[]>([]);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<string | null>(null);
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);
  const [inMyList, setInMyList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // My List logic
  const { addToMyList, removeFromMyList, isInMyList } = useContentStore();
  const { currentProfile } = useAuthStore();
  const { history } = useWatchHistoryStore();
  const { getContentsByGenre } = useContentStore();

  useEffect(() => {
    const fetchSeriesData = async () => {
      setIsLoading(true);
      // Fetch series info with genres and cast joins
      const { data: seriesData, error: seriesError } = await supabase
        .from('content')
        .select(`
          *,
          content_genres:content_genres(*, genres(*)),
          content_cast:content_cast(*, cast_members(*))
        `)
        .eq('id', id)
        .maybeSingle();
      console.log('seriesData', seriesData, 'seriesError', seriesError);

      // Check if content is actually a series
      if (seriesData && seriesData.type !== 'series') {
        navigate(`/movie/${id}`);
        return;
      }

      setSeries(seriesData
        ? {
            id: seriesData.id,
            title: seriesData.title,
            description: seriesData.description,
            backdropImage: seriesData.backdrop_image,
            posterImage: seriesData.poster_image,
            releaseYear: seriesData.release_year,
            maturityRating: seriesData.maturity_rating,
            type: seriesData.type,
            genre: seriesData.content_genres
              ? seriesData.content_genres.map((cg: any) => cg.genres.name)
              : [],
            cast: seriesData.content_cast
              ? seriesData.content_cast
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((cc: any) => ({
                    id: cc.cast_members.id,
                    name: cc.cast_members.name,
                    photoUrl: cc.cast_members.photo_url,
                    role: cc.role,
                  }))
              : [],
          }
        : null
      );

      // Fetch the series row from the series table
      const { data: seriesRow, error: seriesRowError } = await supabase
        .from('series')
        .select('*')
        .eq('content_id', id)
        .maybeSingle();
      console.log('seriesRow', seriesRow, 'seriesRowError', seriesRowError);

      // Fetch seasons using seriesRow.id
      let seasonsData = [];
      let seasonsError = null;
      if (seriesRow) {
        const { data, error } = await supabase
          .from('seasons')
          .select('*')
          .eq('series_id', seriesRow.id)
          .order('season_number');
        seasonsData = data || [];
        seasonsError = error;
      }
      console.log('seasonsData', seasonsData, 'seasonsError', seasonsError);
      setSeasons(seasonsData);
      setSelectedSeason(seasonsData?.[0] || null);

      setIsLoading(false);
    };
    fetchSeriesData();
  }, [id]);

  useEffect(() => {
    if (!selectedSeason) return;
    const fetchEpisodes = async () => {
      setIsLoading(true);
      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select('*')
        .eq('season_id', selectedSeason.id)
        .order('episode_number');
      console.log('episodesData', episodesData, 'episodesError', episodesError);
      setEpisodes(episodesData || []);
      setIsLoading(false);
    };
    fetchEpisodes();
  }, [selectedSeason]);

  useEffect(() => {
    if (!series) return;
    // Get similar series based on genre
    const similar = series.genre
      .map(g => getContentsByGenre(g))
      .flat()
      .filter((c, i, arr) => 
        c.id !== series.id && 
        c.type === 'series' &&
        arr.findIndex(item => item.id === c.id) === i
      )
      .slice(0, 12);
    setSimilarSeries(similar);
  }, [series, getContentsByGenre]);

  useEffect(() => {
    if (showSeasonPicker) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSeasonPicker]);

  // Add click outside handler for season dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.season-dropdown')) {
        setShowSeasonDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync inMyList state with store when series changes
  useEffect(() => {
    if (series) {
      setInMyList(isInMyList(series.id));
    }
  }, [series, isInMyList]);

  if (isLoading || !series) return <LoadingSpinner />;

  const handlePlay = (episode: Episode) => {
    setCurrentEpisode(episode);
    setShowVideo(true);
    setIsFullscreen(true);
  };

  const handleChangeEpisode = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < episodes.length) {
      setCurrentEpisode(episodes[newIndex]);
    }
  };

  const currentEpisodeIndex = currentEpisode ? episodes.findIndex(e => e.id === currentEpisode.id) : 0;
  const startTime = currentEpisode ? (history.find(h => h.contentId === currentEpisode.id)?.watchTime || 0) : 0;

  const handleClose = () => {
    setShowVideo(false);
    setIsFullscreen(false);
  };

  const handleMyList = () => {
    if (!series) return;
    if (isInMyList(series.id)) {
      removeFromMyList(series.id);
      setInMyList(false);
    } else {
      addToMyList(series.id);
      setInMyList(true);
    }
  };

  const handleSeasonClick = () => {
    setShowSeasonDropdown(!showSeasonDropdown);
  };

  const handleSeasonSelect = (season: Season) => {
    setSelectedSeason(season);
    setShowSeasonDropdown(false);
    setShowSeasonPicker(false);
  };

  const watchProgress = currentEpisode && currentProfile
    ? history.find(
        h => h.contentId === currentEpisode.id && h.profileId === currentProfile.id
      )
    : null;

  const getVideoUrls = (episode: Episode) => {
    return {
      videoUrl: episode.video_url_4k ?? '',
      videoUrl480p: episode.video_url_480p ?? '',
      videoUrl720p: episode.video_url_720p ?? '',
      videoUrl1080p: episode.video_url_1080p ?? ''
    };
  };

  const handleDownload = (episode: Episode, quality: string) => {
    const urls = getVideoUrls(episode);
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
      link.download = `${series?.title}_S${selectedSeason?.season_number}E${episode.episode_number}_${quality}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-netflix-dark">
      {isFullscreen && showVideo && currentEpisode ? (
        <div className="fixed inset-0 z-50 bg-black">
          <VideoPlayer
            title={series.title + ' - ' + currentEpisode.title}
            description={currentEpisode.description}
            masterUrl={currentEpisode.master_url ?? ''}
            contentId={series.id}
            onClose={handleClose}
            isFullScreen={true}
            autoPlay={true}
            episodeInfo={{
              season: selectedSeason?.season_number || 1,
              episode: currentEpisode.episode_number,
              title: currentEpisode.title,
            }}
            startTime={startTime}
            subtitleUrls={currentEpisode.subtitle_urls}
          />
        </div>
      ) : (
        <>
          <div className="relative w-full h-[60vh] sm:h-[56.25vw] sm:max-h-[80vh]">
            <img 
              src={series.backdropImage} 
              alt={series.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
          </div>

          <div className="relative -mt-[20vh] sm:-mt-[150px] px-4 sm:px-8 md:px-12">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              <div className="hidden md:block w-[300px] flex-shrink-0">
                <img
                  src={series.posterImage}
                  alt={series.title}
                  className="w-full rounded-md shadow-lg"
                />
              </div>

              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 md:mb-4">
                  {series.title}
                </h1>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 md:mb-6 text-white text-sm sm:text-base">
                  <span>{series.releaseYear}</span>
                  <span className="border px-2 py-0.5 text-sm rounded">
                    {series.maturityRating}
                  </span>
                  <span className="px-2 py-0.5 border rounded">HD</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-6 w-full">
                  <button
                    onClick={handleMyList}
                    className="group relative flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-300 border border-white/10 hover:border-white/20 overflow-hidden text-base sm:text-base"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex items-center gap-2">
                      {inMyList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      <span className="font-medium tracking-wide">{inMyList ? 'Remove from List' : 'My List'}</span>
                    </div>
                  </button>
                </div>

                <p className="text-white text-sm sm:text-base md:text-lg mb-6 md:mb-8 line-clamp-3 sm:line-clamp-none">
                  {series.description}
                </p>

                {/* Cast & Genres */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  {/* Cast */}
                  {series.cast && series.cast.length > 0 && (
                    <div>
                      <span className="text-netflix-gray">Cast:</span>
                      <div className="text-white mt-2 flex flex-wrap gap-3">
                        {series.cast.slice(0, 3).map(member => (
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
                        {series.cast.length > 3 && (
                          <span className="text-netflix-gray text-sm self-center">+{series.cast.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Genres */}
                  <div>
                    <span className="text-netflix-gray">Genres:</span>
                    <div className="text-white mt-2 flex flex-wrap gap-2">
                      {series.genre.map((genre) => (
                        <span key={genre} className="bg-netflix-gray/20 px-2 py-1 rounded-full text-xs">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Episodes Section */}
            <div className="mt-8 md:mt-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    Episodes
                  </h2>
                  <div className="relative season-dropdown">
                <button
                  onClick={handleSeasonClick}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-200"
                >
                  <span>Season {selectedSeason?.season_number}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSeasonDropdown ? 'rotate-180' : ''}`} />
                </button>
                    {showSeasonDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-48 bg-[#1f1f1f] rounded-lg shadow-xl z-10 border border-white/10 backdrop-blur-md">
                        <div className="py-1">
                    {seasons.map(season => (
                            <button
                        key={season.id} 
                              onClick={() => handleSeasonSelect(season)}
                              className="w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                            >
                              <span className="font-medium">Season {season.season_number}</span>
                              {selectedSeason?.id === season.id && (
                                <Check className="w-4 h-4 text-netflix-red" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="group flex items-center justify-between gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-200"
                  >
                    <div className="flex items-start gap-4 flex-grow">
                      <div className="relative w-24 h-16 md:w-40 md:h-24 flex-shrink-0 rounded-lg overflow-hidden group cursor-pointer">
                        <img
                          src={series.posterImage}
                          alt={episode.title}
                          className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110 group-hover:brightness-75"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      </div>
                      <div className="flex-grow">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-white">
                            {episode.episode_number}. {episode.title}
                          </h3>
                          <p className="text-gray-400 text-sm line-clamp-2">
                            {episode.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>HD</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handlePlay(episode)}
                        className="group relative flex items-center justify-center w-10 h-10 bg-netflix-red hover:bg-red-700 rounded-lg text-white transition-all duration-300 shadow-lg hover:shadow-red-500/30 overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="relative">
                          <Play className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        </div>
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setShowDownloadMenu(showDownloadMenu === episode.id ? null : episode.id)}
                          className="group relative flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all duration-300 border border-white/10 hover:border-white/20 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="relative">
                            <Download className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                          </div>
                        </button>
                        {showDownloadMenu === episode.id && (
                          <div className="absolute right-0 mt-2 w-56 bg-[#1f1f1f]/95 rounded-lg shadow-xl z-10 border border-white/10 backdrop-blur-md">
                            <div className="py-1.5">
                              {episode.video_url_1080p && (
                                <button
                                  onClick={() => handleDownload(episode, '1080p')}
                                  className="group w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">1080p</span>
                                    <span className="text-xs text-gray-400 group-hover:text-white">Full HD</span>
                                  </div>
                                  <span className="text-xs text-gray-500 group-hover:text-white">Best Quality</span>
                                </button>
                              )}
                              {episode.video_url_720p && (
                                <button
                                  onClick={() => handleDownload(episode, '720p')}
                                  className="group w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">720p</span>
                                    <span className="text-xs text-gray-400 group-hover:text-white">HD</span>
                                  </div>
                                  <span className="text-xs text-gray-500 group-hover:text-white">Good Quality</span>
                                </button>
                              )}
                              {episode.video_url_480p && (
                                <button
                                  onClick={() => handleDownload(episode, '480p')}
                                  className="group w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">480p</span>
                                    <span className="text-xs text-gray-400 group-hover:text-white">SD</span>
                                  </div>
                                  <span className="text-xs text-gray-500 group-hover:text-white">Standard</span>
                                </button>
                              )}
                              {episode.video_url_4k && (
                                <button
                                  onClick={() => handleDownload(episode, '4K')}
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
                  </div>
                ))}
              </div>
            </div>

            {/* Similar Series Section */}
            {similarSeries.length > 0 && (
              <section className="mt-12 md:mt-16">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
                  More Like This
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {similarSeries.map((series) => (
                    <div
                      key={series.id}
                      className="group relative aspect-[2/3] rounded-lg overflow-hidden"
                    >
                      <img
                        src={series.posterImage}
                        alt={series.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-white font-semibold text-sm md:text-base mb-1 line-clamp-2">
                            {series.title}
                          </h3>
                          <div className="flex items-center gap-2 text-gray-300 text-xs">
                            <span>{series.releaseYear}</span>
                            <span>•</span>
                            <span>{series.maturityRating}</span>
                          </div>
                        </div>
                      </div>
                      <Link
                        to={`/series/${series.id}`}
                        className="absolute inset-0 z-10"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
              </div>

              {/* Mobile Season Picker Bottom Sheet */}
              {showSeasonPicker && (
                <div className="fixed inset-0 z-50 sm:hidden">
                  <div 
                    className="absolute inset-0 bg-black/60"
                    onClick={() => setShowSeasonPicker(false)}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-[#1f1f1f] rounded-t-xl max-h-[80vh] overflow-y-auto">
                    <div className="sticky top-0 flex items-center justify-between p-4 bg-[#1f1f1f] border-b border-gray-800">
                      <h3 className="text-lg font-medium text-white">Select Season</h3>
                      <button 
                        onClick={() => setShowSeasonPicker(false)}
                        className="p-1 text-gray-400 hover:text-white"
                      >
                        <X size={24} />
                      </button>
                    </div>
                    <div className="py-2">
                      {seasons.map(season => (
                        <button
                          key={season.id}
                          onClick={() => handleSeasonSelect(season)}
                          className={`w-full px-6 py-4 text-left text-white hover:bg-[#2f2f2f] transition-colors flex items-center justify-between ${
                            selectedSeason?.id === season.id ? 'bg-[#2f2f2f]' : ''
                          }`}
                        >
                          <span className="text-base">Season {season.season_number}</span>
                          {selectedSeason?.id === season.id && (
                            <Check size={20} className="text-netflix-red" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
        </>
      )}
    </div>
  );
};

export default SeriesPage;

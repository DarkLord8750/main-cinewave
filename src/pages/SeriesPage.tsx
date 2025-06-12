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

  // My List logic
  const { isInMyList, addToMyList, removeFromMyList } = useContentStore();
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

  if (isLoading || !series) return <LoadingSpinner />;

  const inMyList = isInMyList(series.id);

  const handlePlay = (episode: Episode) => {
    setCurrentEpisode(episode);
    setShowVideo(true);
    setIsFullscreen(true);
  };

  const handleChangeEpisode = (newIndex: number) => {
    if (episodes[newIndex]) {
      setCurrentEpisode(episodes[newIndex]);
    }
  };

  const currentEpisodeIndex = currentEpisode ? episodes.findIndex(e => e.id === currentEpisode.id) : 0;

  const handleClose = () => {
    setIsFullscreen(false);
    setShowVideo(false);
    setCurrentEpisode(null);
  };

  const handleMyList = () => {
    if (inMyList) {
      removeFromMyList(series.id);
    } else {
      addToMyList(series.id);
    }
  };

  const handleSeasonClick = () => {
    setShowSeasonPicker(true);
  };

  const handleSeasonSelect = (season: Season) => {
    setSelectedSeason(season);
    setShowSeasonPicker(false);
  };

  const watchProgress = currentEpisode && currentProfile
    ? history.find(
        h => h.contentId === currentEpisode.id && h.profileId === currentProfile.id
      )
    : null;
  const startTime = watchProgress?.watchTime || 0;

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
          {/* Previous VideoPlayer implementation 
          <VideoPlayer
            title={series.title + ' - ' + currentEpisode.title}
            description={currentEpisode.description}
            masterUrl={currentEpisode.master_url || ''}
            masterUrl480p={currentEpisode.master_url_480p || ''}
            masterUrl720p={currentEpisode.master_url_720p || ''}
            masterUrl1080p={currentEpisode.master_url_1080p || ''}
            contentId={series.id}
            onClose={handleClose}
            isFullScreen={true}
            autoPlay={true}
            episodes={episodes}
            currentEpisodeIndex={currentEpisodeIndex}
            onChangeEpisode={handleChangeEpisode}
            episodeInfo={{
              season: selectedSeason?.season_number || 1,
              episode: currentEpisode.episode_number,
              title: currentEpisode.title,
            }}
            startTime={startTime}
          />
          */}
          
          {/* New VideoPlayer implementation */}
          <VideoPlayer
            title={series.title + ' - ' + currentEpisode.title}
            description={currentEpisode.description}
            masterUrl={currentEpisode.master_url ?? ''}
            contentId={series.id}
            onClose={handleClose}
            isFullScreen={true}
            autoPlay={true}
            episodes={episodes}
            currentEpisodeIndex={currentEpisodeIndex}
            onChangeEpisode={handleChangeEpisode}
            episodeInfo={{
              season: selectedSeason?.season_number || 1,
              episode: currentEpisode.episode_number,
              title: currentEpisode.title,
            }}
            startTime={startTime}
          />
        </div>
      ) : (
        <div className="min-h-screen bg-netflix-dark">
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

                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={handleMyList}
                    className="flex items-center gap-2 px-6 sm:px-8 py-2 sm:py-3 bg-gray-700 bg-opacity-70 text-white font-bold rounded hover:bg-gray-600 transition shadow"
                  >
                    {inMyList ? <Check size={20} /> : <Plus size={20} />}
                    <span className="hidden sm:inline">{inMyList ? 'Remove from List' : 'My List'}</span>
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

            {/* Season Selector and Episodes */}
            <div className="mt-8 md:mt-12">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                <label className="font-semibold text-white text-lg">Season:</label>
                {/* Mobile Season Button */}
                <button
                  onClick={handleSeasonClick}
                  className="sm:hidden w-full bg-[#1f1f1f] text-white px-4 py-3 rounded flex items-center justify-between"
                >
                  <span>Season {selectedSeason?.season_number}</span>
                  <ChevronDown size={20} />
                </button>
                {/* Desktop Season Selector */}
                <div className="hidden sm:block relative w-44">
                  <select
                    className="w-full appearance-none bg-[#1f1f1f] text-white px-4 py-2.5 rounded border border-gray-600 hover:bg-[#2f2f2f] transition-colors focus:border-gray-400 focus:outline-none cursor-pointer pr-10"
                    value={selectedSeason?.id || ''}
                    onChange={e => {
                      const season = seasons.find(s => s.id === e.target.value);
                      setSelectedSeason(season || null);
                    }}
                  >
                    {seasons.map(season => (
                      <option 
                        key={season.id} 
                        value={season.id}
                      >
                        Season {season.season_number}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                </div>
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

              {/* Episode List */}
              <div className="px-4 md:px-8 py-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl md:text-2xl font-bold text-white">
                    Episodes
                  </h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSeasonClick}
                      className="flex items-center space-x-2 px-4 py-2 bg-netflix-gray hover:bg-netflix-gray-hover rounded text-white"
                    >
                      <span>Season {selectedSeason?.season_number}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {episodes.map((episode) => (
                    <div
                      key={episode.id}
                      className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4 p-4 bg-netflix-gray rounded-lg"
                    >
                      <div className="relative w-full md:w-48 h-27 md:h-32 flex-shrink-0">
                        <img
                          src={series.posterImage}
                          alt={episode.title}
                          className="w-full h-full object-cover rounded"
                        />
                        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black bg-opacity-50 hover:bg-opacity-40 transition-opacity">
                          <button
                            onClick={() => handlePlay(episode)}
                            className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
                          >
                            <Play className="w-6 h-6 text-white" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setShowDownloadMenu(showDownloadMenu === episode.id ? null : episode.id)}
                              className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
                            >
                              <Download className="w-6 h-6 text-white" />
                            </button>
                            {showDownloadMenu === episode.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-netflix-gray rounded-lg shadow-lg z-10">
                                <div className="py-1">
                                  {episode.video_url_1080p && (
                                    <button
                                      onClick={() => handleDownload(episode, '1080p')}
                                      className="w-full px-4 py-2 text-left text-white hover:bg-netflix-gray-hover"
                                    >
                                      1080p
                                    </button>
                                  )}
                                  {episode.video_url_720p && (
                                    <button
                                      onClick={() => handleDownload(episode, '720p')}
                                      className="w-full px-4 py-2 text-left text-white hover:bg-netflix-gray-hover"
                                    >
                                      720p
                                    </button>
                                  )}
                                  {episode.video_url_480p && (
                                    <button
                                      onClick={() => handleDownload(episode, '480p')}
                                      className="w-full px-4 py-2 text-left text-white hover:bg-netflix-gray-hover"
                                    >
                                      480p
                                    </button>
                                  )}
                                  {episode.video_url_4k && (
                                    <button
                                      onClick={() => handleDownload(episode, '4K')}
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
                      </div>
                      <div className="flex-grow">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {episode.episode_number}. {episode.title}
                          </h3>
                          <p className="text-gray-400 mt-2">
                            {episode.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Similar Series Section */}
          {similarSeries.length > 0 && (
            <section className="mt-8 sm:mt-12 px-4 sm:px-8 md:px-12 pb-20">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">More Like This</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {similarSeries.map((item) => (
                  <div 
                    key={item.id} 
                    className="netflix-card cursor-pointer"
                    onClick={() => navigate(`/series/${item.id}`)}
                  >
                    <div className="aspect-[2/3] rounded-md overflow-hidden">
                      <img
                        src={item.posterImage}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-2">
                      <h3 className="text-white text-sm font-medium truncate">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-netflix-gray mt-1">
                        <span>{item.releaseYear}</span>
                        <span>•</span>
                        <span className="truncate">{item.genre.slice(0, 2).join(', ')}</span>
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

export default SeriesPage;

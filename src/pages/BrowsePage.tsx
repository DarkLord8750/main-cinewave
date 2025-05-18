import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useContentStore, Content } from '../stores/contentStore';
import { useAuthStore } from '../stores/authStore';
import { useWatchHistoryStore } from '../stores/watchHistoryStore';
import HeroBanner from '../components/common/HeroBanner';
import ContentRow from '../components/common/ContentRow';
import LoadingSpinner from '../components/common/LoadingSpinner';

const BrowsePage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { contents, featuredContents, fetchContents, fetchFeaturedContents, getContentsByGenre, getMyListContents } = useContentStore();
  const { currentProfile } = useAuthStore();
  const { fetchHistory, getContinueWatching } = useWatchHistoryStore();
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
  // const location = useLocation();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type');
  const filter = searchParams.get('filter');
  const list = searchParams.get('list');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchContents(),
          fetchFeaturedContents(),
          currentProfile?.id ? fetchHistory(currentProfile.id) : Promise.resolve()
        ]);
      } catch (error) {
        console.error('Error loading data:', error);
      }
      setIsLoading(false);
    };
    
    loadData();
  }, [fetchContents, fetchFeaturedContents, fetchHistory, currentProfile?.id]);

  // Filter featured content based on page type
  const filteredFeatured = featuredContents.filter(content => {
    if (type === 'series') return content.type === 'series';
    if (type === 'movies') return content.type === 'movie';
    return true;
  });

  // Reset featured index if it's out of bounds after filtering
  useEffect(() => {
    if (currentFeaturedIndex >= filteredFeatured.length) {
      setCurrentFeaturedIndex(0);
    }
  }, [filteredFeatured.length, currentFeaturedIndex]);

  // Rotate featured content every 10 seconds
  useEffect(() => {
    if (filteredFeatured.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentFeaturedIndex(current => 
        current === filteredFeatured.length - 1 ? 0 : current + 1
      );
    }, 10000);

    return () => clearInterval(interval);
  }, [filteredFeatured.length]);

  if (isLoading || featuredContents.length === 0) {
    return <LoadingSpinner />;
  }

  // Filter content based on URL parameters
  let filteredContents = [...contents];
  
  if (type === 'series') {
    filteredContents = contents.filter(c => c.type === 'series');
  } else if (type === 'movies') {
    filteredContents = contents.filter(c => c.type === 'movie');
  }

  if (filter === 'new') {
    filteredContents = filteredContents
      .sort((a, b) => b.releaseYear - a.releaseYear)
      .slice(0, 20);
  }

  // Get user's saved list
  const myList = list === 'my-list' ? getMyListContents() : [];

  // Get continue watching content
  const continueWatchingHistory = getContinueWatching();
  const continueWatchingContent = continueWatchingHistory
    .map(history => contents.find(content => content.id === history.contentId))
    .filter((content): content is Content => content !== undefined);

  // Group content by categories
  const contentRows = [];

  if (list === 'my-list') {
    contentRows.push({ title: 'My List', contents: myList });
  } else {
    if (filter === 'new') {
      contentRows.push({ title: 'New Releases', contents: filteredContents });
    } else {
      // Add continue watching section if there are items
      if (continueWatchingContent.length > 0) {
        contentRows.push({
          title: 'Continue Watching',
          contents: continueWatchingContent
        });
      }

      // Add trending section
      contentRows.push({
        title: 'Trending Now',
        contents: filteredContents.slice(0, 10)
      });

      // Add featured section (excluding current banner content)
      const otherFeatured = filteredFeatured.filter((_, i) => i !== currentFeaturedIndex);
      if (otherFeatured.length > 0) {
        contentRows.push({
          title: type === 'series' ? 'Featured Series' : 
                type === 'movies' ? 'Featured Movies' : 
                'Featured on Netflix',
          contents: otherFeatured
        });
      }

      // Add genre-based rows
      const genres = Array.from(new Set(filteredContents.flatMap(c => c.genre)));
      genres.forEach(genre => {
        const genreContents = getContentsByGenre(genre).filter(c => {
          if (type === 'series') return c.type === 'series';
          if (type === 'movies') return c.type === 'movie';
          return true;
        });
        
        if (genreContents.length > 0) {
          contentRows.push({ title: genre, contents: genreContents });
        }
      });
    }
  }

  return (
    <div className="relative min-h-screen bg-netflix-dark">
      {/* Hero banner for main featured content */}
      {filteredFeatured.length > 0 && (
        <HeroBanner content={filteredFeatured[currentFeaturedIndex]} />
      )}
      
      {/* Content rows */}
      <div className="relative z-10 pb-20 md:pb-0">
        {contentRows.map(({ title, contents }) => (
          <ContentRow 
            key={title} 
            title={title} 
            contents={contents} 
          />
        ))}
      </div>

      {/* Continue Watching Row */}
      <div>
        {continueWatchingContent.length > 0 ? (
          <ContentRow
            title="Continue Watching"
            contents={continueWatchingContent.map(item => ({
              ...item,
              _watch: continueWatchingHistory.find(history => history.contentId === item.id)
            }))}
          />
        ) : (
          <div className="px-4 md:px-12 py-8">
            <h2 className="text-xl font-bold text-white mb-2">Continue Watching</h2>
            <div className="text-netflix-gray">No items to continue watching yet. Start watching a movie or series!</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowsePage;
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useContentStore, Content } from '../stores/contentStore';
import { useAuthStore } from '../stores/authStore';
import { useWatchHistoryStore } from '../stores/watchHistoryStore';
import { useGenreStore } from '../stores/genreStore';
import HeroBanner from '../components/common/HeroBanner';
import ContentRow from '../components/common/ContentRow';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Top10ContentRow from '../components/common/Top10ContentRow';

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Add WatchHistory interface for type safety
interface WatchHistory {
  lastWatched: string;
  contentId: string;
  watchTime?: number;
  episodeId?: string;
  duration?: string;
  completed?: boolean;
}

const BrowsePage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { contents, featuredContents, fetchContents, fetchFeaturedContents, getContentsByGenre, getMyListContents } = useContentStore();
  const { genres, fetchGenres } = useGenreStore();
  const { currentProfile } = useAuthStore();
  const { fetchHistory, getContinueWatching } = useWatchHistoryStore();
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
          fetchGenres(),
          currentProfile?.id ? fetchHistory(currentProfile.id) : Promise.resolve()
        ]);
        // After all data is fetched, re-evaluate heroContent and set isLoading to false
        // This ensures heroContent is ready before isLoading is false
        // The useMemo for heroContent will re-run based on featuredContents/type changes.
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        // Set isLoading to false only after data is loaded and heroContent is potentially resolved.
        // The heroContent check in the return statement will handle cases where no featured content is available.
        setIsLoading(false);
      }
    };
    loadData();
  }, [fetchContents, fetchFeaturedContents, fetchGenres, fetchHistory, currentProfile?.id]);

  // Determine the content for the Hero Banner and remaining featured items
  const { heroContent, remainingFeatured } = useMemo(() => {
    const filtered = featuredContents.filter((content): content is Content => {
      // Ensure content is not null/undefined and then filter by type
      if (!content) return false;
      if (type === 'series') return content.type === 'series';
      if (type === 'movies') return content.type === 'movie';
      return true;
    });

    if (filtered.length > 0) {
      const randomIndex = Math.floor(Math.random() * filtered.length);
      const selectedHeroContent = filtered[randomIndex];
      // Explicitly check if selected content is valid and has backdropImage before returning
      if (selectedHeroContent && selectedHeroContent.backdropImage) {
        const other = filtered.filter(content => content.id !== selectedHeroContent.id);
        return { heroContent: selectedHeroContent, remainingFeatured: other };
      }
    }
    return { heroContent: null, remainingFeatured: [] };
  }, [featuredContents, type]);

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

  // Get continue watching content in chronological order
  const continueWatchingHistory: WatchHistory[] = getContinueWatching();
  const continueWatchingContent: (Content & { lastWatched: string })[] = [];
  const seenContentIds = new Set<string>();
  continueWatchingHistory
    .sort((a, b) => {
      const aTime = a.lastWatched ? new Date(a.lastWatched).getTime() : 0;
      const bTime = b.lastWatched ? new Date(b.lastWatched).getTime() : 0;
      return bTime - aTime;
    })
    .forEach(history => {
      const content = contents.find(content => content.id === history.contentId);
      if (content && !seenContentIds.has(content.id)) {
        continueWatchingContent.push({ ...content, lastWatched: history.lastWatched });
        seenContentIds.add(content.id);
      }
    });

  // Get random genres
  const randomGenres = useMemo(() => {
    if (list === 'my-list') return [];
    
    const availableGenres = genres
      .map(g => g.name)
      .filter(genre => {
        const genreContents = getContentsByGenre(genre).filter(c => {
          if (type === 'series') return c.type === 'series';
          if (type === 'movies') return c.type === 'movie';
          return true;
        });
        return genreContents.length > 0;
      });

    // Shuffle and take 6 random genres
    return shuffleArray(availableGenres).slice(0, 6);
  }, [genres, type, list, getContentsByGenre]);

  // Generate Top 10 content (shuffled daily)
  const top10TodayContents = useMemo(() => {
    if (list === 'my-list' || filter === 'new') return [];
    return shuffleArray([...contents]).slice(0, 10); // Take a shuffled slice of all content
  }, [contents, list, filter]);

  // Group content by categories
  const contentRows = useMemo(() => {
    const rows: { title: string; contents: Content[] }[] = [];

    if (list === 'my-list') {
      rows.push({ title: 'My List', contents: shuffleArray(myList) });
    } else {
      if (filter === 'new') {
        rows.push({ title: 'New Releases', contents: shuffleArray(filteredContents) });
      } else {
        // Add continue watching section if there are items (in chronological order)
        if (continueWatchingContent.length > 0) {
          rows.push({
            title: 'Continue Watching',
            contents: continueWatchingContent
          });
        }

        // Add Top 10 Today section
        if (top10TodayContents.length > 0) {
          rows.push({
            title: 'Top 10 in INDIA Today',
            contents: top10TodayContents
          });
        }

        // Add trending section
        rows.push({
          title: 'Trending Now',
          contents: shuffleArray(filteredContents).slice(0, 10)
        });

        // Add featured section (excluding current banner content)
        if (remainingFeatured.length > 0) {
          rows.push({
            title: type === 'series' ? 'Featured Series' : 
                  type === 'movies' ? 'Featured Movies' : 
                  'Featured on Netflix',
            contents: shuffleArray(remainingFeatured)
          });
        }

        // Add random genre rows
        randomGenres.forEach(genre => {
          const genreContents = getContentsByGenre(genre).filter(c => {
            if (type === 'series') return c.type === 'series';
            if (type === 'movies') return c.type === 'movie';
            return true;
          });
          if (genreContents.length > 0) {
            rows.push({ title: genre, contents: shuffleArray(genreContents) });
          }
        });
      }
    }

    return rows;
  }, [list, myList, filter, filteredContents, continueWatchingContent, heroContent, remainingFeatured, type, randomGenres, getContentsByGenre, top10TodayContents]);

  if (isLoading || !heroContent) {
    return <LoadingSpinner />;
  }

  return (
    <div className="relative min-h-screen bg-netflix-dark">
      {/* Hero banner for main featured content (randomized on each load) */}
      {heroContent && (
        <HeroBanner content={heroContent} />
      )}
      {/* Content rows */}
      <div className="relative z-10 pb-20 md:pb-0">
        {contentRows.map(({ title, contents }) => (
          title === 'Top 10 in INDIA Today' ? (
            <Top10ContentRow 
              key={title} 
              title={title} 
              contents={contents} 
            />
          ) : (
            <ContentRow 
              key={title} 
              title={title} 
              contents={contents} 
            />
          )
        ))}
      </div>
    </div>
  );
};

export default BrowsePage;

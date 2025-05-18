import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, Film, Tv } from 'lucide-react';
import { useContentStore, Content } from '../stores/contentStore';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ContentCard from '../components/common/ContentCard';
import debounce from 'lodash/debounce';

const SearchPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [filter, setFilter] = useState<'all' | 'movies' | 'series'>('all');
  const { contents, fetchContents, searchContents } = useContentStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      let results = searchContents(searchQuery);
      
      if (filter === 'movies') {
        results = results.filter(content => content.type === 'movie');
      } else if (filter === 'series') {
        results = results.filter(content => content.type === 'series');
      }
      
      setSearchResults(results);
      setSearchParams({ q: searchQuery });
    }, 300),
    [filter, searchContents, setSearchParams]
  );

  useEffect(() => {
    const loadData = async () => {
      if (contents.length === 0) {
        await fetchContents();
      }
      
      const queryParam = searchParams.get('q');
      if (queryParam) {
        setQuery(queryParam);
        debouncedSearch(queryParam);
      }
      setIsLoading(false);
    };
    
    loadData();
  }, [fetchContents, contents.length, searchParams, debouncedSearch]);

  // Update search results when filter changes
  useEffect(() => {
    if (query) {
      debouncedSearch(query);
    }
  }, [filter, query, debouncedSearch]);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    debouncedSearch(searchQuery);
  };

  const handleClear = () => {
    setQuery('');
    setSearchResults([]);
    setSearchParams({});
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-netflix-black">
      <div className="pt-16 px-3 md:pt-20 md:px-12 lg:px-16 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Search Bar Section */}
          <div className="mb-8">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-netflix-gray" size={20} />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search movies & TV shows..."
                className="w-full pl-12 pr-12 py-3.5 bg-netflix-dark/90 border border-netflix-gray/30 rounded-full text-netflix-white text-base focus:outline-none focus:border-netflix-white transition shadow-lg"
              />
              {query && (
                <button 
                  onClick={handleClear}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-netflix-gray hover:text-netflix-white transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
          
          {/* Filter Options */}
          <div className="flex gap-2 md:gap-3 mb-8 justify-center">
            <button 
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'all' 
                  ? 'bg-netflix-white text-netflix-black' 
                  : 'bg-netflix-gray/20 text-netflix-white hover:bg-netflix-gray/30'
              }`}
            >
              All
            </button>
            
            <button 
              onClick={() => setFilter('movies')}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'movies' 
                  ? 'bg-netflix-white text-netflix-black' 
                  : 'bg-netflix-gray/20 text-netflix-white hover:bg-netflix-gray/30'
              }`}
            >
              <Film size={16} />
              <span>Movies</span>
            </button>
            
            <button 
              onClick={() => setFilter('series')}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all ${
                filter === 'series' 
                  ? 'bg-netflix-white text-netflix-black' 
                  : 'bg-netflix-gray/20 text-netflix-white hover:bg-netflix-gray/30'
              }`}
            >
              <Tv size={16} />
              <span>TV Shows</span>
            </button>
          </div>

          {/* Search Results */}
          {query && (
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold text-netflix-white text-center mb-6">
                {searchResults.length > 0 
                  ? `Results for "${query}"`
                  : `No results found for "${query}"`
                }
              </h2>
              
              {searchResults.length === 0 && (
                <p className="text-netflix-gray text-center text-base">
                  Try different keywords or browse our content below
                </p>
              )}
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mx-auto max-w-[1800px]">
                {searchResults.map((content) => (
                  <div key={content.id} className="flex justify-center">
                    <ContentCard content={content} />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Popular Content Section */}
          {!query && (
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold text-netflix-white text-center mb-6">
                Popular on Netflix
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mx-auto max-w-[1800px]">
                {contents.slice(0, 10).map((content) => (
                  <div key={content.id} className="flex justify-center">
                    <ContentCard content={content} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
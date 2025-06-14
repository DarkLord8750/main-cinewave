import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Content, useContentStore } from '../../stores/contentStore';
import { useGenreStore } from '../../stores/genreStore';
import ContentCard from './ContentCard';

interface ContentRowProps {
  title?: string;
  genre?: string;
  contents?: Content[];
  onPlay?: (content: Content) => void;
}

const ContentRow = ({ title, genre, contents: propContents, onPlay }: ContentRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { contents: allContents, getContentsByGenre } = useContentStore();
  const { genres } = useGenreStore();
  const [randomGenre, setRandomGenre] = useState<string>('');

  // Get random genre if not provided
  useEffect(() => {
    if (!genre && genres.length > 0) {
      const randomIndex = Math.floor(Math.random() * genres.length);
      setRandomGenre(genres[randomIndex].name);
    }
  }, [genre, genres]);

  // Get contents based on genre
  const contents = propContents || (genre || randomGenre ? getContentsByGenre(genre || randomGenre) : []);

  const checkScroll = useCallback(() => {
    if (!rowRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    const hasScroll = scrollWidth > clientWidth;
    
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(hasScroll && scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // Reset scroll position and setup event listeners
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    // Reset scroll position
    row.scrollLeft = 0;

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      // Add a small delay to ensure the DOM has updated
      setTimeout(checkScroll, 100);
    };

    // Initial check with a small delay to ensure content is rendered
    setTimeout(checkScroll, 100);

    // Add event listeners
    row.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      row.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', handleResize);
      // Reset scroll position on cleanup
      row.scrollLeft = 0;
    };
  }, [checkScroll, contents]); // Added contents as dependency to reset on content change

  // Reset scroll position when contents change
  useEffect(() => {
    if (rowRef.current) {
      rowRef.current.scrollLeft = 0;
    }
  }, [contents]);

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (!rowRef.current) return;

    const { scrollLeft, clientWidth, scrollWidth } = rowRef.current;
    const cardWidth = 200; // Approximate width of a card
    const gap = 16; // Gap between cards
    const cardsPerScroll = Math.floor(clientWidth / (cardWidth + gap));
    const scrollAmount = (cardWidth + gap) * cardsPerScroll;

    let targetScroll;
    if (direction === 'left') {
      targetScroll = Math.max(0, scrollLeft - scrollAmount);
    } else {
      const maxScroll = scrollWidth - clientWidth;
      targetScroll = Math.min(maxScroll, scrollLeft + scrollAmount);
    }

    rowRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }, []);

  // Don't render if no contents
  if (contents.length === 0) return null;

  return (
    <div className="relative my-8 z-0">
      <h2 className="text-xl font-bold text-white mb-4 px-4 md:px-12">
        {title || (genre || randomGenre)}
      </h2>
      
      <div className="relative">
        {!isMobile && contents.length > 4 && (
          <>
            <button 
              className={`absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-40 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all duration-300 ${
                canScrollLeft ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => handleScroll('left')}
              aria-label="Scroll left"
            >
              <ChevronLeft className="text-white" size={24} />
            </button>
            
            <button 
              className={`absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-40 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all duration-300 ${
                canScrollRight ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => handleScroll('right')}
              aria-label="Scroll right"
            >
              <ChevronRight className="text-white" size={24} />
            </button>
          </>
        )}
        
        <div className="px-4 md:px-12">
          <div 
            ref={rowRef}
            className="flex gap-2 md:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              scrollBehavior: 'smooth'
            }}
          >
            {contents.map((content) => (
              <div 
                key={content.id} 
                className="flex-none relative snap-start"
                style={{ 
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always'
                }}
              >
                <ContentCard content={content} onPlay={onPlay} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentRow;

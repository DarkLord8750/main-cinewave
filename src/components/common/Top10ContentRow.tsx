import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Content } from '../../stores/contentStore';
import ContentCard from './ContentCard';

interface Top10ContentRowProps {
  title: string;
  contents: Content[];
  onPlay?: (content: Content) => void;
}

const Top10ContentRow = ({ title, contents, onPlay }: Top10ContentRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const checkScroll = useCallback(() => {
    if (!rowRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    const hasScroll = scrollWidth > clientWidth;
    
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(hasScroll && scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    // Reset scroll position on mount
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

    // Cleanup
    return () => {
      row.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [checkScroll, contents]);

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

  if (contents.length === 0) return null;

  return (
    <div className="relative my-8 z-0">
      <h2 className="text-xl font-bold text-white mb-4 px-4 md:px-12">{title}</h2>
      
      {/* SVG Filter for text smoothing */}
      <svg width="0" height="0">
        <filter id="svg-blur-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
        </filter>
      </svg>

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
        
        <div>
          <div 
            ref={rowRef}
            className="flex overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
              scrollBehavior: 'smooth'
            }}
          >
            {contents.map((content, index) => (
              <div 
                key={content.id} 
                className="flex-none relative snap-start"
                style={{ 
                  width: isMobile ? '200px' : '300px', // Total width of each item (e.g., 60px for num + 140px card = 200px)
                  paddingLeft: isMobile ? '60px' : '100px', // Space for the number
                  marginRight: isMobile ? '12px' : '32px', // Gap between cards
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always',
                }}
              >
                <span className="absolute left-0 bottom-0 font-black text-9xl md:text-[150px] lg:text-[200px] leading-none z-0 select-none pointer-events-none" style={{color: 'transparent', WebkitTextStroke: '2px gray', transform: 'translateZ(0)', filter: 'url(#svg-blur-filter)', textRendering: 'optimizeLegibility', textShadow: '0 0 1px gray'}}>{index + 1}</span>
                <ContentCard content={content} onPlay={onPlay} className="relative z-10 w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Top10ContentRow; 
import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Content } from '../../stores/contentStore';
import ContentCard from './ContentCard';

interface ContentRowProps {
  title: string;
  contents: Content[];
  onPlay?: (content: Content) => void;
}

const ContentRow = ({ title, contents, onPlay }: ContentRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;

    const scrollAmount = rowRef.current.clientWidth * 0.75;
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - scrollAmount)
      : scrollPosition + scrollAmount;

    rowRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });

    setScrollPosition(newPosition);
  };

  return (
    <div 
      className="group/row relative my-8 z-0 px-4 md:px-12"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      
      <div className="relative">
        {showControls && contents.length > 4 && (
          <>
            <button 
              className={`absolute -left-8 top-0 bottom-0 z-40 w-8 bg-black/50 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 ${
                scrollPosition <= 0 ? 'invisible' : 'visible'
              }`}
              onClick={() => handleScroll('left')}
              aria-label="Scroll left"
            >
              <ChevronLeft className="text-white mx-auto" size={24} />
            </button>
            
            <button 
              className="absolute -right-8 top-0 bottom-0 z-40 w-8 bg-black/50 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
              onClick={() => handleScroll('right')}
              aria-label="Scroll right"
            >
              <ChevronRight className="text-white mx-auto" size={24} />
            </button>
          </>
        )}
        
        <div 
          ref={rowRef}
          className="flex gap-2 md:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {contents.map((content) => (
            <div 
              key={content.id} 
              className="flex-none relative snap-start"
            >
              <ContentCard content={content} onPlay={onPlay} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContentRow;
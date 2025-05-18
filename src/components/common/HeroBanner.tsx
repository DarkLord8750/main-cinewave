import { useNavigate } from 'react-router-dom';
import { Play, Info } from 'lucide-react';
import { Content } from '../../stores/contentStore';

interface HeroBannerProps {
  content: Content;
}

const HeroBanner = ({ content }: HeroBannerProps) => {
  const navigate = useNavigate();

  const handlePlay = () => {
    navigate(`/movie/${content.id}`);
  };

  return (
    <div className="relative w-full max-w-full h-[56.25vw] max-h-[80vh] min-h-[400px] overflow-hidden overflow-x-hidden bg-black">
      {/* Backdrop image */}
      <div className="absolute inset-0 z-0 max-w-full overflow-x-hidden">
        <img 
          src={content.backdropImage}
          alt={content.title}
          className="w-full h-full max-w-full object-cover object-center overflow-x-hidden"
        />
      </div>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/80 to-transparent"></div>
      
      {/* Content details */}
      <div className="absolute left-0 right-0 sm:left-8 sm:right-auto bottom-6 sm:bottom-12 z-10 max-w-full px-4">
        <h1 className="text-lg sm:text-2xl md:text-4xl font-bold text-white mb-3 break-words">{content.title}</h1>
        <p className="text-sm sm:text-base md:text-lg text-white max-w-xs sm:max-w-xl mb-5 line-clamp-3 break-words">{content.description}</p>
        <div className="flex flex-row gap-2 w-full max-w-xs sm:max-w-none">
          <button 
            className="flex items-center justify-center gap-1 bg-white text-black font-semibold py-2 px-4 rounded hover:bg-opacity-80 transition-all shadow w-auto text-sm"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
            onClick={handlePlay}
          >
            <Play size={16} fill="black" />
            Play
          </button>
          <button 
            className="flex items-center justify-center gap-1 bg-gray-700 bg-opacity-70 text-white font-semibold py-2 px-4 rounded hover:bg-gray-600 transition-all shadow w-auto text-sm"
          >
            <Info size={16} />
            More Info
          </button>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
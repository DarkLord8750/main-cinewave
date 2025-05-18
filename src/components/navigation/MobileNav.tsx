import { Link, useLocation } from 'react-router-dom';
import { Home, Search, List, Tv, Film } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const MobileNav = () => {
  const location = useLocation();
  const { isVideoPlaying } = useUIStore();
  
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  // Hide the navigation when video is playing
  if (isVideoPlaying) {
    return null;
  }
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-netflix-gray z-50 shadow-lg max-w-full overflow-x-hidden">
      <div className="flex justify-around items-center h-16 max-w-full overflow-x-hidden">
        <Link 
          to="/browse" 
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            isActive('/browse') ? 'text-netflix-red' : 'text-netflix-gray'
          }`}
        >
          <Home size={20} />
          <span className="text-xs mt-1">Home</span>
        </Link>
        
        <Link 
          to="/search" 
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            isActive('/search') ? 'text-netflix-red' : 'text-netflix-gray'
          }`}
        >
          <Search size={20} />
          <span className="text-xs mt-1">Search</span>
        </Link>
        
        <Link 
          to="/browse?type=series" 
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            location.search.includes('type=series') ? 'text-netflix-red' : 'text-netflix-gray'
          }`}
        >
          <Tv size={20} />
          <span className="text-xs mt-1">Series</span>
        </Link>
        
        <Link 
          to="/browse?type=movies" 
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            location.search.includes('type=movies') ? 'text-netflix-red' : 'text-netflix-gray'
          }`}
        >
          <Film size={20} />
          <span className="text-xs mt-1">Movies</span>
        </Link>
        
        <Link 
          to="/browse?list=my-list" 
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            location.search.includes('list=my-list') ? 'text-netflix-red' : 'text-netflix-gray'
          }`}
        >
          <List size={20} />
          <span className="text-xs mt-1">My List</span>
        </Link>
      </div>
    </nav>
  );
};

export default MobileNav;

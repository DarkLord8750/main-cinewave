import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import Logo from '../common/Logo';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { currentProfile, logout } = useAuthStore();
  const { isVideoPlaying } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/browse') {
      return location.pathname === '/browse' && !location.search;
    }
    return location.search.includes(path);
  };

  // Hide when video is playing
  if (isVideoPlaying) {
    return null;
  }

  return (
    <header 
      className={`fixed w-full max-w-full z-50 transition-colors duration-300 ${
        isScrolled ? 'bg-cinewave-black' : 'bg-gradient-to-b from-black/80 via-black/50 to-transparent'
      }`}
    >
      <div className="container mx-auto flex justify-between items-center py-4 px-4 md:px-6 max-w-full">
        <div className="flex items-center">
          <Link to="/browse" className="mr-8">
            <Logo />
          </Link>
          
          <nav className="hidden md:flex space-x-6">
            <Link 
              to="/browse" 
              className={`text-sm font-medium transition ${
                isActive('/browse') ? 'text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/browse?type=series" 
              className={`text-sm font-medium transition ${
                isActive('type=series') ? 'text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              TV Shows
            </Link>
            <Link 
              to="/browse?type=movies" 
              className={`text-sm font-medium transition ${
                isActive('type=movies') ? 'text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              Movies
            </Link>
            <Link 
              to="/browse?filter=new" 
              className={`text-sm font-medium transition ${
                isActive('filter=new') ? 'text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              New & Popular
            </Link>
            <Link 
              to="/browse?list=my-list" 
              className={`text-sm font-medium transition ${
                isActive('list=my-list') ? 'text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              My List
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/search')}
            className="text-white hover:text-gray-300 transition"
          >
            <Search size={20} />
          </button>
          
          <button className="text-white hover:text-gray-300 transition relative">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 bg-cinewave-red text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
              3
            </span>
          </button>
          
          <div className="relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="flex items-center space-x-2 group"
            >
              <img 
                src={currentProfile?.avatar || 'https://i.pravatar.cc/150?img=1'} 
                alt="Profile" 
                className="w-8 h-8 rounded"
              />
              <ChevronDown 
                className={`w-4 h-4 text-white transition-transform duration-200 ${
                  showDropdown ? 'rotate-180' : ''
                }`} 
              />
            </button>
            
            {showDropdown && (
              <div
                className="absolute right-0 mt-2 w-48 sm:w-56 bg-cinewave-black/95 border border-gray-800 rounded-xl shadow-2xl py-2 z-50 transition-all"
              >
                <div className="px-4 py-2 border-b border-gray-800">
                  <p className="text-white font-semibold text-sm">{currentProfile?.name || 'Profile'}</p>
                </div>
                <Link 
                  to="/profile" 
                  className="block px-4 py-2 text-gray-200 hover:bg-gray-800/80 rounded transition text-sm"
                  onClick={() => setShowDropdown(false)}
                >
                  Switch Profile
                </Link>
                <button 
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-gray-200 hover:bg-gray-800/80 rounded transition text-sm"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

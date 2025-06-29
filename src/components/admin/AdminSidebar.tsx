import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Film, Users, Settings, BarChart, LogOut, UserSquare } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import Logo from '../common/Logo';

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };
  
  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={18} /> },
    { name: 'Content', path: '/admin/content', icon: <Film size={18} /> },
    { name: 'Cast', path: '/admin/cast', icon: <UserSquare size={18} /> },
    { name: 'Users', path: '/admin/users', icon: <Users size={18} /> },
    { name: 'Analytics', path: '/admin/analytics', icon: <BarChart size={18} /> },
    { name: 'Settings', path: '/admin/settings', icon: <Settings size={18} /> },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-64 bg-black h-screen flex flex-col shadow-lg sticky top-0">
      <div className="p-6 border-b border-gray-700">
        <Link to="/admin">
          <Logo />
        </Link>
        <div className="text-white text-sm mt-2">Admin Panel</div>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center px-6 py-3 text-sm ${
                  isActive(item.path)
                    ? 'bg-[#E50914] text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                } transition-colors`}
              >
                <span className="mr-3">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded transition-colors"
        >
          <LogOut size={18} className="mr-3" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;

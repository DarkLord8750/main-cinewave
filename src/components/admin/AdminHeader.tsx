import { Bell, UserCircle, Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const AdminHeader = () => {
  const { user } = useAuthStore();

  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">Manage your CineWave platform</p>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="text-gray-600 hover:text-gray-800 relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 bg-[#E50914] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            5
          </span>
        </button>
        
        <button className="text-gray-600 hover:text-gray-800">
          <Settings size={20} />
        </button>
        
        <div className="flex items-center space-x-2">
          <span className="text-gray-800 font-medium hidden md:inline-block">
            {user?.email}
          </span>
          <UserCircle size={32} className="text-gray-600" />
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
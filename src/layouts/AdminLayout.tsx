import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import AdminSidebar from '../components/admin/AdminSidebar';
import ProfilePage from '../pages/ProfilePage';
import { useState } from 'react';
import { Settings } from 'lucide-react';

const AdminLayout = () => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const [showProfileModal, setShowProfileModal] = useState(false);

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If not an admin, redirect to browse
  if (!user?.isAdmin) {
    return <Navigate to="/browse" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <AdminSidebar />
      
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Manage your CineWave platform</p>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-600 hover:text-gray-800" onClick={() => setShowProfileModal(true)}>
              <Settings size={20} />
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-gray-800 font-medium hidden md:inline-block">{user?.email}</span>
              <img
                className="h-8 w-8 rounded-full border"
                src={user?.profiles?.[0]?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user?.email || 'Admin')}
                alt="Admin"
              />
            </div>
          </div>
        </header>

        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="rounded-lg shadow-lg p-6 relative w-full max-w-lg bg-transparent">
              <ProfilePage forceEdit onClose={() => setShowProfileModal(false)} />
            </div>
          </div>
        )}
        <main className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
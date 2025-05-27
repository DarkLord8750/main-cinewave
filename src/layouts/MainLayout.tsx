import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Navbar from '../components/navigation/Navbar';
import MobileNav from '../components/navigation/MobileNav';
import Footer from '../components/common/Footer';

const MainLayout = () => {
  const { isAuthenticated, hasSelectedProfile } = useAuthStore();
  const location = useLocation();

  // Scroll to top on every route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated but profile not selected (except for profile page)
  if (isAuthenticated && !hasSelectedProfile && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="min-h-screen bg-netflix-dark flex flex-col overflow-x-hidden">
      <Navbar />
      
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
};

export default MainLayout;

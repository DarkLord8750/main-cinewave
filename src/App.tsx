import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import BrowsePage from './pages/BrowsePage';
import MoviePage from './pages/MoviePage';
import SearchPage from './pages/SearchPage';
import AdminDashboard from './pages/admin/Dashboard';
import AdminContent from './pages/admin/Content';
import AdminUsers from './pages/admin/Users';
import AdminAnalytics from './pages/admin/analytics';
import NotFoundPage from './pages/NotFoundPage';
import SeriesPage from './pages/SeriesPage';

// Layout
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';

function App() {
  const { isAuthenticated, hasSelectedProfile, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated && 
        !location.pathname.includes('/login') && 
        !location.pathname.includes('/register') &&
        !location.pathname.includes('/forgot-password') &&
        !location.pathname.includes('/reset-password')) {
      navigate('/login');
    } else if (isAuthenticated && user?.isAdmin && location.pathname === '/browse') {
      // Redirect admin to admin dashboard from browse page
      navigate('/admin');
    } else if (isAuthenticated && !user?.isAdmin && location.pathname.includes('/admin')) {
      // Redirect non-admin users away from admin pages
      navigate('/browse');
    } else if (isAuthenticated && !hasSelectedProfile && 
               !location.pathname.includes('/profile') && 
               !location.pathname.includes('/admin')) {
      navigate('/profile');
    }
  }, [isAuthenticated, hasSelectedProfile, user, navigate, location]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      
      {/* Protected routes */}
      <Route element={<MainLayout />}>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/movie/:id" element={<MoviePage />} />
        <Route path="/series/:id" element={<SeriesPage />} />
        <Route path="/search" element={<SearchPage />} />
      </Route>
      
      {/* Admin routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

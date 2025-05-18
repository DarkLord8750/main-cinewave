import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Logo from '../components/common/Logo';

const AuthLayout = () => {
  const { isAuthenticated, hasSelectedProfile } = useAuthStore();

  // If user is authenticated and has selected a profile, redirect to browse
  if (isAuthenticated && hasSelectedProfile) {
    return <Navigate to="/browse" replace />;
  }

  // If user is authenticated but has not selected a profile, redirect to profile selection
  if (isAuthenticated && !hasSelectedProfile) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="p-4 md:p-6">
        <div className="container mx-auto">
          <Logo />
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
      
      <footer className="py-8 text-netflix-gray">
        <div className="container mx-auto text-center">
          <p>© {new Date().getFullYear()} CineWave</p>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    
    if (!email || !password) {
      return;
    }

    if (!isValidEmail(email)) {
      return;
    }

    if (password.length < 6) {
      return;
    }
    
    try {
      await login(email, password);
      if (!error) {
        navigate('/profile');
      }
    } catch (error) {
      // Error is handled in the store
    }
  };

  return (
    <div className="bg-black/75 w-full max-w-md p-8 md:p-12 rounded-md animate-fade-in">
      <h1 className="text-3xl font-bold mb-6">Sign In</h1>
      
      {error && (
        <div className="bg-[#E50914]/20 border border-[#E50914] text-white p-4 rounded mb-4 relative">
          <p>{error}</p>
          <button
            onClick={clearError}
            className="absolute top-2 right-2 text-white"
            aria-label="Close error message"
          >
            &times;
          </button>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="relative">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="netflix-input peer pt-6"
              placeholder=" "
              required
            />
            <label
              htmlFor="email"
              className="absolute text-sm text-gray-400 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3"
            >
              Email
            </label>
          </div>
          {email && !isValidEmail(email) && (
            <p className="text-netflix-red text-sm mt-1">Please enter a valid email address.</p>
          )}
        </div>
        
        <div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="netflix-input peer pt-6"
              placeholder=" "
              required
              minLength={6}
            />
            <label
              htmlFor="password"
              className="absolute text-sm text-gray-400 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-400"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {password && password.length < 6 && (
            <p className="text-netflix-red text-sm mt-1">Password must be at least 6 characters.</p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !email || !password || !isValidEmail(email) || password.length < 6}
          className={`w-full netflix-button py-3 ${
            (isLoading || !email || !password || !isValidEmail(email) || password.length < 6) 
              ? 'opacity-70 cursor-not-allowed' 
              : ''
          }`}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 border-gray-300 rounded accent-netflix-gray"
            />
            <label htmlFor="remember" className="ml-2 block text-sm text-gray-400">
              Remember me
            </label>
          </div>
          
          <Link to="/forgot-password" className="text-sm text-gray-400 hover:underline">
            Forgot Password?
          </Link>
        </div>
      </form>
      
      <div className="mt-8">
        <p className="text-gray-400">
          New to CineWave?{' '}
          <Link to="/register" className="text-white hover:underline">
            Sign up now
          </Link>
        </p>
        
        <p className="text-sm text-gray-500 mt-4">
          This page is protected by Google reCAPTCHA to ensure you're not a bot.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
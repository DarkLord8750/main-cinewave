import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { updatePassword, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Get hash from URL
    const hash = window.location.hash;
    if (!hash) {
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return;
    }

    try {
      await updatePassword(password);
      navigate('/login');
    } catch (error) {
      // Error is handled in the store
    }
  };

  return (
    <div className="bg-black/75 w-full max-w-md p-8 md:p-12 rounded-md animate-fade-in">
      <h1 className="text-3xl font-bold mb-6">Reset Password</h1>
      
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
              New Password
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

        <div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="netflix-input peer pt-6"
              placeholder=" "
              required
            />
            <label
              htmlFor="confirmPassword"
              className="absolute text-sm text-gray-400 duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3"
            >
              Confirm New Password
            </label>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-netflix-red text-sm mt-1">Passwords do not match.</p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !password || password.length < 6 || password !== confirmPassword}
          className={`w-full netflix-button py-3 ${
            (isLoading || !password || password.length < 6 || password !== confirmPassword) 
              ? 'opacity-70 cursor-not-allowed' 
              : ''
          }`}
        >
          {isLoading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { resetPassword, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;

    try {
      await resetPassword(email);
      setIsSubmitted(true);
    } catch (error) {
      // Error is handled in the store
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-black/75 w-full max-w-md p-8 md:p-12 rounded-md animate-fade-in">
        <h1 className="text-3xl font-bold mb-6">Email Sent</h1>
        <p className="text-gray-300 mb-6">
          If an account exists with the email you provided, you will receive a password reset link shortly.
        </p>
        <Link to="/login" className="netflix-button w-full text-center py-3 block">
          Return to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-black/75 w-full max-w-md p-8 md:p-12 rounded-md animate-fade-in">
      <h1 className="text-3xl font-bold mb-6">Forgot Password</h1>
      
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
          {email && !email.includes('@') && (
            <p className="text-netflix-red text-sm mt-1">Please enter a valid email.</p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !email || !email.includes('@')}
          className={`w-full netflix-button py-3 ${
            (isLoading || !email || !email.includes('@')) ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      
      <div className="mt-8">
        <p className="text-gray-400">
          Remember your password?{' '}
          <Link to="/login" className="text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
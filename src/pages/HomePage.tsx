import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Logo from '../components/common/Logo';
import { useAuthStore } from '../stores/authStore';

const HomePage = () => {
  const { isAuthenticated, hasSelectedProfile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && hasSelectedProfile) {
      navigate('/browse');
    } else if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, hasSelectedProfile, navigate]);

  const handleGetStarted = () => {
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative min-h-[65vh] sm:min-h-[80vh] flex flex-col">
        {/* Background image with overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://vyquhrtfwgwmndvhffjr.supabase.co/storage/v1/object/public/movies//cinewave_logo_light.png"
            alt="CineWave Background"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black"></div>
        </div>
        
        {/* Header */}
        <header className="relative z-10 p-4 md:p-6 flex justify-between items-center">
          <Logo size="lg" />
          
          <div className="flex items-center space-x-4">
            <select className="bg-black border border-white text-white px-3 py-1 rounded">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
            
            <button 
              onClick={() => navigate('/login')} 
              className="netflix-button"
            >
              Sign In
            </button>
          </div>
        </header>
        
        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 max-w-3xl">
            Unlimited movies, TV shows, and more
          </h1>
          
          <h2 className="text-xl md:text-2xl mb-6">
            Watch anywhere. Cancel anytime.
          </h2>
          
          <p className="text-lg md:text-xl mb-6">
            Ready to watch? Enter your email to create or restart your membership.
          </p>
          
          <div className="flex flex-col sm:flex-row w-full max-w-xl gap-3">
            <input 
              type="email" 
              placeholder="Email address" 
              className="netflix-input flex-1"
            />
            
            <button 
              onClick={handleGetStarted}
              className="netflix-button flex items-center justify-center text-lg sm:px-8"
            >
              Get Started
              <ChevronRight className="ml-2" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <section className="py-16 border-t-8 border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center py-12 max-w-6xl mx-auto">
            <div className="md:w-1/2 mb-8 md:mb-0 md:pr-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Enjoy on your TV</h2>
              <p className="text-lg md:text-xl text-gray-300">
                Watch on Smart TVs, Playstation, Xbox, Chromecast, Apple TV, Blu-ray players, and more.
              </p>
            </div>
            <div className="md:w-1/2 relative">
              <img 
                src="https://source.unsplash.com/featured/?tv" 
                alt="TV" 
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-16 border-t-8 border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row-reverse items-center py-12 max-w-6xl mx-auto">
            <div className="md:w-1/2 mb-8 md:mb-0 md:pl-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Download your shows to watch offline</h2>
              <p className="text-lg md:text-xl text-gray-300">
                Save your favorites easily and always have something to watch.
              </p>
            </div>
            <div className="md:w-1/2 relative">
              <img 
                src="https://source.unsplash.com/featured/?smartphone" 
                alt="Mobile device" 
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-16 border-t-8 border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center py-12 max-w-6xl mx-auto">
            <div className="md:w-1/2 mb-8 md:mb-0 md:pr-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Watch everywhere</h2>
              <p className="text-lg md:text-xl text-gray-300">
                Stream unlimited movies and TV shows on your phone, tablet, laptop, and TV.
              </p>
            </div>
            <div className="md:w-1/2 relative">
              <img 
                src="https://source.unsplash.com/featured/?devices" 
                alt="Multiple devices" 
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-16 border-t-8 border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row-reverse items-center py-12 max-w-6xl mx-auto">
            <div className="md:w-1/2 mb-8 md:mb-0 md:pl-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Create profiles for kids</h2>
              <p className="text-lg md:text-xl text-gray-300">
                Send kids on adventures with their favorite characters in a space made just for them—free with your membership.
              </p>
            </div>
            <div className="md:w-1/2 relative">
              <img 
                src="https://source.unsplash.com/featured/?kids" 
                alt="Kids profile" 
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* FAQ Section */}
      <section className="py-16 border-t-8 border-gray-800">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          
          <div className="space-y-2 mb-12">
            {[
              {
                question: "What is CineWave?",
                answer: "CineWave is a streaming service that offers a wide variety of award-winning TV shows, movies, anime, documentaries, and more on thousands of internet-connected devices."
              },
              {
                question: "How much does CineWave cost?",
                answer: "Watch CineWave on your smartphone, tablet, Smart TV, laptop, or streaming device, all for one fixed monthly fee. Plans range from $9.99 to $19.99 a month. No extra costs, no contracts."
              },
              {
                question: "Where can I watch?",
                answer: "Watch anywhere, anytime. Sign in with your CineWave account to watch instantly on the web from your personal computer or on any internet-connected device that offers the CineWave app."
              },
              {
                question: "How do I cancel?",
                answer: "CineWave is flexible. There are no pesky contracts and no commitments. You can easily cancel your account online in two clicks. There are no cancellation fees – start or stop your account anytime."
              },
              {
                question: "What can I watch on CineWave?",
                answer: "CineWave has an extensive library of feature films, documentaries, TV shows, anime, award-winning CineWave originals, and more. Watch as much as you want, anytime you want."
              }
            ].map((faq, index) => (
              <details
                key={index}
                className="bg-netflix-dark mb-2 rounded group"
              >
                <summary className="list-none p-4 flex justify-between items-center cursor-pointer text-xl font-medium hover:bg-netflix-gray/10">
                  {faq.question}
                  <span className="plus-icon relative w-6 h-6">
                    <span className="block absolute top-1/2 left-0 right-0 h-0.5 bg-white transform -translate-y-1/2 group-open:rotate-45 transition-transform"></span>
                    <span className="block absolute top-1/2 left-0 right-0 h-0.5 bg-white transform -translate-y-1/2 rotate-90 group-open:rotate-45 transition-transform"></span>
                  </span>
                </summary>
                <div className="p-4 border-t border-gray-700">
                  <p className="text-lg text-gray-300">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
          
          <div className="text-center">
            <p className="text-lg md:text-xl mb-6">
              Ready to watch? Enter your email to create or restart your membership.
            </p>
            
            <div className="flex flex-col sm:flex-row mx-auto max-w-xl gap-3">
              <input 
                type="email" 
                placeholder="Email address" 
                className="netflix-input flex-1"
              />
              
              <button 
                onClick={handleGetStarted}
                className="netflix-button flex items-center justify-center text-lg sm:px-8"
              >
                Get Started
                <ChevronRight className="ml-2" />
              </button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-16 border-t-8 border-gray-800 text-gray-400">
        <div className="container mx-auto px-4 max-w-5xl">
          <p className="mb-6">Questions? Call 1-800-NETFLIX</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:underline">FAQ</a></li>
              <li><a href="#" className="hover:underline">Investor Relations</a></li>
              <li><a href="#" className="hover:underline">Privacy</a></li>
              <li><a href="#" className="hover:underline">Speed Test</a></li>
            </ul>
            
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:underline">Help Center</a></li>
              <li><a href="#" className="hover:underline">Jobs</a></li>
              <li><a href="#" className="hover:underline">Cookie Preferences</a></li>
              <li><a href="#" className="hover:underline">Legal Notices</a></li>
            </ul>
            
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:underline">Account</a></li>
              <li><a href="#" className="hover:underline">Ways to Watch</a></li>
              <li><a href="#" className="hover:underline">Corporate Information</a></li>
              <li><a href="#" className="hover:underline">Only on CineWave</a></li>
            </ul>
            
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:underline">Media Center</a></li>
              <li><a href="#" className="hover:underline">Terms of Use</a></li>
              <li><a href="#" className="hover:underline">Contact Us</a></li>
            </ul>
          </div>
          
          <div className="mt-10">
            <select className="bg-black border border-gray-600 text-white px-3 py-1 rounded">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
            
            <p className="mt-6">CineWave Clone</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
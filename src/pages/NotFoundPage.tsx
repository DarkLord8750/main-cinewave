import { Link } from 'react-router-dom';
import Logo from '../components/common/Logo';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-netflix-black flex flex-col">
      <header className="p-6">
        <Logo />
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">Lost your way?</h1>
        
        <p className="text-xl md:text-2xl mb-8 max-w-xl">
          Sorry, we can't find that page. You'll find lots to explore on the home page.
        </p>
        
        <Link 
          to="/browse" 
          className="netflix-button py-3 px-8 text-lg"
        >
          CineWave Home
        </Link>
        
        <div className="mt-8 border-l-4 border-netflix-red pl-4 text-left">
          <p className="text-netflix-gray">Error Code: NSES-404</p>
        </div>
      </main>
    </div>
  );
};

export default NotFoundPage;
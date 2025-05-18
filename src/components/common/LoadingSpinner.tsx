const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-netflix-black">
      <div className="relative w-12 h-12">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-netflix-red/20 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-netflix-red rounded-full animate-spin border-t-transparent"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
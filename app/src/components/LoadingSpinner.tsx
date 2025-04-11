const LoadingSpinner = () => {
  return (
    <div className="pl-64 fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <img 
        src="https://media.tenor.com/I6kN-6X7nhAAAAAj/loading-buffering.gif" 
        alt="Loading..." 
        className="w-6 h-6"
      />
    </div>
  );
};

export default LoadingSpinner;
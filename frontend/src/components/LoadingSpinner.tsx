const LoadingSpinner = () => {
  return (
    <div className="ml-56 fixed inset-0 z-50 flex items-center justify-center bg-gray-100">
      <img 
        src="https://media.tenor.com/I6kN-6X7nhAAAAAj/loading-buffering.gif" 
        alt="Loading..." 
        className="w-6 h-6"
      />
    </div>
  );
};

export default LoadingSpinner;
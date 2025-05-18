import { Link } from 'react-router-dom';
import { HomeIcon } from '@heroicons/react/24/outline';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md text-center space-y-5">
        {/* Error Code */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 tracking-wide">
            ERROR 404
          </p>
          <h1 className="text-lg font-medium text-gray-900">
            Page not found
          </h1>
          <p className="text-xs text-gray-500">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Button */}
        <div>
          <Link
            to="/"
            className="inline-flex items-center h-[32px] px-3 text-xs font-medium rounded-md 
                     border border-gray-200 shadow-xs
                     bg-white text-gray-700 
                     hover:text-gray-900 
                     hover:border-gray-300 
                     transition-colors duration-200"
          >
            <HomeIcon className="mr-2 h-3.5 w-3.5" />
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
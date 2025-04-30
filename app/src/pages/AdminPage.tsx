import { HelpCircleIcon, GithubIcon, BookOpenIcon, HeartIcon } from 'lucide-react';

const AdminPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Overview</h1>
            <p className="text-xs text-gray-500 mt-1">
              A quick administrative overview of your Argon panel.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-md shadow-xs p-6">
            <img src="https://i.imgur.com/PFrLPtt.png" alt="Argon Logo" className="w-auto h-8 mt-2 mb-6" />
            <h2 className="text-sm font-medium text-gray-900">Argon 0.8.0 (Matisse)</h2>
            <p className="text-xs text-gray-500 mt-1">
              Your panel is up-to-date! The latest version of Argon is 0.8.0 (Matisse) under channel "stable" and was released on 2025-03-05.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6">
            <a href="https://discord.gg/qckQBHG8e3" className="bg-amber-50 shadow-xs transition border border-gray-200 
                           font-medium text-sm text-amber-700 py-2 px-4 rounded-md 
                           flex items-center space-x-2 hover:bg-amber-100">
              <HelpCircleIcon className="w-4 h-4" />
              <span>Get Help</span>
            </a>
            <a href="https://github.com/argon-foss" className="bg-indigo-50 shadow-xs transition border border-gray-200 
                           font-medium text-sm text-indigo-700 py-2 px-4 rounded-md 
                           flex items-center space-x-2 hover:bg-indigo-100">
              <GithubIcon className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <a href="https://docs.argon.software" className="bg-indigo-50 shadow-xs transition border border-gray-200 
                           font-medium text-sm text-indigo-700 py-2 px-4 rounded-md 
                           flex items-center space-x-2 hover:bg-indigo-100">
              <BookOpenIcon className="w-4 h-4" />
              <span>Documentation</span>
            </a>
            <button className="bg-green-50 shadow-xs transition border border-gray-200 
                           font-medium text-sm text-green-700 py-2 px-4 rounded-md 
                           flex items-center space-x-2 hover:bg-green-100">
              <HeartIcon className="w-4 h-4" />
              <span>Support the Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Sidebar, SidebarProvider, Navbar, useSidebar } from './components/Navigation';
import LoadingSpinner from './components/LoadingSpinner';
import { AuthProvider, ProtectedRoute, AuthPage } from './pages/[auth]/Auth';
import { SystemProvider } from './contexts/SystemContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { usePageTitle } from './hooks/usePageTitle';

const Servers = lazy(() => import('./pages/Servers'));
const Projects = lazy(() => import('./pages/Projects'));
const Profile = lazy(() => import('./pages/Profile'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// Admin endpoints
const AdminNodes = lazy(() => import('./pages/[admin]/Nodes'));
const AdminServers = lazy(() => import('./pages/[admin]/Servers'));
const AdminUnits = lazy(() => import('./pages/[admin]/Units'));
const AdminUsers = lazy(() => import('./pages/[admin]/Users'));
const AdminCargo = lazy(() => import('./pages/[admin]/Cargo'));
const AdminRegions = lazy(() => import('./pages/[admin]/Regions'));
const AdminAPIKeys = lazy(() => import('./pages/[admin]/APIKeys'));
const AdminSettings = lazy(() => import('./pages/[admin]/Settings')); // Import the new Settings page

// Servers
const ServerConsole = lazy(() => import('./pages/[server]/Console'));
const ServerFiles = lazy(() => import('./pages/[server]/Files'))
const ServerSettings = lazy(() => import('./pages/[server]/Settings'));

{/*

  .:::.   .:::.
 :::::::.:::::::
 :::::::::::::::
 ':::::::::::::'
   ':::::::::'
     ':::::'
       ':'
  
  * ily chelsea <3 *

  -----
  
  Argon 1.0 (Revenant)
  2025 (c) ether, and contributors

*/}

// Page transition variants with shadcn-inspired subtle animations
const pageTransitionVariants = {
  initial: {
    opacity: 0,
    y: 10
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: [0.16, 1, 0.3, 1], // Custom ease curve for subtle, professional feel
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.1,
      ease: [0.16, 1, 0.3, 1],
    }
  },
};

// Create a new component that contains the main app logic
function AppContent() {
  const location = useLocation();
  const { sidebarVisible } = useSidebar(); // Now this will work
  usePageTitle();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const initialRenderRef = useRef<boolean>(true);
  const loadingTimeoutRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const navigationInProgressRef = useRef<boolean>(false);
  const lastPathRef = useRef<string>(location.pathname);

  const noSidebarRoutes = ['/login', '/register', '/404'];
  const shouldHaveSidebar = !noSidebarRoutes.includes(location.pathname);

  // Reset loading state
  const resetLoading = () => {
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Use opacity transitions for smooth fade out
    setIsVisible(false);

    // After fade out, reset progress
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 300); // Match this with the CSS transition duration
  };

  // Complete loading animation with extended visibility at 100%
  const completeLoading = () => {
    if (!isLoading || !navigationInProgressRef.current) return;

    // Clear the progress interval
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    navigationInProgressRef.current = false;
    setProgress(100); // Set to 100% to ensure full width

    // Keep it visible at 100% width for a moment before fading
    setTimeout(() => {
      resetLoading();
    }, 500); // Longer delay to ensure the full bar is visible
  };

  // Track route changes, skip initial render and same-route navigations
  useEffect(() => {
    // Skip the first render
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      lastPathRef.current = location.pathname;
      return;
    }

    // Skip if navigating to the same path (internal navigation)
    if (lastPathRef.current === location.pathname) {
      return;
    }

    // Update the last path
    lastPathRef.current = location.pathname;

    // Prevent multiple loading indicators
    if (navigationInProgressRef.current) {
      resetLoading();
    }

    // Start loading sequence
    navigationInProgressRef.current = true;
    setIsLoading(true);
    setProgress(10);
    setIsVisible(true);

    // Animate progress smoothly
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90;
        if (prev < 30) return prev + 10;
        if (prev < 60) return prev + 5;
        if (prev < 75) return prev + 2;
        if (prev < 85) return prev + 1;
        return prev + 0.5;
      });
    }, 150);

    // Set a max loading time to prevent hanging
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
    }

    loadingTimeoutRef.current = window.setTimeout(() => {
      completeLoading();
    }, 8000); // 8 second max loading time

    return () => {
      if (progressIntervalRef.current !== null) {
        window.clearInterval(progressIntervalRef.current);
      }
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [location.pathname]);

  // Complete loading when animation completes
  useEffect(() => {
    const handleAnimationComplete = () => {
      // Only complete if we're loading and navigation is in progress
      if (isLoading && navigationInProgressRef.current) {
        // Short delay to account for any data fetching
        setTimeout(completeLoading, 300);
      }
    };

    // Listen for the main content to be loaded
    window.addEventListener('load', handleAnimationComplete);

    return () => {
      window.removeEventListener('load', handleAnimationComplete);
    };
  }, [isLoading]);

  return (
    <AuthProvider>
      <SystemProvider>
        <ProjectProvider>
          <div className="bg-[#f9fafb]">
            {/* Top loading bar with opacity transition */}
            <div
              className={`fixed top-0 left-0 w-full h-0.75 z-50 overflow-hidden transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="h-full bg-gradient-to-r from-[#3f3e9e] to-[#6866ff] transition-all ease-out"
                style={{
                  width: `${progress}%`,
                  transitionDuration: `${progress > 95 ? '0.2s' : '0.4s'}`
                }}
              />
            </div>

            {shouldHaveSidebar && (
              <>
                <Sidebar />
                <Navbar />
              </>
            )}
            <main
              className={`
                ${shouldHaveSidebar ? (sidebarVisible ? 'pl-56' : 'pl-0') : ''} 
                ${shouldHaveSidebar ? 'pt-14 m-4' : ''} 
                min-h-screen transition-all duration-300 ease-in-out relative
              `}
            >
              <Suspense fallback={
                <div className="flex items-center justify-center h-full min-h-[50vh]">
                  <LoadingSpinner />
                </div>
              }>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={location.pathname}
                    variants={pageTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="h-full w-full"
                    onAnimationComplete={() => {
                      // Complete loading when the page transition animation is done
                      if (navigationInProgressRef.current) {
                        completeLoading();
                      }
                    }}
                  >
                    <Routes location={location}>
                      <Route path="/login" element={<AuthPage />} />
                      <Route
                        path="/servers"
                        element={
                          <ProtectedRoute>
                            <Servers />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/projects"
                        element={
                          <ProtectedRoute>
                            <Projects />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute>
                            <AdminPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/" element={<Navigate to="/servers" />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="*" element={<NotFound />} />

                      <Route path="/admin/nodes" element={<AdminNodes />} />
                      <Route path="/admin/servers" element={<AdminServers />} />
                      <Route path="/admin/units" element={<AdminUnits />} />
                      <Route path="/admin/users" element={<AdminUsers />} />
                      <Route path="/admin/cargo" element={<AdminCargo />} />
                      <Route path="/admin/regions" element={<AdminRegions />} />
                      <Route path="/admin/api-keys" element={<AdminAPIKeys />} />
                      <Route path="/admin/settings" element={<AdminSettings />} /> {/* Add the new route */}

                      {/* Server routes */}
                      <Route
                        path="/servers/:id/console"
                        element={
                          <ProtectedRoute>
                            <ServerConsole />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/servers/:id/files"
                        element={
                          <ProtectedRoute>
                            <ServerFiles />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/servers/:id/settings"
                        element={
                          <ProtectedRoute>
                            <ServerSettings />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </main>
          </div>
        </ProjectProvider>
      </SystemProvider>
    </AuthProvider>
  );
}

// Update your main App component:
function App() {
  return (
    <SidebarProvider>
      <AppContent />
    </SidebarProvider>
  );
}

export default App;
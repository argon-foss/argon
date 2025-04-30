import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, lazy } from 'react';
import { Sidebar, SidebarProvider, Navbar } from './components/Navigation';
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

// Servers
const ServerConsole = lazy(() => import('./pages/[server]/Console'));
const ServerFiles = lazy(() => import('./pages/[server]/Files'))

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
  2025 (c) ether and contributors

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

function App() {
  const location = useLocation();
  usePageTitle();

  const noSidebarRoutes = ['/login', '/register', '/404'];
  const shouldHaveSidebar = !noSidebarRoutes.includes(location.pathname);

  return (
    <AuthProvider>
      <SystemProvider>
        <ProjectProvider>
          <SidebarProvider>
            <div className="bg-[#f9fafb]">
              {shouldHaveSidebar && (
                <>
                  <Sidebar />
                  <Navbar />
                </>
              )}
              <main 
                className={`
                  ${shouldHaveSidebar ? 'pl-56 pt-14 m-4' : ''} 
                  min-h-screen transition-all duration-200 ease-in-out relative
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
                      </Routes>
                    </motion.div>
                  </AnimatePresence>
                </Suspense>
              </main>
            </div>
          </SidebarProvider>
        </ProjectProvider>
      </SystemProvider>
    </AuthProvider>
  );
}

export default App;
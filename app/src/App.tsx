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

function App() {
  const location = useLocation();
  usePageTitle();

  const noSidebarRoutes = ['/login', '/register', '/404'];
  const shouldHaveSidebar = !noSidebarRoutes.includes(location.pathname);

  const pageVariants = {
    initial: {
      opacity: 0,
      scale: 0.98
    },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      transition: {
        duration: 0.2
      }
    }
  };

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
            <div className={`
              ${shouldHaveSidebar ? 'pl-56 pt-14 m-4' : ''} 
              min-h-screen transition-all duration-200 ease-in-out
            `}>
              <Suspense fallback={<LoadingSpinner />}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="h-full"
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
            </div>
          </div>
        </SidebarProvider>
        </ProjectProvider>
      </SystemProvider>
    </AuthProvider>
  );
}

export default App;
import { useState, useEffect, memo } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket } from '../utils/socket';
import { incrementUnread } from '../stores/chatStore';

const DashboardLayout = memo(function DashboardLayout() {
  const { user, token } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!token || !user) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const socket = connectSocket();
    const onConnect = () => {
      if (user?.role === 'admin' || user?.role === 'super_admin') {
        socket.emit('join:admin');
      } else if (user?._id) {
        socket.emit('join:user', user._id);
      }
    };
    onConnect();
    socket.on('connect', onConnect);
    const handler = (data) => {
      if (location.pathname !== '/live-chat') {
        incrementUnread();
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Chat Message', {
            body: data?.message || 'You have a new message',
            icon: '/favicon.ico'
          });
        }
      }
    };
    socket.on('chat:new', handler);
    return () => { socket.off('chat:new', handler); socket.off('connect', onConnect); };
  }, [token, user, location.pathname]);

  if (!token || !user) {
    return <Navigate to="/login" />;
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className={`min-h-screen ${isAdmin ? 'admin-bg' : 'bg-[#0f0f1a]'}`}>
      {isAdmin && (
        <>
          <div className="admin-orb admin-orb-1 hidden sm:block" />
          <div className="admin-orb admin-orb-2 hidden sm:block" />
          <div className="admin-orb admin-orb-3 hidden sm:block" />
          <div className="admin-ring admin-ring-1 hidden sm:block" />
          <div className="admin-ring admin-ring-2 hidden sm:block" />
          <div className="admin-shape admin-diamond admin-diamond-1 hidden sm:block" />
          <div className="admin-shape admin-diamond admin-diamond-2 hidden sm:block" />
          <div className="admin-shape admin-rect admin-rect-1 hidden sm:block" />
          <div className="admin-shape admin-rect admin-rect-2 hidden sm:block" />
        </>
      )}
      <div className="relative z-10">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
        <div className={`${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} transition-all duration-300`}>
          <Header setSidebarOpen={setSidebarOpen} collapsed={sidebarCollapsed} />
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 md:p-6 lg:p-8 pt-20"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </motion.main>
        </div>
      </div>
    </div>
  );
});
export default DashboardLayout;

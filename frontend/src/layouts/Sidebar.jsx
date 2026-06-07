import { useState, useEffect, useRef, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getUnreadCount, onUnreadChange } from '../stores/chatStore';
import SubscribePopup from '../components/SubscribePopup';
import {
  HiOutlineHome, HiOutlineChatAlt2, HiOutlineUsers, HiOutlinePhone,
  HiOutlineDocumentReport, HiOutlineCash, HiOutlineCog, HiOutlineCollection,
  HiOutlineCode, HiOutlineCube, HiOutlineMenuAlt2, HiOutlineX,
  HiOutlineLogout, HiOutlineShieldCheck, HiOutlineDocumentText,
  HiOutlineLightningBolt, HiOutlineChartBar, HiOutlineUserGroup,
  HiOutlineSparkles, HiOutlineCreditCard, HiOutlineCheckCircle,
  HiOutlineClipboardList, HiOutlineLockClosed, HiOutlineClock, HiOutlineDatabase,
  HiOutlineSwitchHorizontal, HiOutlineUpload, HiOutlineEye, HiOutlineRefresh, HiOutlineTrash,
  HiOutlineSearch, HiOutlineTrendingUp,
} from 'react-icons/hi';
import { FaWhatsapp, FaBrain, FaRobot } from 'react-icons/fa';

const ALWAYS_UNLOCKED = ['/dashboard', '/billing', '/wallet', '/reports', '/support', '/pricing', '/ai-assist', '/messages'];

const userNav = [
  { path: '/dashboard', label: 'Dashboard', icon: HiOutlineHome },
  { path: '/campaigns', label: 'Campaigns', icon: HiOutlineCollection },
  { path: '/bulk-sms', label: 'Bulk SMS', icon: HiOutlineChatAlt2 },
  { path: '/whatsapp', label: 'WhatsApp Sessions', icon: FaWhatsapp },
  { path: '/contacts', label: 'Contacts', icon: HiOutlineUsers },
  { path: '/messages', label: 'Messages', icon: HiOutlineChatAlt2 },
  { path: '/templates', label: 'Templates', icon: HiOutlineDocumentText },
  { path: '/automation', label: 'Automation', icon: HiOutlineLightningBolt },
  { path: '/workflow-builder', label: 'Flow Builder', icon: HiOutlineLightningBolt },
  { path: '/scheduled-campaigns', label: 'Scheduler', icon: HiOutlineClock },
  { path: '/reports', label: 'Reports', icon: HiOutlineDocumentReport },
  { path: '/analytics', label: 'Analytics', icon: HiOutlineChartBar },
  { path: '/billing', label: 'Billing', icon: HiOutlineCreditCard },
  { path: '/wallet', label: 'Wallet', icon: HiOutlineCash },
  { path: '/team', label: 'Team', icon: HiOutlineUserGroup },
  { path: '/ai-assist', label: 'AI Assist', icon: HiOutlineSparkles },
  { path: '/knowledge-base', label: 'Knowledge Base', icon: FaBrain },
  { path: '/group-scraper', label: 'Group Scraper', icon: HiOutlineUsers },
  { path: '/sms-fallback', label: 'SMS Fallback', icon: FaWhatsapp },
  { path: '/data-capture', label: 'Data Capture', icon: HiOutlineDatabase },
  { path: '/integrations', label: 'Integrations', icon: HiOutlineCube },
  { path: '/compliance', label: 'Compliance', icon: HiOutlineCheckCircle },
  { path: '/api-docs', label: 'API Docs', icon: HiOutlineCode },
  { path: '/support', label: 'Support', icon: FaWhatsapp },
  { path: '/settings', label: 'Settings', icon: HiOutlineCog },
  { path: '/auto-reply', label: 'Auto Reply', icon: HiOutlineSwitchHorizontal },
  { path: '/follow-up', label: 'Follow-up', icon: HiOutlineRefresh },
  { path: '/crm', label: 'CRM', icon: HiOutlineTrendingUp },
  { path: '/cleanup', label: 'Cleanup', icon: HiOutlineTrash },
  { path: '/import-contacts', label: 'Import Contacts', icon: HiOutlineUpload },
  { path: '/message-preview', label: 'Preview', icon: HiOutlineEye },
];

const superAdminNav = [
  { section: 'Admin', items: [
    { path: '/admin/dashboard', label: 'Admin Panel', icon: HiOutlineShieldCheck },
    { path: '/admin/audit', label: 'Audit Log', icon: HiOutlineClipboardList },
    { path: '/live-chat', label: 'Live Chat', icon: FaWhatsapp },
  ]},
];

const Sidebar = memo(function Sidebar({ isOpen, setIsOpen, collapsed, setCollapsed }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [chatUnread, setChatUnread] = useState(getUnreadCount());
  const [showLockPopup, setShowLockPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sidebarRef = useRef(null);

  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => onUnreadChange(setChatUnread), []);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const credits = user?.credits || 0;
  const creditsExhausted = credits <= 0 && !isAdmin;

  const isActive = (path) => location.pathname === path;

  const isPathLocked = (path) => {
    if (isAdmin) return false;
    if (!creditsExhausted) return false;
    return !ALWAYS_UNLOCKED.includes(path);
  };

  const NavLink = ({ item, onClick }) => {
    const Icon = item.icon;
    const locked = isPathLocked(item.path);

      if (locked) {
        return (
          <div
            onClick={() => setShowLockPopup(true)}
            className="flex items-center gap-3 px-4 lg:px-4 py-3 lg:py-3 rounded-xl transition-all duration-200 relative cursor-pointer opacity-50 text-gray-400 hover:bg-white/5"
          >
          <HiOutlineLockClosed className="text-lg lg:text-xl flex-shrink-0 text-orange-400" />
          {!collapsed && <span className="text-sm lg:text-sm font-medium flex-1">{item.label}</span>}
          {!collapsed && <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">Locked</span>}
        </div>
      );
    }

    return (
      <Link to={item.path} onClick={onClick}>
        <div className={`flex items-center gap-3 px-4 lg:px-4 py-3 lg:py-3 rounded-xl transition-all duration-200 relative
          ${isActive(item.path) ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Icon className="text-lg lg:text-xl flex-shrink-0" />
          {!collapsed && <span className="text-sm lg:text-sm font-medium">{item.label}</span>}
          {item.path === '/live-chat' && chatUnread > 0 && (
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{chatUnread > 99 ? '99+' : chatUnread}</span>
          )}
        </div>
      </Link>
    );
  };

  const NavSection = ({ title, items }) => (
    <>
      <div className="border-t border-white/10 my-4" />
      <p className="text-xs text-gray-500 px-4 mb-2 uppercase tracking-wider">{title}</p>
      {items.map(item => (
        <NavLink key={item.path} item={item} onClick={() => setIsOpen(false)} />
      ))}
    </>
  );

  return (
    <>
      <button
        className="fixed top-3 left-3 z-50 lg:hidden bg-purple-700 p-2.5 rounded-xl text-white shadow-lg hover:bg-purple-600 transition-all"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle sidebar"
      >
        {isOpen ? <HiOutlineX size={20} /> : <HiOutlineMenuAlt2 size={20} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black lg:hidden z-30"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {!isDesktop && !isOpen && (
        <motion.div
          className="fixed left-0 top-0 w-5 h-full z-30"
          drag="x"
          dragConstraints={{ left: 0, right: 300 }}
          dragElastic={0.2}
          onDragEnd={(_, { offset }) => {
            if (offset.x > 80) setIsOpen(true);
          }}
          style={{ touchAction: 'none' }}
        />
      )}

      <motion.aside
        ref={sidebarRef}
        initial={false}
        animate={{ x: isDesktop ? 0 : (isOpen ? 0 : '-100%') }}
        transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
        drag={isDesktop ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, { offset }) => {
          if (offset.x > 80) setIsOpen(true);
          else if (offset.x < -80) setIsOpen(false);
        }}
        whileTap={{ cursor: 'grabbing' }}
        style={{ touchAction: 'pan-y' }}
        className={`fixed top-0 left-0 h-full z-40 bg-gradient-to-b from-[#1e0b4a] via-[#0f0326] to-[#1a0533] border-r border-white/5 overflow-y-auto sidebar-scroll ${collapsed ? 'w-full sm:w-20' : 'w-full sm:w-64'}`}
      >
        <div className="p-5 lg:p-6 border-b border-white/10">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
            <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              <picture><source srcSet="/logo.webp" type="image/webp" /><img src="/logo.jpeg" alt="RSendix.pro" className="w-full h-full object-cover" /></picture>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-white font-bold text-base lg:text-lg truncate">RSendix.pro</h1>
                <p className="text-gray-400 text-xs lg:text-xs truncate hidden sm:block">SMART BULK MESSAGING PLATFORM</p>
              </div>
            )}
          </Link>
        </div>

        <div className="px-4 pt-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full py-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all text-xs"
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>

        {!collapsed && (
          <div className="px-4 mb-2 relative">
            <HiOutlineSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 text-base" />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        )}

        <nav className="p-4 sm:p-4 space-y-1">
          {userNav
            .filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(item => (
            <NavLink key={item.path} item={item} onClick={() => setIsOpen(false)} />
          ))}

          {isSuperAdmin && superAdminNav.map(section => ({
            ...section,
            items: section.items.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
          })).filter(section => section.items.length > 0).map(section => (
            <NavSection key={section.section} title={section.section} items={section.items} />
          ))}
        </nav>

        <div className="sticky bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-gradient-to-b from-transparent via-[#16213e] to-[#0f3460]">
          <div className="flex items-center gap-3 px-4 sm:px-4 py-3 sm:py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-gray-500 text-xs truncate capitalize">{user?.role || 'user'}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => { logout(); setIsOpen(false); }}
            className="flex items-center gap-3 px-4 py-3 sm:py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <HiOutlineLogout className="text-xl flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </motion.aside>

      <SubscribePopup
        isOpen={showLockPopup}
        onClose={() => setShowLockPopup(false)}
        message="Your credits are finished. Please Subscribe to continue."
      />
    </>
  );
});
export default Sidebar;

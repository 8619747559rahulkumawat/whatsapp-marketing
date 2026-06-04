import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineX, HiOutlineBookOpen, HiOutlineSearch, HiOutlineLightBulb, HiOutlineChevronDown } from 'react-icons/hi';
import { useState, useEffect } from 'react';

const features = [
  { name: 'Dashboard', icon: '📊', desc: 'App ka overview — total contacts, campaigns, messages aur reports ka summary.', how: 'Login ke baad pehla page. Yahan sab kuch ek nazar me dekhe.' },
  { name: 'Campaigns', icon: '📢', desc: 'Bulk WhatsApp messages bhejne ke liye campaign create kare.', how: '1. Campaigns me jaye → Create Campaign click kare → 2. Contacts select kare → 3. Template choose kare → 4. Send kare ya schedule kare.' },
  { name: 'Bulk SMS', icon: '📱', desc: 'WhatsApp ke alawa SMS bhi bhej sakte hai.', how: 'Bulk SMS me jaye → Contacts select kare → Message likhe → Send kare.' },
  { name: 'WhatsApp Sessions', icon: '🔗', desc: 'Apna WhatsApp connect kare QR scan karke.', how: '1. WhatsApp Sessions me jaye → 2. Add Session click kare → 3. QR scan kare → 4. Connected ho jayega.' },
  { name: 'Contacts', icon: '👥', desc: 'Saare contacts manage kare — add, import, group, search.', how: 'Contacts me jaye → Manual add kare ya Import CSV/Excel se → Groups me organize kare.' },
  { name: 'Messages', icon: '💬', desc: 'Incoming aur outgoing messages dekhe aur reply kare.', how: 'Messages me jaye → Kisi bhi chat par click kare → Reply type kare → Send kare.' },
  { name: 'Templates', icon: '📝', desc: 'Frequently used messages ko template me save kare.', how: 'Templates me jaye → New Template → Name + Message likhe → Save kare.' },
  { name: 'Automation', icon: '⚡', desc: 'Automatic workflows banaye — new contact par welcome message, follow-up etc.', how: 'Automation me jaye → Create Rule → Trigger select kare → Action select kare → Save kare.' },
  { name: 'Flow Builder', icon: '🔀', desc: 'Visual drag-drop se complex automation banaye.', how: 'Flow Builder me jaye → Nodes drag kare → Connect kare → Save & Deploy kare.' },
  { name: 'Scheduler', icon: '⏰', desc: 'Campaigns ko future date/time par schedule kare.', how: 'Campaign create karte waqt "Schedule" option select kare → Date/Time set kare.' },
  { name: 'Reports', icon: '📈', desc: 'Campaign reports dekhe — sent, delivered, read, failed.', how: 'Reports me jaye → Campaign select kare → Analytics dekhe.' },
  { name: 'Analytics', icon: '📊', desc: 'Deep analytics — click tracking, conversion funnel, performance.', how: 'Analytics me jaye → Date range select kare → Charts aur metrics dekhe.' },
  { name: 'Billing', icon: '💳', desc: 'Subscription plans, payment history aur invoice dekhe.', how: 'Billing me jaye → Plan select kare → Payment kare → Invoice download kare.' },
  { name: 'Wallet', icon: '💰', desc: 'Credits/balance check kare aur recharge kare.', how: 'Wallet me jaye → Balance dekhe → Recharge kare → Transactions history dekhe.' },
  { name: 'Team', icon: '👥', desc: 'Team members add kare aur permissions assign kare.', how: 'Team me jaye → Invite Member → Email dal → Role select kare → Send Invite.' },
  { name: 'AI Assist', icon: '🤖', desc: 'AI-powered smart replies aur message optimization.', how: 'AI Assist me jaye → Message likhe → AI suggest karega → Use kare.' },
  { name: 'Knowledge Base', icon: '📚', desc: 'FAQs aur solutions ka database.', how: 'Knowledge Base me jaye → Search kare ya browse kare → Solutions dekhe.' },
  { name: 'Group Scraper', icon: '🔄', desc: 'WhatsApp groups se members extract kare aur messages scrape kare.', how: 'Group Scraper me jaye → Session select kare → Group select kare → Scrape click kare.' },
  { name: 'SMS Fallback', icon: '📨', desc: 'WhatsApp fail hone par automatic SMS bhejta hai.', how: 'SMS Fallback me jaye → Enable kare → Settings configure kare.' },
  { name: 'Data Capture', icon: '🎯', desc: 'Website forms aur automation se leads capture kare.', how: 'Data Capture me jaye → Form create kare → Embed kare ya link share kare.' },
  { name: 'Integrations', icon: '🔌', desc: 'External tools aur APIs connect kare.', how: 'Integrations me jaye → Available integrations dekhe → Connect click kare → Setup complete kare.' },
  { name: 'Compliance', icon: '✅', desc: 'Opt-in/opt-out, DND scrub, consent logs aur GDPR compliance.', how: 'Compliance me jaye → Settings configure kare → Audit trail check kare.' },
  { name: 'API Docs', icon: '📄', desc: 'REST API documentation — developers ke liye.', how: 'API Docs me jaye → Endpoints dekhe → API key generate kare → Test kare.' },
  { name: 'Support', icon: '🎫', desc: 'Support ticket raise kare ya call kare admin ko.', how: 'Support me jaye → New Ticket → Issue describe kare → Submit kare.' },
  { name: 'Settings', icon: '⚙️', desc: 'Profile, password aur app settings manage kare.', how: 'Settings me jaye → Profile update kare → Password change kare → Preferences set kare.' },
  { name: 'Auto Reply', icon: '↩️', desc: 'Keywords set kare — auto reply bhejega jab koi word aaye.', how: 'Auto Reply me jaye → New Rule → Keyword set kare → Reply message likhe → Save kare.' },
  { name: 'Follow-up', icon: '🔄', desc: 'Important leads ke liye follow-up reminders set kare.', how: 'Follow-up me jaye → New Follow-up → Contact select → Date/Time set → Save kare.' },
  { name: 'CRM', icon: '🏢', desc: 'Deals, tasks, meetings, quotes, products — full CRM.', how: 'CRM me jaye → Deals manage kare → Tasks assign kare → Meetings schedule kare.' },
  { name: 'Cleanup', icon: '🧹', desc: 'Old/unused data cleanup kare.', how: 'Cleanup me jaye → Select options → Cleanup kare.' },
  { name: 'Import Contacts', icon: '📥', desc: 'CSV/Excel se bulk contacts import kare.', how: 'Import Contacts me jaye → File upload kare → Mapping check kare → Import kare.' },
  { name: 'Preview', icon: '👁️', desc: 'Message preview dekhe — send karne se pehle check kare.', how: 'Campaign create karte waqt Preview click kare.' },
];

export default function HelpGuide({ onClose }) {
  const [search, setSearch] = useState('');
  const [activeFeature, setActiveFeature] = useState(null);
  const [touchStart, setTouchStart] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const filtered = features.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.desc.toLowerCase().includes(search.toLowerCase())
  );

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientY);
  const handleTouchEnd = (e) => {
    if (touchStart && (touchStart - e.changedTouches[0].clientY) < -80) onClose();
    setTouchStart(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#1a1a2e] w-full sm:max-w-xl sm:rounded-2xl sm:mx-4 h-[92vh] sm:h-auto sm:max-h-[85vh] flex flex-col border border-white/10 overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="relative flex items-center justify-between px-3 sm:px-5 pt-2 pb-2 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <HiOutlineBookOpen className="text-purple-400 flex-shrink-0" size={18} />
            <h2 className="text-base sm:text-lg font-bold text-white truncate">Help Guide</h2>
            <span className="hidden sm:inline text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{filtered.length} features</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10">
            <HiOutlineX size={20} />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 top-1 sm:hidden w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="px-3 sm:px-5 pt-3 pb-2 border-b border-white/5 flex-shrink-0">
          <div className="flex gap-2 items-center bg-white/5 rounded-xl px-3 py-2 sm:py-2.5">
            <HiOutlineSearch className="text-gray-400 flex-shrink-0" size={16} />
            <input className="bg-transparent text-white text-sm flex-1 outline-none border-none placeholder:text-gray-500" placeholder="Feature search kare..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white text-xs p-1">✕</button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 space-y-1.5 overscroll-contain">
          <AnimatePresence>
            {filtered.map((f, i) => (
              <motion.div key={f.name} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                <div onClick={() => setActiveFeature(activeFeature === f.name ? null : f.name)}
                  className="p-3 sm:p-3.5 rounded-xl bg-white/5 active:bg-white/10 hover:bg-white/[0.07] cursor-pointer transition-all select-none">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="text-lg sm:text-xl flex-shrink-0">{f.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{f.name}</p>
                      <p className="text-gray-400 text-xs mt-px leading-relaxed line-clamp-2">{f.desc}</p>
                    </div>
                    <motion.div animate={{ rotate: activeFeature === f.name ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <HiOutlineChevronDown className="text-gray-500 flex-shrink-0" size={16} />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {activeFeature === f.name && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="mt-2.5 pt-2.5 border-t border-white/5">
                          <div className="flex items-start gap-2 bg-purple-500/10 p-2.5 sm:p-3 rounded-lg">
                            <HiOutlineLightBulb className="text-purple-400 mt-0.5 flex-shrink-0" size={15} />
                            <p className="text-purple-200 text-xs sm:text-sm leading-relaxed">{f.how}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm">No features found for "<span className="text-purple-400">{search}</span>"</p>
            </div>
          )}
        </div>
        <div className="px-3 sm:px-5 py-2.5 border-t border-white/5 flex-shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-gray-600">Admin: <a href="tel:+918617559759" className="text-purple-400 font-medium">+91 8619747559</a></p>
          <p className="text-[10px] text-gray-600">{filtered.length} / {features.length}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
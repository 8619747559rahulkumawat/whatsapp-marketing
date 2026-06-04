import { motion } from 'framer-motion';
import { HiOutlineX, HiOutlineBookOpen, HiOutlineSearch, HiOutlineLightBulb } from 'react-icons/hi';
import { useState } from 'react';

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
  const filtered = features.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.desc.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1a1a2e] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <HiOutlineBookOpen className="text-purple-400" size={20} />
            <h2 className="text-lg font-bold text-white">Help Guide</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"><HiOutlineX size={20} /></button>
        </div>
        <div className="p-4 border-b border-white/5">
          <div className="flex gap-3 items-center bg-white/5 rounded-xl px-3 py-2">
            <HiOutlineSearch className="text-gray-400" size={18} />
            <input className="bg-transparent text-white text-sm flex-1 outline-none border-none" placeholder="Feature search kare..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.map(f => (
            <div key={f.name} onClick={() => setActiveFeature(activeFeature === f.name ? null : f.name)}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all">
              <div className="flex items-center gap-3">
                <span className="text-xl">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{f.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{f.desc}</p>
                </div>
                <span className="text-gray-600 text-xs">{activeFeature === f.name ? '▲' : '▼'}</span>
              </div>
              {activeFeature === f.name && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-start gap-2">
                    <HiOutlineLightBulb className="text-purple-400 mt-0.5 flex-shrink-0" size={16} />
                    <p className="text-purple-300 text-sm">{f.how}</p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-8 text-gray-500">No features found</div>}
        </div>
        <div className="p-3 border-t border-white/5 text-center">
          <p className="text-[10px] text-gray-600">Need help? Call admin: <a href="tel:+918617559759" className="text-purple-400">+91 8619747559</a></p>
        </div>
      </motion.div>
    </motion.div>
  );
}
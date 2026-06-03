import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Pricing from './pages/Pricing';

import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import BulkSms from './pages/BulkSms';
import WhatsAppSessions from './pages/WhatsAppSessions';
import Contacts from './pages/Contacts';
import Messages from './pages/Messages';
import Reports from './pages/Reports';
import Wallet from './pages/Wallet';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import Settings from './pages/Settings';
import Support from './pages/Support';
import LiveChat from './pages/LiveChat';
import ApiDocs from './pages/ApiDocs';
import Templates from './pages/Templates';
import Compliance from './pages/Compliance';
import Billing from './pages/Billing';
import Analytics from './pages/Analytics';
import Team from './pages/Team';
import AIAssist from './pages/AIAssist';
import KnowledgeBase from './pages/KnowledgeBase';
import Automation from './pages/Automation';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Integrations from './pages/Integrations';
import ScheduledCampaigns from './pages/ScheduledCampaigns';
import GroupScraper from './pages/GroupScraper';
import SmsFallback from './pages/SmsFallback';
import DataCapture from './pages/DataCapture';
import Audit from './pages/Audit';
import AutoReply from './pages/AutoReply';
import Cleanup from './pages/Cleanup';
import ImportContacts from './pages/ImportContacts';
import MessagePreview from './pages/MessagePreview';
import FollowUp from './pages/FollowUp';

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;
  if (!token) return <Navigate to="/login" />;
  return children;
}

function AdminRoute({ children }) {
  const { token, user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" /></div>;
  if (!token) return <Navigate to="/login" />;
  if (user?.role !== 'admin' && user?.role !== 'super_admin') return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />

      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/whatsapp" element={<WhatsAppSessions />} />
        <Route path="/bulk-sms" element={<BulkSms />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/team" element={<Team />} />
        <Route path="/ai-assist" element={<AIAssist />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/workflow-builder" element={<WorkflowBuilder />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/scheduled-campaigns" element={<ScheduledCampaigns />} />
        <Route path="/group-scraper" element={<GroupScraper />} />
        <Route path="/sms-fallback" element={<SmsFallback />} />
        <Route path="/data-capture" element={<DataCapture />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/api-docs" element={<ApiDocs />} />
        <Route path="/support" element={<Support />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/auto-reply" element={<AutoReply />} />
        <Route path="/cleanup" element={<Cleanup />} />
        <Route path="/import-contacts" element={<ImportContacts />} />
        <Route path="/message-preview" element={<MessagePreview />} />
        <Route path="/follow-up" element={<FollowUp />} />
      </Route>

      <Route element={<AdminRoute><DashboardLayout /></AdminRoute>}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/audit" element={<Audit />} />
      </Route>

      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/live-chat" element={<LiveChat />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

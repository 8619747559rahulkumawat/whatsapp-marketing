import { Suspense, lazy, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'));
const BulkSms = lazy(() => import('./pages/BulkSms'));
const WhatsAppSessions = lazy(() => import('./pages/WhatsAppSessions'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Messages = lazy(() => import('./pages/Messages'));
const Reports = lazy(() => import('./pages/Reports'));
const Wallet = lazy(() => import('./pages/Wallet'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const Settings = lazy(() => import('./pages/Settings'));
const Support = lazy(() => import('./pages/Support'));
const LiveChat = lazy(() => import('./pages/LiveChat'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Templates = lazy(() => import('./pages/Templates'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Billing = lazy(() => import('./pages/Billing'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Team = lazy(() => import('./pages/Team'));
const AIAssist = lazy(() => import('./pages/AIAssist'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Automation = lazy(() => import('./pages/Automation'));
const WorkflowBuilder = lazy(() => import('./pages/WorkflowBuilder'));
const Integrations = lazy(() => import('./pages/Integrations'));
const ScheduledCampaigns = lazy(() => import('./pages/ScheduledCampaigns'));
const GroupScraper = lazy(() => import('./pages/GroupScraper'));
const SmsFallback = lazy(() => import('./pages/SmsFallback'));
const DataCapture = lazy(() => import('./pages/DataCapture'));
const Audit = lazy(() => import('./pages/Audit'));
const AutoReply = lazy(() => import('./pages/AutoReply'));
const Cleanup = lazy(() => import('./pages/Cleanup'));
const ImportContacts = lazy(() => import('./pages/ImportContacts'));
const MessagePreview = lazy(() => import('./pages/MessagePreview'));
const FollowUp = lazy(() => import('./pages/FollowUp'));
const Deals = lazy(() => import('./pages/Deals'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Email = lazy(() => import('./pages/Email'));
const Products = lazy(() => import('./pages/Products'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Meetings = lazy(() => import('./pages/Meetings'));
const WebForms = lazy(() => import('./pages/WebForms'));
const CrmDashboard = lazy(() => import('./pages/CrmDashboard'));
const EmailCampaigns = lazy(() => import('./pages/EmailCampaigns'));
const SmsCampaigns = lazy(() => import('./pages/SmsCampaigns'));
const EmailTemplates = lazy(() => import('./pages/EmailTemplates'));
const Goals = lazy(() => import('./pages/Goals'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Surveys = lazy(() => import('./pages/Surveys'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const Roles = lazy(() => import('./pages/Roles'));

function PageLoader() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!token) return <Navigate to="/login" />;
  return children;
}

function AdminRoute({ children }) {
  const { token, user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!token) return <Navigate to="/login" />;
  if (user?.role !== 'admin' && user?.role !== 'super_admin') return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
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
          <Route path="/deals" element={<Deals />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/email" element={<Email />} />
          <Route path="/products" element={<Products />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/webforms" element={<WebForms />} />
          <Route path="/crm" element={<CrmDashboard />} />
          <Route path="/email-campaigns" element={<EmailCampaigns />} />
          <Route path="/sms-campaigns" element={<SmsCampaigns />} />
          <Route path="/email-templates" element={<EmailTemplates />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/surveys" element={<Surveys />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/roles" element={<Roles />} />
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
    </Suspense>
  );
}

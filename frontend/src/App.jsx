import { Suspense, lazy, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import ErrorBoundary from './components/ErrorBoundary';

function lazyWithRetry(factory) {
  return lazy(() => factory().catch((err) => {
    console.error('[LazyLoad] Chunk load failed, retrying...', err);
    return new Promise((resolve) => {
      setTimeout(() => resolve(factory()), 1500);
    });
  }));
}

const Login = lazyWithRetry(() => import('./pages/Login'));
const Register = lazyWithRetry(() => import('./pages/Register'));
const Pricing = lazyWithRetry(() => import('./pages/Pricing'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Campaigns = lazyWithRetry(() => import('./pages/Campaigns'));
const CampaignDetail = lazyWithRetry(() => import('./pages/CampaignDetail'));
const BulkSms = lazyWithRetry(() => import('./pages/BulkSms'));
const WhatsAppSessions = lazyWithRetry(() => import('./pages/WhatsAppSessions'));
const Contacts = lazyWithRetry(() => import('./pages/Contacts'));
const Messages = lazyWithRetry(() => import('./pages/Messages'));
const Reports = lazyWithRetry(() => import('./pages/Reports'));
const Wallet = lazyWithRetry(() => import('./pages/Wallet'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsers'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const Support = lazyWithRetry(() => import('./pages/Support'));
const LiveChat = lazyWithRetry(() => import('./pages/LiveChat'));
const ApiDocs = lazyWithRetry(() => import('./pages/ApiDocs'));
const Templates = lazyWithRetry(() => import('./pages/Templates'));
const Compliance = lazyWithRetry(() => import('./pages/Compliance'));
const Billing = lazyWithRetry(() => import('./pages/Billing'));
const Analytics = lazyWithRetry(() => import('./pages/Analytics'));
const Team = lazyWithRetry(() => import('./pages/Team'));
const AIAssist = lazyWithRetry(() => import('./pages/AIAssist'));
const KnowledgeBase = lazyWithRetry(() => import('./pages/KnowledgeBase'));
const Automation = lazyWithRetry(() => import('./pages/Automation'));
const WorkflowBuilder = lazyWithRetry(() => import('./pages/WorkflowBuilder'));
const Integrations = lazyWithRetry(() => import('./pages/Integrations'));
const ScheduledCampaigns = lazyWithRetry(() => import('./pages/ScheduledCampaigns'));
const GroupScraper = lazyWithRetry(() => import('./pages/GroupScraper'));
const SmsFallback = lazyWithRetry(() => import('./pages/SmsFallback'));
const DataCapture = lazyWithRetry(() => import('./pages/DataCapture'));
const Audit = lazyWithRetry(() => import('./pages/Audit'));
const AutoReply = lazyWithRetry(() => import('./pages/AutoReply'));
const Cleanup = lazyWithRetry(() => import('./pages/Cleanup'));
const ImportContacts = lazyWithRetry(() => import('./pages/ImportContacts'));
const MessagePreview = lazyWithRetry(() => import('./pages/MessagePreview'));
const FollowUp = lazyWithRetry(() => import('./pages/FollowUp'));
const Deals = lazyWithRetry(() => import('./pages/Deals'));
const Tasks = lazyWithRetry(() => import('./pages/Tasks'));
const Email = lazyWithRetry(() => import('./pages/Email'));
const Products = lazyWithRetry(() => import('./pages/Products'));
const Quotes = lazyWithRetry(() => import('./pages/Quotes'));
const Meetings = lazyWithRetry(() => import('./pages/Meetings'));
const WebForms = lazyWithRetry(() => import('./pages/WebForms'));
const CrmDashboard = lazyWithRetry(() => import('./pages/CrmDashboard'));
const EmailCampaigns = lazyWithRetry(() => import('./pages/EmailCampaigns'));
const SmsCampaigns = lazyWithRetry(() => import('./pages/SmsCampaigns'));
const EmailTemplates = lazyWithRetry(() => import('./pages/EmailTemplates'));
const Goals = lazyWithRetry(() => import('./pages/Goals'));
const Contracts = lazyWithRetry(() => import('./pages/Contracts'));
const Surveys = lazyWithRetry(() => import('./pages/Surveys'));
const Webhooks = lazyWithRetry(() => import('./pages/Webhooks'));
const Roles = lazyWithRetry(() => import('./pages/Roles'));
const LeadScoring = lazyWithRetry(() => import('./pages/LeadScoring'));

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
    <ErrorBoundary>
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
          <Route path="/lead-scoring" element={<LeadScoring />} />
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
    </ErrorBoundary>
  );
}

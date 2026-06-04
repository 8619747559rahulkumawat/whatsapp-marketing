const translations = {
  // General
  helpGuide: { en: 'Help Guide', hi: 'सहायता गाइड' },
  features: { en: 'features', hi: 'सुविधाएं' },
  searchPlaceholder: { en: 'Search features...', hi: 'सुविधा खोजें...' },
  noFeatureFound: { en: 'No features found for', hi: 'के लिए कोई सुविधा नहीं मिली' },
  adminCall: { en: 'Need help? Call admin:', hi: 'मदद चाहिए? एडमिन को कॉल करें:' },
  howToUse: { en: 'How to use:', hi: 'कैसे उपयोग करें:' },

  // Features
  dashboard: { en: 'Dashboard', hi: 'डैशबोर्ड' },
  dashboardDesc: { en: 'App overview — total contacts, campaigns, messages and reports summary.', hi: 'एप्लिकेशन का अवलोकन — कुल संपर्क, अभियान, संदेश और रिपोर्ट का सारांश।' },
  dashboardHow: { en: 'First page after login. See everything at a glance here.', hi: 'लॉगिन के बाद पहला पेज। यहां सब कुछ एक नज़र में देखें।' },

  campaigns: { en: 'Campaigns', hi: 'अभियान' },
  campaignsDesc: { en: 'Create campaigns to send bulk WhatsApp messages.', hi: 'बल्क WhatsApp संदेश भेजने के लिए अभियान बनाएं।' },
  campaignsHow: { en: '1. Go to Campaigns → Create Campaign → 2. Select Contacts → 3. Choose Template → 4. Send or Schedule.', hi: '1. अभियान में जाएं → अभियान बनाएं → 2. संपर्क चुनें → 3. टेम्पलेट चुनें → 4. भेजें या शेड्यूल करें।' },

  bulkSms: { en: 'Bulk SMS', hi: 'बल्क SMS' },
  bulkSmsDesc: { en: 'Send SMS in addition to WhatsApp messages.', hi: 'WhatsApp संदेशों के अलावा SMS भी भेजें।' },
  bulkSmsHow: { en: 'Go to Bulk SMS → Select Contacts → Write Message → Send.', hi: 'बल्क SMS में जाएं → संपर्क चुनें → संदेश लिखें → भेजें।' },

  whatsappSessions: { en: 'WhatsApp Sessions', hi: 'WhatsApp सत्र' },
  whatsappSessionsDesc: { en: 'Connect your WhatsApp by scanning QR code.', hi: 'QR कोड स्कैन करके अपना WhatsApp कनेक्ट करें।' },
  whatsappSessionsHow: { en: '1. Go to WhatsApp Sessions → 2. Add Session → 3. Scan QR → 4. Connected!', hi: '1. WhatsApp सत्र में जाएं → 2. सत्र जोड़ें → 3. QR स्कैन करें → 4. कनेक्ट हो गया!' },

  contacts: { en: 'Contacts', hi: 'संपर्क' },
  contactsDesc: { en: 'Manage all contacts — add, import, group, search.', hi: 'सभी संपर्क प्रबंधित करें — जोड़ें, आयात करें, समूह बनाएं, खोजें।' },
  contactsHow: { en: 'Go to Contacts → Add manually or Import CSV/Excel → Organize in groups.', hi: 'संपर्क में जाएं → मैन्युअल जोड़ें या CSV/Excel आयात करें → समूहों में व्यवस्थित करें।' },

  messages: { en: 'Messages', hi: 'संदेश' },
  messagesDesc: { en: 'View incoming and outgoing messages and reply.', hi: 'आने वाले और भेजे गए संदेश देखें और जवाब दें।' },
  messagesHow: { en: 'Go to Messages → Click any chat → Type reply → Send.', hi: 'संदेश में जाएं → किसी भी चैट पर क्लिक करें → जवाब टाइप करें → भेजें।' },

  templates: { en: 'Templates', hi: 'टेम्पलेट' },
  templatesDesc: { en: 'Save frequently used messages as templates.', hi: 'बार-बार उपयोग होने वाले संदेशों को टेम्पलेट में सहेजें।' },
  templatesHow: { en: 'Go to Templates → New Template → Enter Name + Message → Save.', hi: 'टेम्पलेट में जाएं → नया टेम्पलेट → नाम + संदेश दर्ज करें → सहेजें।' },

  automation: { en: 'Automation', hi: 'ऑटोमेशन' },
  automationDesc: { en: 'Create automatic workflows — welcome message on new contact, follow-up etc.', hi: 'स्वचालित वर्कफ़्लो बनाएं — नए संपर्क पर स्वागत संदेश, फ़ॉलो-अप आदि।' },
  automationHow: { en: 'Go to Automation → Create Rule → Select Trigger → Select Action → Save.', hi: 'ऑटोमेशन में जाएं → नियम बनाएं → ट्रिगर चुनें → कार्रवाई चुनें → सहेजें।' },

  flowBuilder: { en: 'Flow Builder', hi: 'फ्लो बिल्डर' },
  flowBuilderDesc: { en: 'Create complex automations with visual drag-drop.', hi: 'विज़ुअल ड्रैग-ड्रॉप से जटिल ऑटोमेशन बनाएं।' },
  flowBuilderHow: { en: 'Go to Flow Builder → Drag nodes → Connect them → Save & Deploy.', hi: 'फ्लो बिल्डर में जाएं → नोड्स खींचें → कनेक्ट करें → सहेजें और डिप्लॉय करें।' },

  scheduler: { en: 'Scheduler', hi: 'शेड्यूलर' },
  schedulerDesc: { en: 'Schedule campaigns for future date/time.', hi: 'अभियानों को भविष्य की तारीख/समय पर शेड्यूल करें।' },
  schedulerHow: { en: 'While creating campaign, select "Schedule" option → Set Date/Time.', hi: 'अभियान बनाते समय "शेड्यूल" विकल्प चुनें → तारीख/समय सेट करें।' },

  reports: { en: 'Reports', hi: 'रिपोर्ट' },
  reportsDesc: { en: 'View campaign reports — sent, delivered, read, failed.', hi: 'अभियान रिपोर्ट देखें — भेजे गए, डिलीवर, पढ़े गए, विफल।' },
  reportsHow: { en: 'Go to Reports → Select Campaign → View Analytics.', hi: 'रिपोर्ट में जाएं → अभियान चुनें → एनालिटिक्स देखें।' },

  analytics: { en: 'Analytics', hi: 'एनालिटिक्स' },
  analyticsDesc: { en: 'Deep analytics — click tracking, conversion funnel, performance.', hi: 'गहन एनालिटिक्स — क्लिक ट्रैकिंग, कन्वर्ज़न फ़नल, प्रदर्शन।' },
  analyticsHow: { en: 'Go to Analytics → Select date range → View charts and metrics.', hi: 'एनालिटिक्स में जाएं → तारीख रेंज चुनें → चार्ट और मीट्रिक देखें।' },

  billing: { en: 'Billing', hi: 'बिलिंग' },
  billingDesc: { en: 'View subscription plans, payment history and invoices.', hi: 'सब्सक्रिप्शन प्लान, भुगतान इतिहास और इनवॉइस देखें।' },
  billingHow: { en: 'Go to Billing → Select Plan → Make Payment → Download Invoice.', hi: 'बिलिंग में जाएं → प्लान चुनें → भुगतान करें → इनवॉइस डाउनलोड करें।' },

  wallet: { en: 'Wallet', hi: 'वॉलेट' },
  walletDesc: { en: 'Check credits/balance and recharge.', hi: 'क्रेडिट/बैलेंस जांचें और रिचार्ज करें।' },
  walletHow: { en: 'Go to Wallet → Check Balance → Recharge → View Transaction History.', hi: 'वॉलेट में जाएं → बैलेंस जांचें → रिचार्ज करें → लेन-देन इतिहास देखें।' },

  team: { en: 'Team', hi: 'टीम' },
  teamDesc: { en: 'Add team members and assign permissions.', hi: 'टीम सदस्य जोड़ें और अनुमतियां असाइन करें।' },
  teamHow: { en: 'Go to Team → Invite Member → Enter Email → Select Role → Send Invite.', hi: 'टीम में जाएं → सदस्य को आमंत्रित करें → ईमेल दर्ज करें → भूमिका चुनें → आमंत्रण भेजें।' },

  aiAssist: { en: 'AI Assist', hi: 'AI सहायता' },
  aiAssistDesc: { en: 'AI-powered smart replies and message optimization.', hi: 'AI-संचालित स्मार्ट उत्तर और संदेश ऑप्टिमाइज़ेशन।' },
  aiAssistHow: { en: 'Go to AI Assist → Type your message → AI suggests → Use it.', hi: 'AI सहायता में जाएं → अपना संदेश लिखें → AI सुझाव देगा → उपयोग करें।' },

  knowledgeBase: { en: 'Knowledge Base', hi: 'नॉलेज बेस' },
  knowledgeBaseDesc: { en: 'Database of FAQs and solutions.', hi: 'FAQ और समाधानों का डेटाबेस।' },
  knowledgeBaseHow: { en: 'Go to Knowledge Base → Search or browse → View solutions.', hi: 'नॉलेज बेस में जाएं → खोजें या ब्राउज़ करें → समाधान देखें।' },

  groupScraper: { en: 'Group Scraper', hi: 'ग्रुप स्क्रैपर' },
  groupScraperDesc: { en: 'Extract members and scrape messages from WhatsApp groups.', hi: 'WhatsApp ग्रुप से सदस्य निकालें और संदेश स्क्रैप करें।' },
  groupScraperHow: { en: 'Go to Group Scraper → Select Session → Select Group → Click Scrape.', hi: 'ग्रुप स्क्रैपर में जाएं → सत्र चुनें → ग्रुप चुनें → स्क्रैप पर क्लिक करें।' },

  smsFallback: { en: 'SMS Fallback', hi: 'SMS फ़ॉलबैक' },
  smsFallbackDesc: { en: 'Automatically sends SMS when WhatsApp fails.', hi: 'WhatsApp विफल होने पर स्वचालित रूप से SMS भेजता है।' },
  smsFallbackHow: { en: 'Go to SMS Fallback → Enable → Configure Settings.', hi: 'SMS फ़ॉलबैक में जाएं → सक्षम करें → सेटिंग्स कॉन्फ़िगर करें।' },

  dataCapture: { en: 'Data Capture', hi: 'डेटा कैप्चर' },
  dataCaptureDesc: { en: 'Capture leads through website forms and automation.', hi: 'वेबसाइट फॉर्म और ऑटोमेशन के माध्यम से लीड कैप्चर करें।' },
  dataCaptureHow: { en: 'Go to Data Capture → Create Form → Embed or Share Link.', hi: 'डेटा कैप्चर में जाएं → फॉर्म बनाएं → एम्बेड करें या लिंक साझा करें।' },

  integrations: { en: 'Integrations', hi: 'इंटीग्रेशन' },
  integrationsDesc: { en: 'Connect external tools and APIs.', hi: 'बाहरी टूल और APIs कनेक्ट करें।' },
  integrationsHow: { en: 'Go to Integrations → View available → Click Connect → Setup Complete.', hi: 'इंटीग्रेशन में जाएं → उपलब्ध देखें → कनेक्ट पर क्लिक करें → सेटअप पूरा करें।' },

  compliance: { en: 'Compliance', hi: 'अनुपालन' },
  complianceDesc: { en: 'Opt-in/opt-out, DND scrub, consent logs and GDPR compliance.', hi: 'ऑप्ट-इन/ऑप्ट-आउट, DND स्क्रब, सहमति लॉग और GDPR अनुपालन।' },
  complianceHow: { en: 'Go to Compliance → Configure Settings → Check Audit Trail.', hi: 'अनुपालन में जाएं → सेटिंग्स कॉन्फ़िगर करें → ऑडिट ट्रेल जांचें।' },

  apiDocs: { en: 'API Docs', hi: 'API दस्तावेज़' },
  apiDocsDesc: { en: 'REST API documentation for developers.', hi: 'डेवलपर्स के लिए REST API दस्तावेज़।' },
  apiDocsHow: { en: 'Go to API Docs → View Endpoints → Generate API Key → Test.', hi: 'API दस्तावेज़ में जाएं → एंडपॉइंट देखें → API कुंजी जनरेट करें → टेस्ट करें।' },

  support: { en: 'Support', hi: 'सहायता' },
  supportDesc: { en: 'Raise support tickets or call admin.', hi: 'सहायता टिकट बनाएं या एडमिन को कॉल करें।' },
  supportHow: { en: 'Go to Support → New Ticket → Describe Issue → Submit.', hi: 'सहायता में जाएं → नया टिकट → समस्या बताएं → सबमिट करें।' },

  settings: { en: 'Settings', hi: 'सेटिंग्स' },
  settingsDesc: { en: 'Manage profile, password and app preferences.', hi: 'प्रोफ़ाइल, पासवर्ड और ऐप प्राथमिकताएं प्रबंधित करें।' },
  settingsHow: { en: 'Go to Settings → Update Profile → Change Password → Set Preferences.', hi: 'सेटिंग्स में जाएं → प्रोफ़ाइल अपडेट करें → पासवर्ड बदलें → प्राथमिकताएं सेट करें।' },

  autoReply: { en: 'Auto Reply', hi: 'ऑटो रिप्लाई' },
  autoReplyDesc: { en: 'Set keywords — auto-reply when a keyword is received.', hi: 'कीवर्ड सेट करें — जब कोई कीवर्ड आए तो ऑटो-रिप्लाई भेजें।' },
  autoReplyHow: { en: 'Go to Auto Reply → New Rule → Set Keyword → Write Reply → Save.', hi: 'ऑटो रिप्लाई में जाएं → नया नियम → कीवर्ड सेट करें → जवाब लिखें → सहेजें।' },

  followup: { en: 'Follow-up', hi: 'फ़ॉलो-अप' },
  followupDesc: { en: 'Set reminders for important leads.', hi: 'महत्वपूर्ण लीड के लिए रिमाइंडर सेट करें।' },
  followupHow: { en: 'Go to Follow-up → New Follow-up → Select Contact → Set Date/Time → Save.', hi: 'फ़ॉलो-अप में जाएं → नया फ़ॉलो-अप → संपर्क चुनें → तारीख/समय सेट करें → सहेजें।' },

  crm: { en: 'CRM', hi: 'CRM' },
  crmDesc: { en: 'Deals, tasks, meetings, quotes, products — full CRM.', hi: 'डील, कार्य, मीटिंग, कोट्स, उत्पाद — पूर्ण CRM।' },
  crmHow: { en: 'Go to CRM → Manage Deals → Assign Tasks → Schedule Meetings.', hi: 'CRM में जाएं → डील प्रबंधित करें → कार्य असाइन करें → मीटिंग शेड्यूल करें।' },

  cleanup: { en: 'Cleanup', hi: 'क्लीनअप' },
  cleanupDesc: { en: 'Clean up old/unused data.', hi: 'पुराने/अप्रयुक्त डेटा को साफ करें।' },
  cleanupHow: { en: 'Go to Cleanup → Select Options → Cleanup.', hi: 'क्लीनअप में जाएं → विकल्प चुनें → क्लीनअप करें।' },

  importContacts: { en: 'Import Contacts', hi: 'संपर्क आयात करें' },
  importContactsDesc: { en: 'Import bulk contacts from CSV/Excel.', hi: 'CSV/Excel से बल्क संपर्क आयात करें।' },
  importContactsHow: { en: 'Go to Import Contacts → Upload File → Check Mapping → Import.', hi: 'संपर्क आयात करें में जाएं → फ़ाइल अपलोड करें → मैपिंग जांचें → आयात करें।' },

  preview: { en: 'Preview', hi: 'पूर्वावलोकन' },
  previewDesc: { en: 'Preview message before sending.', hi: 'भेजने से पहले संदेश का पूर्वावलोकन करें।' },
  previewHow: { en: 'Click Preview while creating a campaign.', hi: 'अभियान बनाते समय पूर्वावलोकन पर क्लिक करें।' },
};

export const getTranslation = (key, lang) => {
  const t = translations[key];
  if (!t) return key;
  return t[lang] || t.en || key;
};

export const featureKeys = [
  'dashboard', 'campaigns', 'bulkSms', 'whatsappSessions', 'contacts',
  'messages', 'templates', 'automation', 'flowBuilder', 'scheduler',
  'reports', 'analytics', 'billing', 'wallet', 'team', 'aiAssist',
  'knowledgeBase', 'groupScraper', 'smsFallback', 'dataCapture',
  'integrations', 'compliance', 'apiDocs', 'support', 'settings',
  'autoReply', 'followup', 'crm', 'cleanup', 'importContacts', 'preview'
];

export const icons = {
  dashboard: '📊', campaigns: '📢', bulkSms: '📱', whatsappSessions: '🔗',
  contacts: '👥', messages: '💬', templates: '📝', automation: '⚡',
  flowBuilder: '🔀', scheduler: '⏰', reports: '📈', analytics: '📊',
  billing: '💳', wallet: '💰', team: '👥', aiAssist: '🤖',
  knowledgeBase: '📚', groupScraper: '🔄', smsFallback: '📨',
  dataCapture: '🎯', integrations: '🔌', compliance: '✅', apiDocs: '📄',
  support: '🎫', settings: '⚙️', autoReply: '↩️', followup: '🔄',
  crm: '🏢', cleanup: '🧹', importContacts: '📥', preview: '👁️'
};

export default translations;

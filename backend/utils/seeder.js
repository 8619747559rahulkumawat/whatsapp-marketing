const User = require('../models/User');
const Setting = require('../models/Setting');
const Tenant = require('../models/Tenant');

const seedTenant = async () => {
  try {
    const tenantExists = await Tenant.findOne({ name: 'Default Tenant' });
    if (!tenantExists) {
      const tenant = await Tenant.create({
        name: 'Default Tenant',
        domain: 'localhost',
        plan: 'professional',
        status: 'active',
        settings: {
          whatsapp: {
            webhookUrl: '',
            webhookToken: '',
            messageTemplateSync: false
          },
          notifications: {
            email: true,
            inApp: true
          },
          limits: {
            contacts: 10000,
            messagesPerDay: 50000,
            users: 10
          }
        },
        billing: {
          customerId: '',
          subscriptionId: '',
          currentPeriodEnd: null,
          invoiceDate: null
        }
      });
      
      console.log('Default tenant created successfully');
      return tenant;
    }
    return tenantExists;
  } catch (err) {
    console.error('Error seeding tenant:', err.message);
    throw err;
  }
};

const seedAdmin = async () => {
  try {
    // Ensure default tenant exists first
    const tenant = await seedTenant();
    
    // Create or update super admin (use create() to trigger pre-save hook for password hashing)
    const superAdminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    let admin = await User.findOne({ email: superAdminEmail });
    if (!admin) {
      admin = await User.create({
        name: 'Super Admin',
        email: superAdminEmail,
        password: process.env.ADMIN_PASSWORD || 'CHANGE_ME_ADMIN_PASSWORD_STRONG',
        role: 'super_admin',
        tenantId: tenant._id,
        credits: 999999,
        isActive: true
      });
      console.log('Super admin created');
    } else {
      // Update non-password fields only to avoid re-hashing
      Object.assign(admin, { role: 'super_admin', tenantId: tenant._id, credits: 999999, isActive: true });
      await admin.save();
      console.log('Super admin updated');
    }
    
    // Set tenant's createdBy to the super admin
    const currentTenant = await Tenant.findById(tenant._id);
    if (!currentTenant.createdBy) {
      await Tenant.findByIdAndUpdate(tenant._id, { createdBy: admin._id });
    }
    
    // Regular admin removed - only super admin remains
  } catch (err) {
    console.error('Error seeding admin:', err.message);
    throw err;
  }
};

const seedSettings = async () => {
  const defaults = [
    { key: 'siteName', value: 'RSendix.pro', description: 'Site name' },
    { key: 'siteLogo', value: '', description: 'Site logo URL' },
    { key: 'creditCost', value: { text: 1, media: 2, button: 2 }, description: 'Credit cost per message type' },
    { key: 'dailyMessageLimit', value: 1000, description: 'Default daily message limit per user' },
    { key: 'defaultDelay', value: 2000, description: 'Default delay between messages (ms)' },
    { key: 'maintenanceMode', value: false, description: 'Maintenance mode' },
    { key: 'registrationOpen', value: true, description: 'Allow new registrations' },
    { key: 'defaultCreds', value: 100, description: 'Default credits for new users' },
    { key: 'currency', value: 'INR', description: 'Currency code' },
    { key: 'whatsappVersion', value: 'v2', description: 'WhatsApp API version' }
  ];
  for (const setting of defaults) {
    await Setting.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: { ...setting } },
      { upsert: true, new: true }
    );
  }
  console.log('Default settings seeded');
};

const seedAll = async () => {
  try {
    await seedAdmin();
  } catch (err) {
    console.error('Seeding admin failed (non-fatal):', err.message);
  }
  try {
    await seedSettings();
  } catch (err) {
    console.error('Seeding settings failed (non-fatal):', err.message);
  }
};

module.exports = { seedAll, seedAdmin, seedSettings, seedTenant };

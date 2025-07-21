const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const User = require('../models/User');

const seedAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_vehicle_emergency');
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      userId: uuidv4(),
      name: 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@qrvehicle.com',
      phone: '+1234567890',
      password: process.env.ADMIN_PASSWORD || 'admin123456',
      role: 'admin',
      isOnline: false,
      preferences: {
        notifications: {
          calls: true,
          emergencies: true,
          marketing: false
        },
        privacy: {
          showName: true,
          showPhone: false
        }
      }
    });

    await adminUser.save();

    console.log('✅ Admin user created successfully');
    console.log('📧 Email:', adminUser.email);
    console.log('🔑 Password:', process.env.ADMIN_PASSWORD || 'admin123456');
    console.log('👤 User ID:', adminUser.userId);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

seedAdminUser();
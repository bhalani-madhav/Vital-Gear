#!/usr/bin/env node

/**
 * Database seeding script for RBAC data
 * Usage: node scripts/seed.js [--clear]
 */

const mongoose = require('mongoose');
const { seedRBACData, seedAllData, clearRBACData, validateRBACData } = require('../utils/seedData');
require('dotenv').config();

// Load all models to ensure they are registered
require('../models/Module');
require('../models/Permission');
require('../models/Role');
require('../models/User');
require('../models/Product');
require('../models/Cart');
require('../models/Order');

async function main() {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgear';
    console.log(`Connecting to MongoDB: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully!');

    // Check command line arguments
    const args = process.argv.slice(2);
    const shouldClear = args.includes('--clear');

    if (shouldClear) {
      console.log('\n=== Clearing RBAC Data ===');
      await clearRBACData();
      console.log('RBAC data cleared successfully!');
    } else {
      console.log('\n=== Seeding All Data ===');
      const result = await seedAllData();
      
      console.log('\n=== Seeding Summary ===');
      console.log(`Modules seeded: ${Object.keys(result.modules).length}`);
      console.log(`Permissions seeded: ${Object.keys(result.permissions).length}`);
      console.log(`Roles seeded: ${Object.keys(result.roles).length}`);
      console.log(`Admin user seeded: ${result.adminUser ? result.adminUser.email : 'None'}`);
      
      console.log('\n=== Validating Data ===');
      const isValid = await validateRBACData();
      
      if (isValid) {
        console.log('✅ All data seeded and validated successfully!');
        console.log('\n=== Default Admin Credentials ===');
        console.log('Email: admin@vitalgear.com');
        console.log('Password: Admin@1234');
        console.log('⚠️  Please change the default admin password after first login!');
      } else {
        console.log('❌ Data validation failed!');
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('Error during seeding operation:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
main();
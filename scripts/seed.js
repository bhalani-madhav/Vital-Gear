#!/usr/bin/env node

/**
 * Database seeding script for RBAC data
 * Usage: node scripts/seed.js [--clear]
 */

const mongoose = require('mongoose');
const { seedRBACData, clearRBACData, validateRBACData } = require('../utils/seedData');
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
      console.log('\n=== Seeding RBAC Data ===');
      const result = await seedRBACData();
      
      console.log('\n=== Seeding Summary ===');
      console.log(`Modules seeded: ${Object.keys(result.modules).length}`);
      console.log(`Permissions seeded: ${Object.keys(result.permissions).length}`);
      console.log(`Roles seeded: ${Object.keys(result.roles).length}`);
      
      console.log('\n=== Validating Data ===');
      const isValid = await validateRBACData();
      
      if (isValid) {
        console.log('✅ All RBAC data validated successfully!');
      } else {
        console.log('❌ RBAC data validation failed!');
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
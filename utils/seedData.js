const mongoose = require('mongoose');
const Module = require('../models/Module');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const User = require('../models/User');

// Define system modules
const MODULES = [
  {
    name: 'users',
    description: 'User management and profile operations'
  },
  {
    name: 'products',
    description: 'Product catalog management'
  },
  {
    name: 'orders',
    description: 'Order processing and management'
  },
  {
    name: 'cart',
    description: 'Shopping cart operations'
  },
  {
    name: 'admin',
    description: 'Administrative functions and system management'
  }
];

// Define permissions for each module
const PERMISSIONS = [
  // User module permissions
  { module: 'users', action: 'read', description: 'View user profiles and information' },
  { module: 'users', action: 'update', description: 'Update user profile information' },
  { module: 'users', action: 'delete', description: 'Delete user accounts' },
  
  // Product module permissions
  { module: 'products', action: 'read', description: 'View product catalog and details' },
  { module: 'products', action: 'create', description: 'Add new products to catalog' },
  { module: 'products', action: 'update', description: 'Update product information' },
  { module: 'products', action: 'delete', description: 'Remove products from catalog' },
  
  // Order module permissions
  { module: 'orders', action: 'read', description: 'View order information' },
  { module: 'orders', action: 'create', description: 'Create new orders' },
  { module: 'orders', action: 'update', description: 'Update order status and information' },
  
  // Cart module permissions
  { module: 'cart', action: 'read', description: 'View shopping cart contents' },
  { module: 'cart', action: 'create', description: 'Add items to shopping cart' },
  { module: 'cart', action: 'update', description: 'Update cart item quantities' },
  { module: 'cart', action: 'delete', description: 'Remove items from cart' },
  
  // Admin module permissions
  { module: 'admin', action: 'read', description: 'View administrative data and reports' },
  { module: 'admin', action: 'create', description: 'Create administrative records' },
  { module: 'admin', action: 'update', description: 'Update system settings and user roles' },
  { module: 'admin', action: 'delete', description: 'Delete administrative records' }
];

// Define default roles with their permissions
const ROLES = [
  {
    name: 'User',
    description: 'Standard user with basic access to platform features',
    permissions: [
      'users_read', 'users_update',
      'products_read',
      'orders_read', 'orders_create',
      'cart_read', 'cart_create', 'cart_update', 'cart_delete'
    ]
  },
  {
    name: 'Admin',
    description: 'Administrator with full access to all platform features',
    permissions: [
      'users_read', 'users_update', 'users_delete',
      'products_read', 'products_create', 'products_update', 'products_delete',
      'orders_read', 'orders_create', 'orders_update',
      'cart_read', 'cart_create', 'cart_update', 'cart_delete',
      'admin_read', 'admin_create', 'admin_update', 'admin_delete'
    ]
  }
];

/**
 * Seeds modules into the database
 * @returns {Promise<Object>} Map of module names to module documents
 */
async function seedModules() {
  console.log('Seeding modules...');
  const moduleMap = {};
  
  for (const moduleData of MODULES) {
    try {
      let module = await Module.findByName(moduleData.name);
      
      if (!module) {
        module = new Module(moduleData);
        await module.save();
        console.log(`Created module: ${module.name}`);
      } else {
        console.log(`Module already exists: ${module.name}`);
      }
      
      moduleMap[moduleData.name] = module;
    } catch (error) {
      console.error(`Error seeding module ${moduleData.name}:`, error.message);
      throw error;
    }
  }
  
  return moduleMap;
}

/**
 * Seeds permissions into the database
 * @param {Object} moduleMap - Map of module names to module documents
 * @returns {Promise<Object>} Map of permission names to permission documents
 */
async function seedPermissions(moduleMap) {
  console.log('Seeding permissions...');
  const permissionMap = {};
  
  for (const permissionData of PERMISSIONS) {
    try {
      const module = moduleMap[permissionData.module];
      if (!module) {
        throw new Error(`Module not found: ${permissionData.module}`);
      }
      
      const permissionName = `${permissionData.module}_${permissionData.action}`;
      let permission = await Permission.findByName(permissionName);
      
      if (!permission) {
        permission = new Permission({
          name: permissionName,
          description: permissionData.description,
          module: module._id,
          action: permissionData.action
        });
        await permission.save();
        console.log(`Created permission: ${permission.name}`);
      } else {
        console.log(`Permission already exists: ${permission.name}`);
      }
      
      permissionMap[permissionName] = permission;
    } catch (error) {
      console.error(`Error seeding permission ${permissionData.module}_${permissionData.action}:`, error.message);
      throw error;
    }
  }
  
  return permissionMap;
}/**
 * Se
eds roles into the database
 * @param {Object} permissionMap - Map of permission names to permission documents
 * @returns {Promise<Object>} Map of role names to role documents
 */
async function seedRoles(permissionMap) {
  console.log('Seeding roles...');
  const roleMap = {};
  
  for (const roleData of ROLES) {
    try {
      let role = await Role.findByName(roleData.name);
      
      if (!role) {
        // Get permission IDs for this role
        const permissionIds = roleData.permissions.map(permissionName => {
          const permission = permissionMap[permissionName];
          if (!permission) {
            throw new Error(`Permission not found: ${permissionName}`);
          }
          return permission._id;
        });
        
        role = new Role({
          name: roleData.name,
          description: roleData.description,
          permissions: permissionIds
        });
        await role.save();
        console.log(`Created role: ${role.name} with ${permissionIds.length} permissions`);
      } else {
        // Update existing role permissions if needed
        const permissionIds = roleData.permissions.map(permissionName => {
          const permission = permissionMap[permissionName];
          if (!permission) {
            throw new Error(`Permission not found: ${permissionName}`);
          }
          return permission._id;
        });
        
        // Check if permissions need updating
        const currentPermissionIds = role.permissions.map(id => id.toString());
        const newPermissionIds = permissionIds.map(id => id.toString());
        
        if (JSON.stringify(currentPermissionIds.sort()) !== JSON.stringify(newPermissionIds.sort())) {
          role.permissions = permissionIds;
          await role.save();
          console.log(`Updated role: ${role.name} with ${permissionIds.length} permissions`);
        } else {
          console.log(`Role already exists with correct permissions: ${role.name}`);
        }
      }
      
      roleMap[roleData.name] = role;
    } catch (error) {
      console.error(`Error seeding role ${roleData.name}:`, error.message);
      throw error;
    }
  }
  
  return roleMap;
}

/**
 * Seeds default admin user into the database
 * @param {Object} roleMap - Map of role names to role documents
 * @returns {Promise<Object>} Admin user document
 */
async function seedDefaultAdmin(roleMap) {
  try {
    console.log('Seeding default admin user...');
    
    const adminEmail = 'admin@vitalgear.com';
    const adminPassword = 'Admin@1234';
    
    // Check if admin user already exists
    let adminUser = await User.findByEmail(adminEmail);
    
    if (!adminUser) {
      // Get Admin role
      const adminRole = roleMap['Admin'];
      if (!adminRole) {
        throw new Error('Admin role not found. Please seed roles first.');
      }
      
      // Create admin user
      adminUser = new User({
        firstName: 'System',
        lastName: 'Administrator',
        email: adminEmail,
        password: adminPassword,
        role: adminRole._id,
        isActive: true
      });
      
      await adminUser.save();
      console.log(`Created default admin user: ${adminEmail}`);
    } else {
      console.log(`Default admin user already exists: ${adminEmail}`);
    }
    
    return adminUser;
  } catch (error) {
    console.error('Error seeding default admin user:', error.message);
    throw error;
  }
}

/**
 * Main seeding function that orchestrates the seeding process
 * @returns {Promise<Object>} Object containing seeded data maps
 */
async function seedRBACData() {
  try {
    console.log('Starting RBAC data seeding...');
    
    // Seed modules first
    const moduleMap = await seedModules();
    
    // Seed permissions (depends on modules)
    const permissionMap = await seedPermissions(moduleMap);
    
    // Seed roles (depends on permissions)
    const roleMap = await seedRoles(permissionMap);
    
    console.log('RBAC data seeding completed successfully!');
    
    return {
      modules: moduleMap,
      permissions: permissionMap,
      roles: roleMap
    };
  } catch (error) {
    console.error('Error during RBAC data seeding:', error.message);
    throw error;
  }
}

/**
 * Complete seeding function that includes RBAC data and default admin user
 * @returns {Promise<Object>} Object containing all seeded data
 */
async function seedAllData() {
  try {
    console.log('Starting complete data seeding...');
    
    // Seed RBAC data first
    const rbacData = await seedRBACData();
    
    // Seed default admin user
    const adminUser = await seedDefaultAdmin(rbacData.roles);
    
    console.log('Complete data seeding finished successfully!');
    
    return {
      ...rbacData,
      adminUser
    };
  } catch (error) {
    console.error('Error during complete data seeding:', error.message);
    throw error;
  }
}

/**
 * Clears all RBAC data from the database (useful for testing)
 * @returns {Promise<void>}
 */
async function clearRBACData() {
  try {
    console.log('Clearing RBAC data...');
    
    await Role.deleteMany({});
    await Permission.deleteMany({});
    await Module.deleteMany({});
    
    console.log('RBAC data cleared successfully!');
  } catch (error) {
    console.error('Error clearing RBAC data:', error.message);
    throw error;
  }
}

/**
 * Gets seeded role by name
 * @param {string} roleName - Name of the role to retrieve
 * @returns {Promise<Object>} Role document with populated permissions
 */
async function getSeededRole(roleName) {
  try {
    const role = await Role.findByName(roleName);
    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }
    
    return await role.getWithPermissions();
  } catch (error) {
    console.error(`Error retrieving role ${roleName}:`, error.message);
    throw error;
  }
}

/**
 * Validates that all required RBAC data exists
 * @returns {Promise<boolean>} True if all data exists, false otherwise
 */
async function validateRBACData() {
  try {
    console.log('Validating RBAC data...');
    
    // Check modules
    const moduleCount = await Module.countDocuments();
    if (moduleCount !== MODULES.length) {
      console.error(`Expected ${MODULES.length} modules, found ${moduleCount}`);
      return false;
    }
    
    // Check permissions
    const permissionCount = await Permission.countDocuments();
    if (permissionCount !== PERMISSIONS.length) {
      console.error(`Expected ${PERMISSIONS.length} permissions, found ${permissionCount}`);
      return false;
    }
    
    // Check roles
    const roleCount = await Role.countDocuments();
    if (roleCount !== ROLES.length) {
      console.error(`Expected ${ROLES.length} roles, found ${roleCount}`);
      return false;
    }
    
    // Validate role permissions
    for (const roleData of ROLES) {
      const role = await Role.findByName(roleData.name);
      if (!role) {
        console.error(`Role not found: ${roleData.name}`);
        return false;
      }
      
      if (role.permissions.length !== roleData.permissions.length) {
        console.error(`Role ${roleData.name} has incorrect number of permissions`);
        return false;
      }
    }
    
    console.log('RBAC data validation passed!');
    return true;
  } catch (error) {
    console.error('Error validating RBAC data:', error.message);
    return false;
  }
}

module.exports = {
  seedRBACData,
  seedAllData,
  seedDefaultAdmin,
  clearRBACData,
  getSeededRole,
  validateRBACData,
  MODULES,
  PERMISSIONS,
  ROLES
};
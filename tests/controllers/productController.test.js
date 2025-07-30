const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Role = require('../../models/Role');
const Permission = require('../../models/Permission');
const Module = require('../../models/Module');
const productRoutes = require('../../routes/products');
const CONSTANTS = require('../../config/constants');
const { generateToken } = require('../../utils/jwt');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/products', productRoutes);

describe('Product Controller Integration Tests', () => {
  let adminUser;
  let adminToken;
  let testProducts;

  beforeEach(async () => {
    // Create RBAC structure
    const productModule = await Module.create({
      name: CONSTANTS.MODULES.PRODUCTS,
      description: 'Product management module'
    });

    const createPermission = await Permission.create({
      name: 'create_product',
      description: 'Create new products',
      module: productModule._id,
      action: CONSTANTS.ACTIONS.CREATE
    });

    const adminRole = await Role.create({
      name: CONSTANTS.ROLES.ADMIN,
      description: 'Administrator role',
      permissions: [createPermission._id]
    });

    // Create admin user
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'hashedpassword',
      role: adminRole._id
    });

    adminToken = generateToken({ _id: adminUser._id, email: adminUser.email, role: adminRole });

    // Create test products
    testProducts = await Product.create([
      {
        name: 'Whey Protein Powder',
        description: 'High-quality whey protein for muscle building',
        brandName: 'FitNutrition',
        category: CONSTANTS.PRODUCT_CATEGORIES.PROTEIN,
        size: '2kg',
        flavours: ['Vanilla', 'Chocolate', 'Strawberry'],
        stockQuantity: 50,
        price: 49.99,
        images: ['https://example.com/whey1.jpg', 'https://example.com/whey2.jpg'],
        isActive: true
      },
      {
        name: 'Running Shoes',
        description: 'Comfortable running shoes for daily training',
        brandName: 'SportGear',
        category: CONSTANTS.PRODUCT_CATEGORIES.ACTIVEWEAR,
        size: 'Various',
        stockQuantity: 25,
        price: 89.99,
        images: ['https://example.com/shoes1.jpg'],
        isActive: true
      },
      {
        name: 'High Protein Oats',
        description: 'Nutritious oats with high protein content',
        brandName: 'HealthyEats',
        category: CONSTANTS.PRODUCT_CATEGORIES.HIGH_PROTEIN_OATS,
        stockQuantity: 0, // Out of stock
        price: 29.99,
        images: ['https://example.com/oats1.jpg'],
        isActive: true
      },
      {
        name: 'Inactive Product',
        description: 'This product is inactive',
        brandName: 'TestBrand',
        category: CONSTANTS.PRODUCT_CATEGORIES.ACCESSORIES,
        stockQuantity: 10,
        price: 19.99,
        isActive: false // Inactive product
      }
    ]);
  });

  describe('GET /api/products', () => {
    it('should get all active products with default pagination', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Products retrieved successfully');
      expect(response.body.data).toHaveLength(3); // Only active products
      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      });

      // Check that inactive product is not included
      const productNames = response.body.data.map(p => p.name);
      expect(productNames).not.toContain('Inactive Product');
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ category: CONSTANTS.PRODUCT_CATEGORIES.PROTEIN })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Whey Protein Powder');
      expect(response.body.data[0].category).toBe(CONSTANTS.PRODUCT_CATEGORIES.PROTEIN);
    });

    it('should filter products by brand name', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ brandName: 'SportGear' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Running Shoes');
      expect(response.body.data[0].brandName).toBe('SportGear');
    });

    it('should filter products by price range', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ minPrice: 30, maxPrice: 60 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Whey Protein Powder');
      expect(response.body.data[0].price).toBe(49.99);
    });

    it('should filter products by stock availability', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ inStock: 'true' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only products with stock > 0
      
      const productNames = response.body.data.map(p => p.name);
      expect(productNames).toContain('Whey Protein Powder');
      expect(productNames).toContain('Running Shoes');
      expect(productNames).not.toContain('High Protein Oats'); // Out of stock
    });

    it('should search products by text', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ search: 'whey' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Whey Protein Powder');
    });

    it('should sort products by price ascending', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ sort: 'price', order: 'asc' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].price).toBe(29.99); // High Protein Oats
      expect(response.body.data[1].price).toBe(49.99); // Whey Protein
      expect(response.body.data[2].price).toBe(89.99); // Running Shoes
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: true,
        hasPrev: false
      });
    });

    it('should include computed fields in response', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      const product = response.body.data.find(p => p.name === 'Whey Protein Powder');
      
      expect(product).toHaveProperty('isAvailable', true);
      expect(product).toHaveProperty('variantCount', 3); // 3 flavours
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ 
          category: 'InvalidCategory',
          minPrice: -10,
          page: 0
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get product by valid ID', async () => {
      const product = testProducts[0];
      const response = await request(app)
        .get(`/api/products/${product._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Product retrieved successfully');
      expect(response.body.data).toMatchObject({
        _id: product._id.toString(),
        name: product.name,
        description: product.description,
        brandName: product.brandName,
        category: product.category,
        price: product.price,
        stockQuantity: product.stockQuantity,
        isAvailable: true,
        hasVariants: true
      });
    });

    it('should return 404 for non-existent product ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/products/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Product not found');
    });

    it('should return 404 for inactive product', async () => {
      const inactiveProduct = testProducts[3]; // Inactive product
      const response = await request(app)
        .get(`/api/products/${inactiveProduct._id}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Product not available');
    });

    it('should return 400 for invalid product ID format', async () => {
      const response = await request(app)
        .get('/api/products/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should include computed fields for product details', async () => {
      const product = testProducts[0]; // Whey Protein with flavours
      const response = await request(app)
        .get(`/api/products/${product._id}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('isAvailable', true);
      expect(response.body.data).toHaveProperty('variantCount', 3);
      expect(response.body.data).toHaveProperty('hasVariants', true);
    });
  });

  describe('POST /api/products', () => {
    const validProductData = {
      name: 'New Test Product',
      description: 'This is a test product for creation',
      brandName: 'TestBrand',
      category: CONSTANTS.PRODUCT_CATEGORIES.PROTEIN,
      size: '1kg',
      flavours: ['Vanilla', 'Chocolate'],
      stockQuantity: 100,
      price: 39.99
    };

    it('should create product with valid admin token', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validProductData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Product created successfully');
      expect(response.body.data).toMatchObject({
        name: validProductData.name,
        description: validProductData.description,
        brandName: validProductData.brandName,
        category: validProductData.category,
        price: validProductData.price,
        stockQuantity: validProductData.stockQuantity,
        isActive: true
      });

      // Verify product was saved to database
      const savedProduct = await Product.findById(response.body.data._id);
      expect(savedProduct).toBeTruthy();
      expect(savedProduct.name).toBe(validProductData.name);
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .post('/api/products')
        .send(validProductData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Access token is required');
    });

    it('should return 403 for user without admin permissions', async () => {
      // Create regular user without admin permissions
      const regularRole = await Role.create({
        name: CONSTANTS.ROLES.USER,
        description: 'Regular user role',
        permissions: []
      });

      const regularUser = await User.create({
        firstName: 'Regular',
        lastName: 'User',
        email: 'user@test.com',
        password: 'hashedpassword',
        role: regularRole._id
      });

      const userToken = generateToken({ _id: regularUser._id, email: regularUser.email, role: regularRole });

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validProductData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });

    it('should return 400 for invalid product data', async () => {
      const invalidData = {
        name: '', // Empty name
        description: 'Short', // Too short description
        price: -10, // Negative price
        stockQuantity: 'invalid' // Invalid stock quantity
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return 409 for duplicate product name and brand', async () => {
      const duplicateData = {
        name: 'Whey Protein Powder', // Same as existing product
        description: 'Another whey protein product',
        brandName: 'FitNutrition', // Same brand as existing
        category: CONSTANTS.PRODUCT_CATEGORIES.PROTEIN,
        stockQuantity: 50,
        price: 45.99
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Product with this name and brand already exists');
    });

    it('should handle missing optional fields correctly', async () => {
      const minimalData = {
        name: 'Minimal Product',
        description: 'Product with minimal required fields only',
        brandName: 'MinimalBrand',
        category: CONSTANTS.PRODUCT_CATEGORIES.ACCESSORIES,
        stockQuantity: 10,
        price: 15.99
        // No size, flavours, or images
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(minimalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.flavours).toEqual([]);
      expect(response.body.data.images).toEqual([]);
    });
  });
});
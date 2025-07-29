const mongoose = require('mongoose');
const Cart = require('../../models/Cart');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Role = require('../../models/Role');
const CONSTANTS = require('../../config/constants');

describe('Cart Model', () => {
  let testUser;
  let testProduct1;
  let testProduct2;
  let testRole;

  beforeEach(async () => {
    // Create test role
    testRole = new Role({
      name: CONSTANTS.ROLES.USER,
      description: 'Regular user role'
    });
    await testRole.save();

    // Create test user
    testUser = new User({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123',
      role: testRole._id
    });
    await testUser.save();

    // Create test products
    testProduct1 = new Product({
      name: 'Whey Protein',
      description: 'High quality whey protein',
      brandName: 'TestBrand',
      category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
      stockQuantity: 10,
      price: 29.99,
      flavours: ['Vanilla', 'Chocolate']
    });
    await testProduct1.save();

    testProduct2 = new Product({
      name: 'Creatine',
      description: 'Pure creatine monohydrate',
      brandName: 'TestBrand',
      category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
      stockQuantity: 5,
      price: 19.99
    });
    await testProduct2.save();
  });

  describe('Schema Validation', () => {
    test('should create a valid cart', async () => {
      const cart = new Cart({
        user: testUser._id,
        items: [{
          product: testProduct1._id,
          quantity: 2,
          variant: { flavour: 'Vanilla' }
        }]
      });

      const savedCart = await cart.save();
      expect(savedCart._id).toBeDefined();
      expect(savedCart.user.toString()).toBe(testUser._id.toString());
      expect(savedCart.items).toHaveLength(1);
    });

    test('should require user reference', async () => {
      const cart = new Cart({
        items: [{
          product: testProduct1._id,
          quantity: 1
        }]
      });

      await expect(cart.save()).rejects.toThrow('User reference is required');
    });

    test('should enforce unique user constraint', async () => {
      const cart1 = new Cart({
        user: testUser._id,
        items: []
      });
      await cart1.save();

      const cart2 = new Cart({
        user: testUser._id,
        items: []
      });

      await expect(cart2.save()).rejects.toThrow();
    });

    test('should validate cart item quantity', async () => {
      const cart = new Cart({
        user: testUser._id,
        items: [{
          product: testProduct1._id,
          quantity: 0 // Invalid quantity
        }]
      });

      await expect(cart.save()).rejects.toThrow('Quantity must be at least 1');
    });

    test('should validate cart item quantity is integer', async () => {
      const cart = new Cart({
        user: testUser._id,
        items: [{
          product: testProduct1._id,
          quantity: 1.5 // Invalid - not integer
        }]
      });

      await expect(cart.save()).rejects.toThrow('Quantity must be a whole number');
    });

    test('should require product reference in cart items', async () => {
      const cart = new Cart({
        user: testUser._id,
        items: [{
          quantity: 1
          // Missing product reference
        }]
      });

      await expect(cart.save()).rejects.toThrow('Product reference is required');
    });
  });

  describe('Virtual Properties', () => {
    test('should calculate totalItems correctly', async () => {
      const cart = new Cart({
        user: testUser._id,
        items: [
          {
            product: testProduct1._id,
            quantity: 2
          },
          {
            product: testProduct2._id,
            quantity: 3
          }
        ]
      });
      await cart.save();

      expect(cart.totalItems).toBe(5);
    });

    test('should calculate totalAmount correctly with populated products', async () => {
      const cart = new Cart({
        user: testUser._id,
        items: [
          {
            product: testProduct1._id,
            quantity: 2 // 2 * 29.99 = 59.98
          },
          {
            product: testProduct2._id,
            quantity: 1 // 1 * 19.99 = 19.99
          }
        ]
      });
      await cart.save();
      await cart.populate('items.product');

      expect(cart.totalAmount).toBe(79.97); // Adjusted for floating point precision
    });

    test('should return 0 for totalAmount with unpopulated products', async () => {
      const cart = new Cart({
        user: testUser._id,
        items: [
          {
            product: testProduct1._id,
            quantity: 2
          }
        ]
      });
      await cart.save();

      expect(cart.totalAmount).toBe(0);
    });
  });

  describe('Instance Methods', () => {
    let cart;

    beforeEach(async () => {
      cart = new Cart({
        user: testUser._id,
        items: []
      });
      await cart.save();
    });

    describe('addItem', () => {
      test('should add new item to empty cart', async () => {
        await cart.addItem(testProduct1._id, 2, { flavour: 'Vanilla' });

        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].product.toString()).toBe(testProduct1._id.toString());
        expect(cart.items[0].quantity).toBe(2);
        expect(cart.items[0].variant.flavour).toBe('Vanilla');
      });

      test('should update quantity for existing item with same variant', async () => {
        await cart.addItem(testProduct1._id, 2, { flavour: 'Vanilla' });
        await cart.addItem(testProduct1._id, 1, { flavour: 'Vanilla' });

        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].quantity).toBe(3);
      });

      test('should add separate item for same product with different variant', async () => {
        await cart.addItem(testProduct1._id, 2, { flavour: 'Vanilla' });
        await cart.addItem(testProduct1._id, 1, { flavour: 'Chocolate' });

        expect(cart.items).toHaveLength(2);
        expect(cart.items[0].variant.flavour).toBe('Vanilla');
        expect(cart.items[1].variant.flavour).toBe('Chocolate');
      });

      test('should update addedAt timestamp when adding item', async () => {
        const beforeAdd = new Date();
        await cart.addItem(testProduct1._id, 1);
        
        expect(cart.items[0].addedAt).toBeInstanceOf(Date);
        expect(cart.items[0].addedAt.getTime()).toBeGreaterThanOrEqual(beforeAdd.getTime());
      });
    });

    describe('updateItemQuantity', () => {
      beforeEach(async () => {
        await cart.addItem(testProduct1._id, 2);
      });

      test('should update item quantity', async () => {
        const itemId = cart.items[0]._id;
        await cart.updateItemQuantity(itemId, 5);

        expect(cart.items[0].quantity).toBe(5);
      });

      test('should remove item when quantity is 0', async () => {
        const itemId = cart.items[0]._id;
        await cart.updateItemQuantity(itemId, 0);

        expect(cart.items).toHaveLength(0);
      });

      test('should remove item when quantity is negative', async () => {
        const itemId = cart.items[0]._id;
        await cart.updateItemQuantity(itemId, -1);

        expect(cart.items).toHaveLength(0);
      });

      test('should throw error for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        
        try {
          await cart.updateItemQuantity(fakeId, 5);
          fail('Expected error to be thrown');
        } catch (error) {
          expect(error.message).toBe('Cart item not found');
        }
      });

      test('should update addedAt timestamp when updating quantity', async () => {
        const itemId = cart.items[0]._id;
        const originalTime = cart.items[0].addedAt;
        
        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));
        await cart.updateItemQuantity(itemId, 3);

        expect(cart.items[0].addedAt.getTime()).toBeGreaterThan(originalTime.getTime());
      });
    });

    describe('removeItem', () => {
      beforeEach(async () => {
        await cart.addItem(testProduct1._id, 2);
        await cart.addItem(testProduct2._id, 1);
      });

      test('should remove specific item', async () => {
        const itemId = cart.items[0]._id;
        await cart.removeItem(itemId);

        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].product.toString()).toBe(testProduct2._id.toString());
      });

      test('should throw error for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        
        try {
          await cart.removeItem(fakeId);
          fail('Expected error to be thrown');
        } catch (error) {
          expect(error.message).toBe('Cart item not found');
        }
      });
    });

    describe('clearCart', () => {
      beforeEach(async () => {
        await cart.addItem(testProduct1._id, 2);
        await cart.addItem(testProduct2._id, 1);
      });

      test('should remove all items from cart', async () => {
        await cart.clearCart();

        expect(cart.items).toHaveLength(0);
      });
    });

    describe('validateItems', () => {
      test('should validate cart with available products', async () => {
        await cart.addItem(testProduct1._id, 2, { flavour: 'Vanilla' });
        
        const validation = await cart.validateItems();

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
        expect(validation.removedItems).toHaveLength(0);
      });

      test('should detect insufficient stock', async () => {
        await cart.addItem(testProduct1._id, 15); // More than available stock (10)
        
        const validation = await cart.validateItems();

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toHaveLength(1);
        expect(validation.errors[0].error).toContain('Only 10 items available');
        expect(validation.errors[0].availableQuantity).toBe(10);
      });

      test('should remove items for inactive products', async () => {
        await cart.addItem(testProduct1._id, 2);
        
        // Make product inactive
        testProduct1.isActive = false;
        await testProduct1.save();
        
        const validation = await cart.validateItems();

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toHaveLength(1);
        expect(validation.errors[0].error).toBe('Product is no longer available');
        expect(validation.removedItems).toHaveLength(1);
        expect(cart.items).toHaveLength(0);
      });

      test('should detect invalid variants', async () => {
        await cart.addItem(testProduct1._id, 2, { flavour: 'Strawberry' }); // Invalid flavour
        
        const validation = await cart.validateItems();

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toHaveLength(1);
        expect(validation.errors[0].error).toBe('Selected variant is no longer available');
        expect(validation.removedItems).toHaveLength(1);
      });
    });

    describe('calculateTotals', () => {
      test('should calculate totals correctly', async () => {
        await cart.addItem(testProduct1._id, 2); // 2 * 29.99 = 59.98
        await cart.addItem(testProduct2._id, 1); // 1 * 19.99 = 19.99
        
        const totals = await cart.calculateTotals();

        expect(totals.subtotal).toBe(79.97); // Adjusted for floating point precision
        expect(totals.totalItems).toBe(3);
        expect(totals.itemCount).toBe(2);
      });

      test('should handle empty cart', async () => {
        const totals = await cart.calculateTotals();

        expect(totals.subtotal).toBe(0);
        expect(totals.totalItems).toBe(0);
        expect(totals.itemCount).toBe(0);
      });
    });
  });

  describe('Static Methods', () => {
    describe('findByUser', () => {
      test('should find cart by user ID', async () => {
        const cart = new Cart({
          user: testUser._id,
          items: [{
            product: testProduct1._id,
            quantity: 1
          }]
        });
        await cart.save();

        const foundCart = await Cart.findByUser(testUser._id);

        expect(foundCart).toBeTruthy();
        expect(foundCart.user.toString()).toBe(testUser._id.toString());
        expect(foundCart.items[0].product).toBeTruthy(); // Should be populated
      });

      test('should return null for non-existent user cart', async () => {
        const fakeUserId = new mongoose.Types.ObjectId();
        const foundCart = await Cart.findByUser(fakeUserId);

        expect(foundCart).toBeNull();
      });
    });

    describe('findOrCreateByUser', () => {
      test('should return existing cart for user', async () => {
        const existingCart = new Cart({
          user: testUser._id,
          items: [{
            product: testProduct1._id,
            quantity: 1
          }]
        });
        await existingCart.save();

        const cart = await Cart.findOrCreateByUser(testUser._id);

        expect(cart._id.toString()).toBe(existingCart._id.toString());
        expect(cart.items).toHaveLength(1);
      });

      test('should create new cart for user without existing cart', async () => {
        const cart = await Cart.findOrCreateByUser(testUser._id);

        expect(cart).toBeTruthy();
        expect(cart.user.toString()).toBe(testUser._id.toString());
        expect(cart.items).toHaveLength(0);
        expect(cart.isNew).toBe(false); // Should be saved
      });
    });
  });

  describe('Middleware', () => {
    test('should update updatedAt timestamp when items are modified', async () => {
      const cart = new Cart({
        user: testUser._id,
        items: []
      });
      await cart.save();
      
      const originalUpdatedAt = cart.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      cart.items.push({
        product: testProduct1._id,
        quantity: 1
      });
      await cart.save();

      expect(cart.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Indexes', () => {
    test('should create proper indexes', async () => {
      const indexes = await Cart.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      
      expect(indexNames).toContain('user_1');
      expect(indexNames).toContain('items.product_1');
      expect(indexNames).toContain('updatedAt_-1');
    });
  });
});
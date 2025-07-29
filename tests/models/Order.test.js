const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Cart = require('../../models/Cart');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Role = require('../../models/Role');
const CONSTANTS = require('../../config/constants');

describe('Order Model', () => {
  let testUser;
  let testProduct1;
  let testProduct2;
  let testRole;
  let testCart;
  let testShippingAddress;

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

    // Create test cart
    testCart = new Cart({
      user: testUser._id,
      items: [
        {
          product: testProduct1._id,
          quantity: 2,
          variant: { flavour: 'Vanilla' }
        },
        {
          product: testProduct2._id,
          quantity: 1
        }
      ]
    });
    await testCart.save();

    // Test shipping address
    testShippingAddress = {
      type: 'home',
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      country: 'United States'
    };
  });

  describe('Schema Validation', () => {
    test('should create a valid order', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 2,
          priceAtOrderTime: 29.99,
          variant: { flavour: 'Vanilla' }
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 59.98,
        paymentMethod: 'Credit Card'
      });

      const savedOrder = await order.save();
      expect(savedOrder._id).toBeDefined();
      expect(savedOrder.user.toString()).toBe(testUser._id.toString());
      expect(savedOrder.orderItems).toHaveLength(1);
      expect(savedOrder.status).toBe(CONSTANTS.ORDER_STATUS.PENDING);
    });

    test('should require user reference', async () => {
      const order = new Order({
        orderItems: [{
          product: testProduct1._id,
          quantity: 1,
          priceAtOrderTime: 29.99
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 29.99
      });

      await expect(order.save()).rejects.toThrow('User reference is required');
    });

    test('should require at least one order item', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [],
        shippingAddress: testShippingAddress,
        totalAmount: 0
      });

      await expect(order.save()).rejects.toThrow('Order must contain at least one item');
    });

    test('should require shipping address', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 1,
          priceAtOrderTime: 29.99
        }],
        totalAmount: 29.99
      });

      await expect(order.save()).rejects.toThrow('Shipping address is required');
    });

    test('should require total amount', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 1,
          priceAtOrderTime: 29.99
        }],
        shippingAddress: testShippingAddress
      });

      await expect(order.save()).rejects.toThrow('Total amount is required');
    });

    test('should validate order status enum', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 1,
          priceAtOrderTime: 29.99
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 29.99,
        status: 'InvalidStatus'
      });

      await expect(order.save()).rejects.toThrow();
    });

    test('should validate order item quantity', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 0, // Invalid quantity
          priceAtOrderTime: 29.99
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 29.99
      });

      await expect(order.save()).rejects.toThrow('Quantity must be at least 1');
    });

    test('should validate price at order time', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 1,
          priceAtOrderTime: -10 // Invalid negative price
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 29.99
      });

      await expect(order.save()).rejects.toThrow('Price cannot be negative');
    });

    test('should validate shipping address fields', async () => {
      const invalidAddress = {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA'
        // Missing zipCode and country
      };

      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 1,
          priceAtOrderTime: 29.99
        }],
        shippingAddress: invalidAddress,
        totalAmount: 29.99
      });

      await expect(order.save()).rejects.toThrow();
    });
  });

  describe('Virtual Properties', () => {
    let order;

    beforeEach(async () => {
      order = new Order({
        user: testUser._id,
        orderItems: [
          {
            product: testProduct1._id,
            quantity: 2,
            priceAtOrderTime: 29.99
          },
          {
            product: testProduct2._id,
            quantity: 1,
            priceAtOrderTime: 19.99
          }
        ],
        shippingAddress: testShippingAddress,
        totalAmount: 79.98
      });
      await order.save();
    });

    test('should generate order number', () => {
      expect(order.orderNumber).toMatch(/^VG-[A-Z0-9]{8}$/);
    });

    test('should calculate total items', () => {
      expect(order.totalItems).toBe(3);
    });

    test('should format shipping address', () => {
      const formatted = order.formattedShippingAddress;
      expect(formatted).toBe('123 Main St, Anytown, CA 12345, United States');
    });

    test('should provide current status info', () => {
      const statusInfo = order.currentStatusInfo;
      expect(statusInfo.status).toBe(CONSTANTS.ORDER_STATUS.PENDING);
      expect(statusInfo.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Instance Methods', () => {
    let order;

    beforeEach(async () => {
      order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 2,
          priceAtOrderTime: 29.99
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 59.98
      });
      await order.save();
    });

    describe('updateStatus', () => {
      test('should update status from Pending to Processing', async () => {
        await order.updateStatus(CONSTANTS.ORDER_STATUS.PROCESSING, 'Order confirmed');

        expect(order.status).toBe(CONSTANTS.ORDER_STATUS.PROCESSING);
        expect(order.statusHistory).toHaveLength(2);
        expect(order.statusHistory[1].status).toBe(CONSTANTS.ORDER_STATUS.PROCESSING);
        expect(order.statusHistory[1].note).toBe('Order confirmed');
      });

      test('should prevent invalid status transitions', async () => {
        try {
          await order.updateStatus(CONSTANTS.ORDER_STATUS.DELIVERED);
          fail('Expected error to be thrown');
        } catch (error) {
          expect(error.message).toContain('Invalid status transition');
        }
      });

      test('should allow cancellation from Pending', async () => {
        await order.updateStatus(CONSTANTS.ORDER_STATUS.CANCELLED, 'Customer request');

        expect(order.status).toBe(CONSTANTS.ORDER_STATUS.CANCELLED);
        expect(order.statusHistory[1].note).toBe('Customer request');
      });
    });

    describe('getValidStatusTransitions', () => {
      test('should return valid transitions for Pending status', () => {
        const transitions = order.getValidStatusTransitions();
        expect(transitions).toContain(CONSTANTS.ORDER_STATUS.PROCESSING);
        expect(transitions).toContain(CONSTANTS.ORDER_STATUS.CANCELLED);
      });

      test('should return empty array for Delivered status', async () => {
        // Manually set status to delivered for testing
        order.status = CONSTANTS.ORDER_STATUS.DELIVERED;
        const transitions = order.getValidStatusTransitions();
        expect(transitions).toHaveLength(0);
      });
    });

    describe('canBeCancelled', () => {
      test('should allow cancellation for Pending orders', () => {
        expect(order.canBeCancelled()).toBe(true);
      });

      test('should allow cancellation for Processing orders', async () => {
        order.status = CONSTANTS.ORDER_STATUS.PROCESSING;
        expect(order.canBeCancelled()).toBe(true);
      });

      test('should not allow cancellation for Shipped orders', async () => {
        order.status = CONSTANTS.ORDER_STATUS.SHIPPED;
        expect(order.canBeCancelled()).toBe(false);
      });
    });

    describe('calculateTotals', () => {
      test('should calculate order totals correctly', () => {
        const totals = order.calculateTotals();

        expect(totals.subtotal).toBe(59.98);
        expect(totals.totalItems).toBe(2);
        expect(totals.itemCount).toBe(1);
      });
    });

    describe('getOrderSummary', () => {
      test('should return order summary', () => {
        const summary = order.getOrderSummary();

        expect(summary.orderNumber).toMatch(/^VG-[A-Z0-9]{8}$/);
        expect(summary.status).toBe(CONSTANTS.ORDER_STATUS.PENDING);
        expect(summary.totalAmount).toBe(59.98);
        expect(summary.totalItems).toBe(2);
        expect(summary.itemCount).toBe(1);
        expect(summary.shippingAddress).toBe('123 Main St, Anytown, CA 12345, United States');
      });
    });
  });

  describe('Static Methods', () => {
    describe('createFromCart', () => {
      test('should create order from valid cart', async () => {
        await testCart.populate('items.product');
        
        const order = await Order.createFromCart(
          testUser._id,
          testCart,
          testShippingAddress,
          'Credit Card'
        );

        expect(order).toBeTruthy();
        expect(order.user.toString()).toBe(testUser._id.toString());
        expect(order.orderItems).toHaveLength(2);
        expect(order.totalAmount).toBe(79.97); // (29.99 * 2) + (19.99 * 1) - floating point precision
        expect(order.paymentMethod).toBe('Credit Card');
        expect(order.statusHistory).toHaveLength(1);
      });

      test('should update product stock when creating order', async () => {
        const originalStock1 = testProduct1.stockQuantity;
        const originalStock2 = testProduct2.stockQuantity;

        await testCart.populate('items.product');
        await Order.createFromCart(testUser._id, testCart, testShippingAddress);

        // Refresh products from database
        const updatedProduct1 = await Product.findById(testProduct1._id);
        const updatedProduct2 = await Product.findById(testProduct2._id);

        expect(updatedProduct1.stockQuantity).toBe(originalStock1 - 2);
        expect(updatedProduct2.stockQuantity).toBe(originalStock2 - 1);
      });

      test('should reject empty cart', async () => {
        // Create a new user to avoid cart duplication
        const newUser = new User({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          password: 'password123',
          role: testRole._id
        });
        await newUser.save();

        const emptyCart = new Cart({
          user: newUser._id,
          items: []
        });
        await emptyCart.save();

        await expect(Order.createFromCart(newUser._id, emptyCart, testShippingAddress))
          .rejects.toThrow('Cart is empty');
      });

      test('should reject cart with invalid items', async () => {
        // Make product inactive
        testProduct1.isActive = false;
        await testProduct1.save();

        await expect(Order.createFromCart(testUser._id, testCart, testShippingAddress))
          .rejects.toThrow('Cart contains invalid items');
      });
    });

    describe('findByUser', () => {
      let order1, order2;

      beforeEach(async () => {
        order1 = new Order({
          user: testUser._id,
          orderItems: [{
            product: testProduct1._id,
            quantity: 1,
            priceAtOrderTime: 29.99
          }],
          shippingAddress: testShippingAddress,
          totalAmount: 29.99,
          status: CONSTANTS.ORDER_STATUS.PENDING
        });
        await order1.save();

        order2 = new Order({
          user: testUser._id,
          orderItems: [{
            product: testProduct2._id,
            quantity: 1,
            priceAtOrderTime: 19.99
          }],
          shippingAddress: testShippingAddress,
          totalAmount: 19.99,
          status: CONSTANTS.ORDER_STATUS.PROCESSING
        });
        await order2.save();
      });

      test('should find all orders for user', async () => {
        const orders = await Order.findByUser(testUser._id);

        expect(orders).toHaveLength(2);
        expect(orders[0].orderDate.getTime()).toBeGreaterThanOrEqual(orders[1].orderDate.getTime());
      });

      test('should filter orders by status', async () => {
        const orders = await Order.findByUser(testUser._id, { 
          status: CONSTANTS.ORDER_STATUS.PROCESSING 
        });

        expect(orders).toHaveLength(1);
        expect(orders[0].status).toBe(CONSTANTS.ORDER_STATUS.PROCESSING);
      });

      test('should populate products when requested', async () => {
        const orders = await Order.findByUser(testUser._id, { populate: true });

        expect(orders[0].orderItems[0].product.name).toBeDefined();
      });
    });

    describe('findByStatus', () => {
      beforeEach(async () => {
        const order = new Order({
          user: testUser._id,
          orderItems: [{
            product: testProduct1._id,
            quantity: 1,
            priceAtOrderTime: 29.99
          }],
          shippingAddress: testShippingAddress,
          totalAmount: 29.99,
          status: CONSTANTS.ORDER_STATUS.PROCESSING
        });
        await order.save();
      });

      test('should find orders by status', async () => {
        const orders = await Order.findByStatus(CONSTANTS.ORDER_STATUS.PROCESSING);

        expect(orders).toHaveLength(1);
        expect(orders[0].status).toBe(CONSTANTS.ORDER_STATUS.PROCESSING);
      });

      test('should populate user and products when requested', async () => {
        const orders = await Order.findByStatus(CONSTANTS.ORDER_STATUS.PROCESSING, { 
          populate: true 
        });

        expect(orders[0].user.firstName).toBeDefined();
        expect(orders[0].orderItems[0].product.name).toBeDefined();
      });
    });
  });

  describe('Middleware', () => {
    test('should round prices to 2 decimal places', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 1,
          priceAtOrderTime: 29.999 // Should be rounded to 30.00
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 29.999 // Should be rounded to 30.00
      });
      await order.save();

      expect(order.totalAmount).toBe(30.00);
      expect(order.orderItems[0].priceAtOrderTime).toBe(30.00);
    });

    test('should initialize status history on new orders', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 1,
          priceAtOrderTime: 29.99
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 29.99
      });
      await order.save();

      expect(order.statusHistory).toHaveLength(1);
      expect(order.statusHistory[0].status).toBe(CONSTANTS.ORDER_STATUS.PENDING);
      expect(order.statusHistory[0].note).toBe('Order created');
    });

    test('should update product stock on order creation', async () => {
      const originalStock = testProduct1.stockQuantity;

      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 3,
          priceAtOrderTime: 29.99
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 89.97
      });
      await order.save();

      // Refresh product from database
      const updatedProduct1 = await Product.findById(testProduct1._id);
      expect(updatedProduct1.stockQuantity).toBe(originalStock - 3);
    });

    test('should handle insufficient stock error', async () => {
      const order = new Order({
        user: testUser._id,
        orderItems: [{
          product: testProduct1._id,
          quantity: 20, // More than available stock
          priceAtOrderTime: 29.99
        }],
        shippingAddress: testShippingAddress,
        totalAmount: 599.80
      });

      await expect(order.save()).rejects.toThrow('Insufficient stock available');
    });
  });

  describe('Indexes', () => {
    test('should create proper indexes', async () => {
      const indexes = await Order.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      
      expect(indexNames).toContain('user_1');
      expect(indexNames).toContain('status_1');
      expect(indexNames).toContain('orderDate_-1');
      expect(indexNames).toContain('orderItems.product_1');
      expect(indexNames).toContain('totalAmount_1');
      expect(indexNames).toContain('user_1_status_1');
      expect(indexNames).toContain('user_1_orderDate_-1');
      expect(indexNames).toContain('status_1_orderDate_-1');
    });
  });
});
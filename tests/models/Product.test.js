const mongoose = require('mongoose');
const Product = require('../../models/Product');
const CONSTANTS = require('../../config/constants');

describe('Product Model', () => {
  describe('Schema Validation', () => {
    it('should create a valid product with all required fields', async () => {
      const productData = {
        name: 'Whey Protein Powder',
        description: 'High-quality whey protein for muscle building',
        brandName: 'FitNutrition',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 100,
        price: 49.99
      };

      const product = new Product(productData);
      const savedProduct = await product.save();

      expect(savedProduct._id).toBeDefined();
      expect(savedProduct.name).toBe(productData.name);
      expect(savedProduct.description).toBe(productData.description);
      expect(savedProduct.brandName).toBe(productData.brandName);
      expect(savedProduct.category).toBe(productData.category);
      expect(savedProduct.stockQuantity).toBe(productData.stockQuantity);
      expect(savedProduct.price).toBe(productData.price);
      expect(savedProduct.isActive).toBe(true); // default value
      expect(savedProduct.createdAt).toBeDefined();
      expect(savedProduct.updatedAt).toBeDefined();
    });

    it('should fail validation when required fields are missing', async () => {
      const product = new Product({});

      let error;
      try {
        await product.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.description).toBeDefined();
      expect(error.errors.brandName).toBeDefined();
      expect(error.errors.category).toBeDefined();
      expect(error.errors.stockQuantity).toBeDefined();
      expect(error.errors.price).toBeDefined();
    });

    it('should validate category enum values', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: 'InvalidCategory',
        stockQuantity: 10,
        price: 29.99
      };

      const product = new Product(productData);

      let error;
      try {
        await product.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.category).toBeDefined();
      expect(error.errors.category.message).toContain('Category must be one of');
    });

    it('should accept valid category values', async () => {
      const categories = Object.values(CONSTANTS.PRODUCT_CATEGORIES);
      
      for (const category of categories) {
        const productData = {
          name: `Test Product ${category}`,
          description: 'Test description',
          brandName: 'Test Brand',
          category: category,
          stockQuantity: 10,
          price: 29.99
        };

        const product = new Product(productData);
        const savedProduct = await product.save();
        
        expect(savedProduct.category).toBe(category);
      }
    });

    it('should validate stock quantity constraints', async () => {
      const baseProduct = {
        name: 'Test Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        price: 29.99
      };

      // Test negative stock quantity
      const negativeStockProduct = new Product({
        ...baseProduct,
        stockQuantity: -5
      });

      let error;
      try {
        await negativeStockProduct.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.stockQuantity).toBeDefined();

      // Test decimal stock quantity
      const decimalStockProduct = new Product({
        ...baseProduct,
        stockQuantity: 10.5
      });

      try {
        await decimalStockProduct.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.stockQuantity).toBeDefined();
    });

    it('should validate price constraints', async () => {
      const baseProduct = {
        name: 'Test Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10
      };

      // Test negative price
      const negativePrice = new Product({
        ...baseProduct,
        price: -10
      });

      let error;
      try {
        await negativePrice.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.price).toBeDefined();

      // Test valid price
      const validPrice = new Product({
        ...baseProduct,
        price: 29.99
      });

      const savedProduct = await validPrice.save();
      expect(savedProduct.price).toBe(29.99);
    });

    it('should validate string field length constraints', async () => {
      const baseProduct = {
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.99
      };

      // Test name length
      const longNameProduct = new Product({
        ...baseProduct,
        name: 'a'.repeat(201) // Exceeds 200 character limit
      });

      let error;
      try {
        await longNameProduct.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
    });

    it('should validate image URL format', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.99,
        images: ['invalid-url', 'https://example.com/image.jpg']
      };

      const product = new Product(productData);

      let error;
      try {
        await product.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors['images.0']).toBeDefined();
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate isAvailable virtual correctly', async () => {
      // Available product (active and in stock)
      const availableProduct = new Product({
        name: 'Available Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.99,
        isActive: true
      });

      await availableProduct.save();
      expect(availableProduct.isAvailable).toBe(true);

      // Inactive product
      const inactiveProduct = new Product({
        name: 'Inactive Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.99,
        isActive: false
      });

      await inactiveProduct.save();
      expect(inactiveProduct.isAvailable).toBe(false);

      // Out of stock product
      const outOfStockProduct = new Product({
        name: 'Out of Stock Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 0,
        price: 29.99,
        isActive: true
      });

      await outOfStockProduct.save();
      expect(outOfStockProduct.isAvailable).toBe(false);
    });

    it('should calculate variantCount virtual correctly', async () => {
      // Product without variants
      const simpleProduct = new Product({
        name: 'Simple Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.99
      });

      await simpleProduct.save();
      expect(simpleProduct.variantCount).toBe(1);

      // Product with flavours
      const flavouredProduct = new Product({
        name: 'Flavoured Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.99,
        flavours: ['Vanilla', 'Chocolate', 'Strawberry']
      });

      await flavouredProduct.save();
      expect(flavouredProduct.variantCount).toBe(3);
    });
  });

  describe('Instance Methods', () => {
    let product;

    beforeEach(async () => {
      product = new Product({
        name: 'Test Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 100,
        price: 29.99,
        flavours: ['Vanilla', 'Chocolate'],
        size: 'Large'
      });
      await product.save();
    });

    describe('hasVariants()', () => {
      it('should return true when product has flavours', () => {
        expect(product.hasVariants()).toBe(true);
      });

      it('should return true when product has size', async () => {
        const sizedProduct = new Product({
          name: 'Sized Product',
          description: 'Test description',
          brandName: 'Test Brand',
          category: CONSTANTS.PRODUCT_CATEGORIES.ACTIVEWEAR,
          stockQuantity: 10,
          price: 29.99,
          size: 'Medium'
        });

        expect(sizedProduct.hasVariants()).toBe(true);
      });

      it('should return false when product has no variants', async () => {
        const simpleProduct = new Product({
          name: 'Simple Product',
          description: 'Test description',
          brandName: 'Test Brand',
          category: CONSTANTS.PRODUCT_CATEGORIES.EQUIPMENT,
          stockQuantity: 10,
          price: 29.99
        });

        expect(simpleProduct.hasVariants()).toBe(false);
      });
    });

    describe('isValidVariant()', () => {
      it('should validate flavour variants correctly', () => {
        expect(product.isValidVariant({ flavour: 'Vanilla' })).toBe(true);
        expect(product.isValidVariant({ flavour: 'Chocolate' })).toBe(true);
        expect(product.isValidVariant({ flavour: 'Strawberry' })).toBe(false);
      });

      it('should validate size variants correctly', () => {
        expect(product.isValidVariant({ size: 'Large' })).toBe(true);
        expect(product.isValidVariant({ size: 'Small' })).toBe(false);
      });

      it('should validate combined variants correctly', () => {
        expect(product.isValidVariant({ 
          flavour: 'Vanilla', 
          size: 'Large' 
        })).toBe(true);
        expect(product.isValidVariant({ 
          flavour: 'Vanilla', 
          size: 'Small' 
        })).toBe(false);
      });

      it('should return true for null variant when product has no variants', async () => {
        const simpleProduct = new Product({
          name: 'Simple Product',
          description: 'Test description',
          brandName: 'Test Brand',
          category: CONSTANTS.PRODUCT_CATEGORIES.EQUIPMENT,
          stockQuantity: 10,
          price: 29.99
        });

        expect(simpleProduct.isValidVariant(null)).toBe(true);
        expect(simpleProduct.isValidVariant(undefined)).toBe(true);
      });
    });

    describe('updateStock()', () => {
      it('should subtract stock correctly', async () => {
        const initialStock = product.stockQuantity;
        await product.updateStock(10, 'subtract');
        
        expect(product.stockQuantity).toBe(initialStock - 10);
      });

      it('should add stock correctly', async () => {
        const initialStock = product.stockQuantity;
        await product.updateStock(20, 'add');
        
        expect(product.stockQuantity).toBe(initialStock + 20);
      });

      it('should throw error when insufficient stock for subtraction', async () => {
        try {
          await product.updateStock(200, 'subtract');
          fail('Expected error to be thrown');
        } catch (error) {
          expect(error.message).toBe('Insufficient stock available');
        }
      });

      it('should default to subtract operation', async () => {
        const initialStock = product.stockQuantity;
        await product.updateStock(5);
        
        expect(product.stockQuantity).toBe(initialStock - 5);
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test products
      await Product.create([
        {
          name: 'Available Product 1',
          description: 'Test description',
          brandName: 'Brand A',
          category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
          stockQuantity: 10,
          price: 29.99,
          isActive: true
        },
        {
          name: 'Available Product 2',
          description: 'Test description',
          brandName: 'Brand B',
          category: CONSTANTS.PRODUCT_CATEGORIES.ACTIVEWEAR,
          stockQuantity: 5,
          price: 49.99,
          isActive: true
        },
        {
          name: 'Inactive Product',
          description: 'Test description',
          brandName: 'Brand A',
          category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
          stockQuantity: 10,
          price: 39.99,
          isActive: false
        },
        {
          name: 'Out of Stock Product',
          description: 'Test description',
          brandName: 'Brand C',
          category: CONSTANTS.PRODUCT_CATEGORIES.EQUIPMENT,
          stockQuantity: 0,
          price: 19.99,
          isActive: true
        }
      ]);
    });

    describe('findAvailable()', () => {
      it('should return only available products', async () => {
        const availableProducts = await Product.findAvailable();
        
        expect(availableProducts).toHaveLength(2);
        availableProducts.forEach(product => {
          expect(product.isActive).toBe(true);
          expect(product.stockQuantity).toBeGreaterThan(0);
        });
      });

      it('should apply additional filters', async () => {
        const filteredProducts = await Product.findAvailable({
          category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS
        });
        
        expect(filteredProducts).toHaveLength(1);
        expect(filteredProducts[0].category).toBe(CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS);
      });
    });

    describe('findByCategory()', () => {
      it('should return products by category', async () => {
        const supplementProducts = await Product.findByCategory(
          CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS
        );
        
        expect(supplementProducts).toHaveLength(1); // Only active one
        expect(supplementProducts[0].category).toBe(CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS);
        expect(supplementProducts[0].isActive).toBe(true);
      });

      it('should apply additional filters', async () => {
        const expensiveSupplements = await Product.findByCategory(
          CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
          { price: { $gte: 25 } }
        );
        
        expect(expensiveSupplements).toHaveLength(1);
      });
    });
  });

  describe('Pre-save Middleware', () => {
    it('should round price to 2 decimal places', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.999
      });

      await product.save();
      expect(product.price).toBe(30.00);
    });

    it('should remove empty strings from flavours array', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.99,
        flavours: ['Vanilla', '', 'Chocolate', '   ', 'Strawberry']
      });

      await product.save();
      expect(product.flavours).toEqual(['Vanilla', 'Chocolate', 'Strawberry']);
    });

    it('should remove empty strings from images array', async () => {
      const product = new Product({
        name: 'Test Product',
        description: 'Test description',
        brandName: 'Test Brand',
        category: CONSTANTS.PRODUCT_CATEGORIES.SUPPLEMENTS,
        stockQuantity: 10,
        price: 29.99
      });

      // Set images directly to bypass validation during construction
      product.images = ['https://example.com/1.jpg', '', 'https://example.com/2.jpg', '   '];

      await product.save();
      expect(product.images).toEqual(['https://example.com/1.jpg', 'https://example.com/2.jpg']);
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for efficient queries', async () => {
      const indexes = await Product.collection.getIndexes();
      
      // Check for text index
      expect(indexes).toHaveProperty('name_text_description_text_brandName_text');
      
      // Check for single field indexes
      expect(indexes).toHaveProperty('category_1');
      expect(indexes).toHaveProperty('brandName_1');
      expect(indexes).toHaveProperty('price_1');
      expect(indexes).toHaveProperty('stockQuantity_1');
      expect(indexes).toHaveProperty('isActive_1');
      expect(indexes).toHaveProperty('createdAt_-1');
      
      // Check for compound indexes
      expect(indexes).toHaveProperty('category_1_isActive_1');
      expect(indexes).toHaveProperty('category_1_price_1');
      expect(indexes).toHaveProperty('brandName_1_category_1');
    });
  });
});
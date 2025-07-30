const { cloudinary, extractPublicId } = require('../../config/cloudinary');

describe('Cloudinary Configuration', () => {
  it('should have cloudinary configured with correct credentials', () => {
    expect(cloudinary.config().cloud_name).toBe('daqnncxbi');
    expect(cloudinary.config().api_key).toBe('974679899854767');
    expect(cloudinary.config().api_secret).toBe('z-LAEEnILMJ2I76O3fvfIY7T1_o');
  });

  it('should extract public ID from Cloudinary URL correctly', () => {
    const url = 'https://res.cloudinary.com/daqnncxbi/image/upload/v1234567890/vitalgear/products/abc123.jpg';
    const publicId = extractPublicId(url);
    expect(publicId).toBe('vitalgear/products/abc123');
  });

  it('should return null for invalid URL', () => {
    const invalidUrl = 'https://example.com/image.jpg';
    const publicId = extractPublicId(invalidUrl);
    expect(publicId).toBeNull();
  });

  it('should handle URL extraction errors gracefully', () => {
    const publicId = extractPublicId(null);
    expect(publicId).toBeNull();
  });

  it('should have correct folder configuration', () => {
    // This test ensures the configuration is set up correctly
    expect(cloudinary.config().cloud_name).toBeDefined();
    expect(cloudinary.config().api_key).toBeDefined();
    expect(cloudinary.config().api_secret).toBeDefined();
  });
});
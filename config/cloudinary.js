const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'daqnncxbi',
  api_key: process.env.CLOUDINARY_API_KEY || '974679899854767',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'z-LAEEnILMJ2I76O3fvfIY7T1_o'
});

// Configure Cloudinary storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'vitalgear/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Create multer upload middleware
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Middleware for multiple file uploads
const uploadMultiple = upload.array('images', 5); // Max 5 images

// Utility function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Utility function to extract public ID from Cloudinary URL
const extractPublicId = (url) => {
  try {
    // Extract public ID from Cloudinary URL
    // Example URL: https://res.cloudinary.com/daqnncxbi/image/upload/v1234567890/vitalgear/products/abc123.jpg
    const matches = url.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : null;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadMultiple,
  deleteImage,
  extractPublicId
};
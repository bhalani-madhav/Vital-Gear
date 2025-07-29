const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { connectDB } = require("./config/database");
const CONSTANTS = require("./config/constants");

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(CONSTANTS.HTTP_STATUS.OK).json({
    success: true,
    message: "VitalGear API is running",
    timestamp: new Date().toISOString(),
  });
});

// Routes
const authRoutes = require("./routes/auth");

// Mount routes
app.use("/api/auth", authRoutes);

// Basic route
app.get("/", (req, res) => {
  res.status(CONSTANTS.HTTP_STATUS.OK).json({
    success: true,
    message: "Welcome to VitalGear API",
    version: "1.0.0",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: {
      message: "Route not found",
      code: CONSTANTS.ERROR_CODES.NOT_FOUND_ERROR,
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      message: "Internal server error",
      code: CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
    },
  });
});

const PORT = process.env.PORT || 3000;

// Start server only if not in test environment
if (process.env.NODE_ENV !== "test") {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  });
}

module.exports = app;

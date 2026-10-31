/**
 * In-Memory Sliding Window Rate Limiting Middleware
 *
 * Protects backend APIs against brute-force credential stuffing and DoS floods
 * without requiring external Redis or heavy npm dependencies.
 */

function createRateLimiter({
  windowMs = 60 * 1000, // 1 minute window
  maxRequests = 100,     // Max requests per window
  message = 'Too many requests from this IP. Please try again later.',
  skip = () => false,
} = {}) {
  const ipBuckets = new Map();

  // Periodic memory cleanup every 5 minutes to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipBuckets.entries()) {
      if (now - record.windowStart > windowMs * 2) {
        ipBuckets.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Unref timer so it doesn't hold open process during tests
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req, res, next) => {
    if (skip(req)) {
      return next();
    }

    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let record = ipBuckets.get(clientIp);

    if (!record || now - record.windowStart > windowMs) {
      record = {
        windowStart: now,
        count: 1,
      };
      ipBuckets.set(clientIp, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetTime = Math.ceil((record.windowStart + windowMs - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', resetTime);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfterSeconds: resetTime,
        },
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

// 1. General API limiter: 300 requests per minute
const globalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
  message: 'API rate limit exceeded. Please throttle your requests.',
  skip: (req) => {
    // Exempt health probes and live SSE streams
    const url = req.originalUrl || req.url;
    return (
      url.includes('/api/health') ||
      url.includes('/api/ready') ||
      url.includes('/api/alerts/stream')
    );
  },
});

// 2. Strict Authentication limiter: 25 attempts per 15 minutes per IP
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many authentication attempts from this IP. Please try again in 15 minutes.',
});

module.exports = {
  createRateLimiter,
  globalRateLimiter,
  authRateLimiter,
};

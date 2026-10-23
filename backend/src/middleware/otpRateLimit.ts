import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for requesting verification codes.
 * Restricts excessive OTP requests per IP to prevent email bombing and resource abuse.
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 OTP requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many verification code requests from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Rate limiter for verifying OTP codes.
 * Restricts verification attempts per IP to prevent distributed brute-force enumeration.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 verification attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many verification attempts from this IP. Please try again after 15 minutes.',
  },
});

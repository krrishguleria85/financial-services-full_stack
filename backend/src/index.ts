import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import bcrypt from 'bcryptjs';
import prisma from './config/database';
import { config } from './config';

// Import routes
import authRoutes from './routes/auth';
import serviceRoutes from './routes/services';
import serviceRequestRoutes from './routes/serviceRequests';
import appointmentRoutes from './routes/appointments';
import documentRoutes from './routes/documents';
import enquiryRoutes from './routes/enquiries';
import customerRoutes from './routes/customers';
import videoRoutes from './routes/videos';
import blogRoutes from './routes/blog';
import testimonialRoutes from './routes/testimonials';
import settingsRoutes from './routes/settings';
import adminRoutes from './routes/admin';
import fs from 'fs';

// Ensure upload directory exists (especially on Render ephemeral environments)
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

const app = express();

// Trust proxy for Render reverse-proxy (essential for rate-limiting client IPs)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [
  config.frontendUrl,
  config.frontendUrl.replace(/\/$/, ''),
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes(origin.replace(/\/$/, '')) ||
      origin.endsWith('.onrender.com')
    ) {
      return callback(null, true);
    }
    return callback(null, true); // Allow during production transition
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting for public API endpoints
const publicLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for form submissions
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many submissions. Please try again later.' },
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting
app.use('/api', publicLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/enquiries', formLimiter, enquiryRoutes);
app.use('/api/admin/customers', customerRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (_req, res) => {
  res.json({ message: 'Financial Services API is running', status: 'ok' });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: `File size exceeds the allowed limit of ${config.upload.maxFileSizeMB}MB` });
    return;
  }

  if (err.message?.includes('Invalid file type')) {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(500).json({
    error: config.nodeEnv === 'development'
      ? err.message
      : 'An unexpected error occurred. Please try again.',
  });
});

async function initDatabase() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      const existing = await prisma.admin.findUnique({ where: { email: adminEmail } });
      if (!existing) {
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await prisma.admin.create({
          data: {
            email: adminEmail,
            passwordHash,
            name: 'Rajesh Guleria',
            role: 'super_admin',
            isActive: true,
          },
        });
        console.log(`✅ Admin account initialized for: ${adminEmail}`);
      }
    }

    const serviceCount = await prisma.service.count();
    if (serviceCount === 0) {
      console.log('🌱 Populating initial services...');
      const defaultServices = [
        {
          name: 'ITR Filing Assistance',
          slug: 'itr-filing-assistance',
          category: 'itr',
          description: 'Expert assistance for Income Tax Return filing for individuals and businesses.',
          icon: 'FileText',
          sortOrder: 1,
        },
        {
          name: 'GST Registration & Returns',
          slug: 'gst-services',
          category: 'gst',
          description: 'Complete GST registration and regular return filing assistance.',
          icon: 'Building',
          sortOrder: 2,
        },
        {
          name: 'LIC / Life Insurance',
          slug: 'lic-insurance',
          category: 'lic',
          description: 'Assistance for LIC policies, premiums, and claim processing.',
          icon: 'Shield',
          sortOrder: 3,
        },
        {
          name: 'Star Health Insurance',
          slug: 'star-health-insurance',
          category: 'health-insurance',
          description: 'Comprehensive health and medical insurance plans from Star Health.',
          icon: 'HeartPulse',
          sortOrder: 4,
        },
        {
          name: 'Tax & Financial Consultation',
          slug: 'tax-consultation',
          category: 'consultation',
          description: 'Personalized tax planning and financial advisory.',
          icon: 'Calculator',
          sortOrder: 5,
        },
      ];
      for (const s of defaultServices) {
        await prisma.service.create({ data: s });
      }
      console.log('✅ Default services created');
    }
  } catch (err) {
    console.warn('Database initialization check skipped or failed:', err);
  }
}

// Start server
app.listen(config.port, async () => {
  console.log(`\n🚀 Server running on http://localhost:${config.port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Frontend URL: ${config.frontendUrl}\n`);
  await initDatabase();
});

export default app;

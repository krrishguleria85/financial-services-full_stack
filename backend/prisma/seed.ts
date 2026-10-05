import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ============================================
  // Admin Account (DEMO - Change before production!)
  // ============================================
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin',
      role: 'super_admin',
    },
  });
  console.log('✅ Admin account created: admin@example.com / ChangeMe123!');

  // ============================================
  // Services
  // ============================================
  const services = [
    {
      name: 'LIC / Insurance Services',
      slug: 'lic-insurance-services',
      category: 'lic',
      description: 'Professional assistance for LIC policies, premium payments, claims, and policy reviews.',
      longDescription: 'We provide comprehensive assistance for all your Life Insurance Corporation (LIC) needs. Whether you need help choosing the right policy, understanding your existing coverage, managing premium payments, or navigating the claims process, our experienced team is here to guide you every step of the way.',
      icon: 'Shield',
      sortOrder: 1,
    },
    {
      name: 'ITR Filing Assistance',
      slug: 'itr-filing-assistance',
      category: 'itr',
      description: 'Expert assistance for Income Tax Return filing for individuals and businesses.',
      longDescription: 'Our ITR filing assistance covers all types of income tax returns including salary income, business/professional income, capital gains, and more. We help you organize your documents, calculate your tax liability, identify eligible deductions, and ensure accurate and timely filing of your returns.',
      icon: 'FileText',
      sortOrder: 2,
    },
    {
      name: 'GST Registration',
      slug: 'gst-registration',
      category: 'gst',
      description: 'Complete assistance for new GST registration and related documentation.',
      longDescription: 'We assist businesses with the complete GST registration process, from preparing the required documents to submitting the application and following up until you receive your GSTIN. Our team ensures all details are accurately filled and verified before submission.',
      icon: 'Building',
      sortOrder: 3,
    },
    {
      name: 'GST Return Assistance',
      slug: 'gst-return-assistance',
      category: 'gst',
      description: 'Timely and accurate GST return filing assistance for businesses.',
      longDescription: 'Stay compliant with GST regulations through our return filing assistance. We handle GSTR-1, GSTR-3B, GSTR-9, and other return types. Our team verifies your invoices, reconciles data, and ensures accurate filing within deadlines to avoid penalties.',
      icon: 'Calculator',
      sortOrder: 4,
    },
    {
      name: 'Tax Consultation',
      slug: 'tax-consultation',
      category: 'consultation',
      description: 'Personalized tax planning and consultation services for individuals and businesses.',
      longDescription: 'Get expert advice on tax planning, investment decisions, and financial structuring. Our consultation covers income tax, GST implications, capital gains, and business tax optimization. We help you understand your tax obligations and identify legitimate ways to minimize your tax burden.',
      icon: 'MessageCircle',
      sortOrder: 5,
    },
    {
      name: 'Financial Documentation',
      slug: 'financial-documentation',
      category: 'documentation',
      description: 'Assistance with financial document preparation, verification, and organization.',
      longDescription: 'We help you prepare, organize, and maintain essential financial documents. This includes income proofs, investment statements, loan documentation, business financial statements, and other documents required for various financial and regulatory purposes.',
      icon: 'FolderOpen',
      sortOrder: 6,
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: service,
      create: service,
    });
  }
  console.log('✅ Services created');

  // ============================================
  // Business Settings
  // ============================================
  const defaultSettings: Record<string, string> = {
    businessName: 'Rajesh Guleria Official',
    tagline: 'Trusted Assistance for Insurance, Tax & GST Services',
    phone: '+91 9872889201',
    whatsapp: '9872889201',
    email: 'rajeshguleria@yahoo.com, rajeshguleria1973@gmail.com',
    address: 'House Number 755, Sector 43 A, Chandigarh (Near Shakambhari Devi Temple)',
    workingHours: 'Monday - Saturday: 10:00 AM - 6:00 PM',
    youtubeChannelUrl: 'https://www.youtube.com/@rajeshguleria1973',
    instagramUrl: 'https://www.instagram.com/guleria2877',
    facebookUrl: '',
    businessDescription: 'We provide trusted and professional assistance for LIC/Insurance services, Income Tax Return filing, GST registration & returns, and comprehensive financial consultation. With years of experience helping individuals and businesses, we make complex financial processes simple and hassle-free.',
    footerText: '© 2026 Rajesh Guleria Official. All rights reserved.',
    disclaimer: 'This website provides professional assistance and consultation services. It is not an official website of LIC, the Income Tax Department, GST Portal, or any government authority.',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.businessSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log('✅ Business settings created');

  // ============================================
  // Demo Customers
  // ============================================
  const customer1 = await prisma.customer.create({
    data: {
      name: 'Rajesh Kumar',
      phone: '9876543001',
      email: 'rajesh.demo@example.com',
      city: 'Delhi',
      state: 'Delhi',
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Priya Sharma',
      phone: '9876543002',
      email: 'priya.demo@example.com',
      city: 'Mumbai',
      state: 'Maharashtra',
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: 'Amit Patel',
      phone: '9876543003',
      email: 'amit.demo@example.com',
      city: 'Ahmedabad',
      state: 'Gujarat',
    },
  });
  console.log('✅ Demo customers created');

  // ============================================
  // Demo Service Requests
  // ============================================
  const allServices = await prisma.service.findMany();
  const itrService = allServices.find(s => s.slug === 'itr-filing-assistance')!;
  const gstService = allServices.find(s => s.slug === 'gst-registration')!;
  const licService = allServices.find(s => s.slug === 'lic-insurance-services')!;

  const req1 = await prisma.serviceRequest.create({
    data: {
      requestId: 'REQ-2026-0001',
      customerId: customer1.id,
      serviceId: itrService.id,
      status: 'DOCUMENTS_RECEIVED',
      message: 'Need help filing ITR for assessment year 2026-27.',
      assessmentYear: '2026-27',
      incomeType: 'Salary',
    },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { serviceRequestId: req1.id, newStatus: 'NEW', note: 'Request submitted', changedBy: 'system' },
      { serviceRequestId: req1.id, oldStatus: 'NEW', newStatus: 'DOCUMENTS_REQUIRED', note: 'Documents requested', changedBy: admin.id },
      { serviceRequestId: req1.id, oldStatus: 'DOCUMENTS_REQUIRED', newStatus: 'DOCUMENTS_RECEIVED', note: 'Documents uploaded by customer', changedBy: 'system' },
    ],
  });

  const req2 = await prisma.serviceRequest.create({
    data: {
      requestId: 'REQ-2026-0002',
      customerId: customer2.id,
      serviceId: gstService.id,
      status: 'IN_PROGRESS',
      message: 'Need GST registration for my new business.',
      businessName: 'Priya Fashion Boutique',
      gstStatus: 'Not Registered',
    },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { serviceRequestId: req2.id, newStatus: 'NEW', note: 'Request submitted', changedBy: 'system' },
      { serviceRequestId: req2.id, oldStatus: 'NEW', newStatus: 'DOCUMENTS_RECEIVED', note: 'All documents received', changedBy: admin.id },
      { serviceRequestId: req2.id, oldStatus: 'DOCUMENTS_RECEIVED', newStatus: 'UNDER_REVIEW', note: 'Documents under verification', changedBy: admin.id },
      { serviceRequestId: req2.id, oldStatus: 'UNDER_REVIEW', newStatus: 'IN_PROGRESS', note: 'Registration application submitted', changedBy: admin.id },
    ],
  });

  const req3 = await prisma.serviceRequest.create({
    data: {
      requestId: 'REQ-2026-0003',
      customerId: customer3.id,
      serviceId: licService.id,
      status: 'COMPLETED',
      message: 'Need assistance with LIC policy renewal.',
      policyNumber: 'LIC-XXXX-DEMO',
    },
  });
  await prisma.requestStatusHistory.createMany({
    data: [
      { serviceRequestId: req3.id, newStatus: 'NEW', note: 'Request submitted', changedBy: 'system' },
      { serviceRequestId: req3.id, oldStatus: 'NEW', newStatus: 'IN_PROGRESS', note: 'Assisting with renewal', changedBy: admin.id },
      { serviceRequestId: req3.id, oldStatus: 'IN_PROGRESS', newStatus: 'COMPLETED', note: 'Policy renewal completed', changedBy: admin.id },
    ],
  });
  console.log('✅ Demo service requests created');

  // ============================================
  // Demo Appointments
  // ============================================
  await prisma.appointment.createMany({
    data: [
      {
        customerId: customer1.id,
        serviceId: itrService.id,
        date: '2026-10-10',
        time: '10:00',
        status: 'CONFIRMED',
        message: 'Need to discuss ITR filing documents.',
      },
      {
        customerId: customer2.id,
        serviceId: gstService.id,
        date: '2026-10-12',
        time: '14:00',
        status: 'PENDING',
        message: 'Follow-up on GST registration.',
      },
    ],
  });
  console.log('✅ Demo appointments created');

  // ============================================
  // Demo Testimonials
  // ============================================
  await prisma.testimonial.createMany({
    data: [
      {
        name: 'Suresh Mehta',
        location: 'Delhi',
        rating: 5,
        content: 'Excellent service! They helped me file my ITR smoothly and on time. Very professional and transparent throughout the process. Highly recommended!',
        service: 'ITR Filing',
      },
      {
        name: 'Anita Joshi',
        location: 'Mumbai',
        rating: 5,
        content: 'I was confused about GST registration for my small business. They guided me through every step and got my GSTIN within a week. Very grateful for their support.',
        service: 'GST Registration',
      },
      {
        name: 'Vikram Singh',
        location: 'Jaipur',
        rating: 5,
        content: 'Best consultation experience! They explained all the tax-saving options clearly and helped me plan my investments wisely. The team is very knowledgeable.',
        service: 'Tax Consultation',
      },
      {
        name: 'Kavita Reddy',
        location: 'Hyderabad',
        rating: 4,
        content: 'Very reliable LIC assistance. They helped me understand my policy better and guided me through the claim process. Quick response and always available.',
        service: 'LIC Services',
      },
    ],
  });
  console.log('✅ Demo testimonials created');

  // ============================================
  // Demo YouTube Videos
  // ============================================
  await prisma.youTubeVideo.createMany({
    data: [
      {
        title: 'How to File ITR Online - Step by Step Guide',
        description: 'Learn the complete process of filing your Income Tax Return online. This video covers all the important steps and common mistakes to avoid.',
        videoUrl: 'https://www.youtube.com/watch?v=ZKcCmWeW7sI',
        videoId: 'ZKcCmWeW7sI',
        thumbnailUrl: 'https://img.youtube.com/vi/ZKcCmWeW7sI/mqdefault.jpg',
        sortOrder: 1,
      },
      {
        title: 'GST Registration Process Explained',
        description: 'Everything you need to know about GST registration - required documents, eligibility, and step-by-step application process.',
        videoUrl: 'https://www.youtube.com/watch?v=zfgXNZxoq58',
        videoId: 'zfgXNZxoq58',
        thumbnailUrl: 'https://img.youtube.com/vi/zfgXNZxoq58/mqdefault.jpg',
        sortOrder: 2,
      },
      {
        title: 'Top Tax Saving Tips for Salaried Employees',
        description: 'Discover the best ways to save tax under Section 80C, 80D, and other deductions available for salaried individuals.',
        videoUrl: 'https://www.youtube.com/watch?v=I_tBLiowbrw',
        videoId: 'I_tBLiowbrw',
        thumbnailUrl: 'https://img.youtube.com/vi/I_tBLiowbrw/mqdefault.jpg',
        sortOrder: 3,
      },
    ],
  });
  console.log('✅ Demo YouTube videos created');

  // ============================================
  // Demo Blog Posts
  // ============================================
  await prisma.blogPost.createMany({
    data: [
      {
        title: 'Documents Required for ITR Filing',
        slug: 'documents-required-for-itr-filing',
        content: `## Documents Required for Income Tax Return Filing\n\nFiling your Income Tax Return (ITR) requires proper documentation. Here is a comprehensive list of documents you should keep ready:\n\n### For Salaried Individuals\n- **PAN Card** - Mandatory for all tax filings\n- **Aadhaar Card** - Linked with PAN\n- **Form 16** - Provided by your employer\n- **Form 26AS** - Tax credit statement\n- **Bank Statements** - All savings and current accounts\n- **Investment Proofs** - For Section 80C deductions\n- **Home Loan Certificate** - If applicable\n- **Medical Insurance Premium Receipts** - For Section 80D\n\n### For Business/Professional Income\n- All the above documents\n- **Profit & Loss Statement**\n- **Balance Sheet**\n- **GST Returns** (if registered)\n- **Business expense receipts**\n\n### Important Tips\n1. Keep all documents organized before starting the filing process\n2. Verify Form 26AS matches with your TDS certificates\n3. Report all sources of income, including interest income\n4. File your return before the due date to avoid penalties\n\n*Need help with your ITR filing? Contact us for professional assistance.*`,
        excerpt: 'A comprehensive list of all documents needed for filing your Income Tax Return, covering salaried individuals and business owners.',
        category: 'itr',
        isPublished: true,
        publishedAt: new Date(),
        authorName: 'Admin',
      },
      {
        title: 'GST Registration: Basic Requirements and Process',
        slug: 'gst-registration-basic-requirements',
        content: `## GST Registration: What You Need to Know\n\nGoods and Services Tax (GST) registration is mandatory for businesses exceeding certain turnover thresholds. Here's everything you need to know:\n\n### Who Needs GST Registration?\n- Businesses with annual turnover exceeding ₹40 lakhs (₹20 lakhs for special category states)\n- Service providers with turnover exceeding ₹20 lakhs (₹10 lakhs for special category states)\n- Inter-state suppliers\n- E-commerce operators and sellers\n- Existing VAT/CST/Service Tax registrants\n\n### Required Documents\n- **PAN Card** of the business/proprietor\n- **Aadhaar Card** of authorized signatory\n- **Proof of business address** (electricity bill, rent agreement)\n- **Bank account details** with cancelled cheque\n- **Photograph** of authorized signatory\n- **Digital Signature** (for companies and LLPs)\n\n### Registration Process\n1. Visit the GST Portal (www.gst.gov.in)\n2. Fill out Form GST REG-01\n3. Upload required documents\n4. Submit the application\n5. Receive Application Reference Number (ARN)\n6. Verification by tax officer\n7. Receive GSTIN\n\n*The process typically takes 7-10 working days. Contact us for assistance with your GST registration.*`,
        excerpt: 'Learn about GST registration requirements, required documents, and the complete registration process.',
        category: 'gst',
        isPublished: true,
        publishedAt: new Date(),
        authorName: 'Admin',
      },
      {
        title: 'Things to Check Before Buying an Insurance Policy',
        slug: 'things-to-check-before-buying-insurance',
        content: `## Key Factors to Consider Before Buying Insurance\n\nInsurance is an important financial decision. Here are essential things to verify before purchasing any insurance policy:\n\n### 1. Understand Your Needs\n- Assess your financial responsibilities\n- Determine the coverage amount you need\n- Consider your family's future requirements\n\n### 2. Compare Policies\n- Don't just look at premiums\n- Compare benefits and coverage\n- Check claim settlement ratio\n- Read policy terms carefully\n\n### 3. Check the Insurer\n- Verify the insurer's claim settlement ratio\n- Check financial stability ratings\n- Read customer reviews\n\n### 4. Read the Fine Print\n- Understand exclusions\n- Know the waiting period\n- Check renewal terms\n- Understand the surrender value\n\n### 5. Rider Benefits\n- Accidental death benefit\n- Critical illness cover\n- Premium waiver\n\n### 6. Tax Benefits\n- Section 80C deductions for life insurance\n- Section 80D for health insurance\n- Tax-free maturity benefits under Section 10(10D)\n\n*Need help choosing the right insurance policy? Book a consultation with us for personalized guidance.*`,
        excerpt: 'Essential factors to consider before purchasing an insurance policy, including coverage comparison and claim settlement ratios.',
        category: 'insurance',
        isPublished: true,
        publishedAt: new Date(),
        authorName: 'Admin',
      },
    ],
  });
  console.log('✅ Demo blog posts created');

  // ============================================
  // Demo Admin Notes
  // ============================================
  await prisma.adminNote.create({
    data: {
      adminId: admin.id,
      customerId: customer1.id,
      serviceRequestId: req1.id,
      content: 'Customer has submitted Form 16 and bank statements. Waiting for PAN copy.',
    },
  });
  console.log('✅ Demo admin notes created');

  console.log('\n✨ Database seeded successfully!\n');
  console.log('📧 Admin Login: admin@example.com');
  console.log('🔑 Admin Password: ChangeMe123!');
  console.log('\n⚠️  IMPORTANT: Change these credentials before production use!\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/admin/dashboard & /api/admin/stats - Dashboard statistics
router.get(['/dashboard', '/stats'], authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const [
      totalCustomers,
      newEnquiries,
      pendingRequests,
      activeRequests,
      completedRequests,
      todaysAppointments,
      requestsByService,
      requestsByStatus,
      recentRequests,
      recentEnquiries,
      monthlyStats,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.contactEnquiry.count({ where: { isRead: false } }),
      prisma.serviceRequest.count({ where: { status: 'NEW' } }),
      prisma.serviceRequest.count({
        where: { status: { in: ['DOCUMENTS_REQUIRED', 'DOCUMENTS_RECEIVED', 'UNDER_REVIEW', 'IN_PROGRESS'] } },
      }),
      prisma.serviceRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.appointment.count({
        where: { date: todayStr, status: { in: ['PENDING', 'CONFIRMED'] } },
      }),
      prisma.serviceRequest.groupBy({
        by: ['serviceId'],
        _count: true,
      }),
      prisma.serviceRequest.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.serviceRequest.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, phone: true } },
          service: { select: { name: true } },
        },
      }),
      prisma.contactEnquiry.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      // Monthly requests for the last 6 months
      prisma.serviceRequest.findMany({
        where: {
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
        },
        select: { createdAt: true, status: true },
      }),
    ]);

    // Resolve service names for requestsByService
    const services = await prisma.service.findMany({
      select: { id: true, name: true },
    });
    const serviceMap = new Map(services.map(s => [s.id, s.name]));

    const requestsByServiceNamed = requestsByService.map(r => ({
      service: serviceMap.get(r.serviceId) || 'Unknown',
      count: r._count,
    }));

    const requestsByStatusFormatted = requestsByStatus.map(r => ({
      status: r.status,
      count: r._count,
    }));

    // Calculate monthly stats
    const monthlyData: Record<string, { requests: number; completed: number }> = {};
    monthlyStats.forEach(r => {
      const month = r.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = { requests: 0, completed: 0 };
      monthlyData[month].requests++;
      if (r.status === 'COMPLETED') monthlyData[month].completed++;
    });

    res.json({
      // Flattened stats for direct access
      totalCustomers,
      activeRequests,
      upcomingAppointments: todaysAppointments,
      // Nested stats
      stats: {
        totalCustomers,
        newEnquiries,
        pendingRequests,
        activeRequests,
        completedRequests,
        todaysAppointments,
      },
      charts: {
        requestsByService: requestsByServiceNamed,
        requestsByStatus: requestsByStatusFormatted,
        monthly: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data,
        })),
      },
      recentRequests,
      recentEnquiries,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/admin/notifications
router.get('/notifications', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { type: 'admin' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const unreadCount = await prisma.notification.count({
      where: { type: 'admin', isRead: false },
    });
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/admin/notifications/:id/read
router.patch('/notifications/:id/read', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.update({
      where: { id: _req.params.id as string },
      data: { isRead: true },
    });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PATCH /api/admin/notifications/read-all
router.patch('/notifications/read-all', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { type: 'admin', isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const logs = await prisma.auditLog.findMany({
      include: { admin: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;

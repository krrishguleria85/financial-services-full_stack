import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/appointments - Public: create appointment
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, email, serviceId, date, time, message } = req.body;

    if (!name || !phone || !date || !time) {
      res.status(400).json({ error: 'Name, phone, date, and time are required' });
      return;
    }

    const cleanPhone = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
      return;
    }

    // Check date is not in the past
    const appointmentDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appointmentDate < today) {
      res.status(400).json({ error: 'Appointment date cannot be in the past' });
      return;
    }

    // Check for double booking
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        date,
        time,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (existingAppointment) {
      res.status(400).json({ error: 'This time slot is already booked. Please select a different time.' });
      return;
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { phone: cleanPhone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { name, phone: cleanPhone, email },
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        customerId: customer.id,
        serviceId: serviceId || null,
        date,
        time,
        message,
      },
    });

    // Notification
    await prisma.notification.create({
      data: {
        type: 'admin',
        title: 'New Appointment',
        message: `New appointment request from ${name} on ${date} at ${time}`,
        link: `/admin/appointments`,
      },
    });

    res.status(201).json({
      message: 'Appointment request submitted successfully. You will receive confirmation shortly.',
      appointment: {
        id: appointment.id,
        date: appointment.date,
        time: appointment.time,
        status: appointment.status,
      },
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to book appointment. Please try again.' });
  }
});

// GET /api/appointments/available-slots - Public: get available slots for a date
router.get('/available-slots', async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.query;
    if (!date) {
      res.status(400).json({ error: 'Date is required' });
      return;
    }

    const bookedSlots = await prisma.appointment.findMany({
      where: {
        date: date as string,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { time: true },
    });

    const allSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '14:00', '14:30', '15:00', '15:30', '16:00',
      '16:30', '17:00', '17:30',
    ];

    const bookedTimes = new Set(bookedSlots.map(s => s.time));
    const availableSlots = allSlots.filter(s => !bookedTimes.has(s));

    res.json({ date, availableSlots, bookedSlots: bookedSlots.length });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

// GET /api/appointments/track - Public: track appointment status
router.get('/track', async (req: Request, res: Response): Promise<void> => {
  try {
    const { appointmentId, phone } = req.query;

    if (!appointmentId || !phone) {
      res.status(400).json({ error: 'Appointment ID and mobile number are required' });
      return;
    }

    const cleanPhone = (phone as string).replace(/[\s\-+]/g, '').replace(/^91/, '');

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId as string,
        customer: { phone: cleanPhone },
      },
      include: {
        service: true,
        customer: { select: { name: true } },
      },
    });

    if (!appointment) {
      res.status(404).json({ error: 'No appointment found with the provided details. Please check your tracking ID and mobile number.' });
      return;
    }

    res.json({
      request: {
        id: appointment.id,
        status: appointment.status,
        service: appointment.service || { name: 'General Consultation' },
        createdAt: appointment.createdAt,
        adminNotes: appointment.adminNote,
        date: appointment.date,
        time: appointment.time,
      },
      documents: [],
      timeline: []
    });
  } catch (error) {
    console.error('Track appointment error:', error);
    res.status(500).json({ error: 'Failed to track appointment' });
  }
});

// GET /api/appointments - Admin: list appointments
router.get('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, date, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (date) where.date = date;

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { time: 'asc' }],
        skip,
        take: parseInt(limit as string),
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json({
      appointments,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// PATCH /api/appointments/:id/status - Admin: update appointment status
router.patch('/:id/status', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, adminNote, newDate, newTime } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const updateData: any = { status, adminNote };
    if (status === 'RESCHEDULED' && newDate && newTime) {
      updateData.date = newDate;
      updateData.time = newTime;
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin!.id,
        action: 'STATUS_CHANGE',
        entityType: 'appointment',
        entityId: appointment.id,
        newValue: JSON.stringify({ status }),
      },
    });

    res.json({ message: 'Appointment updated', appointment });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// DELETE /api/appointments/:id - Admin: delete appointment
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.appointment.findUnique({
      where: { id: req.params.id as string },
    });

    if (!existing) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    await prisma.appointment.delete({
      where: { id: req.params.id as string },
    });

    res.json({ message: 'Appointment deleted' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

export default router;

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

// GET /api/attendance
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Placeholder response; will be implemented with real aggregates
    res.json({ totals: { workedHours: 0, overtimeHours: 0, lateCount: 0, absenceCount: 0, pausesHours: 0 }, rows: [] });
  } catch (error) {
    console.error('Attendance history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/export
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
      return res.send('employee,date,first_check_in,last_check_out,worked_hours,pauses_hours,status\n');
    }
    // Basic placeholder PDF response
    res.json({ message: 'PDF export à implémenter' });
  } catch (error) {
    console.error('Attendance export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/corrections
router.post('/corrections', authenticateToken, async (req, res) => {
  try {
    // Placeholder; to be wired with prisma models
    res.status(201).json({ id: 0, status: 'PENDING' });
  } catch (error) {
    console.error('Create correction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/attendance/corrections/:id
router.patch('/corrections/:id', authenticateToken, requireRole('MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    res.json({ id: Number(id), status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' });
  } catch (error) {
    console.error('Review correction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// Punch endpoint for login/leave
router.post('/punch', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    if (!['CHECK_IN', 'CHECK_OUT'].includes(type)) {
      return res.status(400).json({ error: 'Invalid punch type' });
    }

    const now = new Date();
    const userId = req.user.id;

    const punch = await prisma.attendancePunch.create({
      data: { userId, type, timestamp: now, source: 'SYSTEM' }
    });

    // Upsert daily aggregate (use UTC midnight to match DATE column and avoid TZ drift)
    const dayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    await prisma.attendanceDay.upsert({
      where: {
        userId_date: {
          userId,
          date: dayDate
        }
      },
      update: {
        ...(type === 'CHECK_IN' && { firstCheckIn: now }),
        ...(type === 'CHECK_OUT' && { lastCheckOut: now })
      },
      create: {
        userId,
        depotId: req.user.depotId || null,
        date: dayDate,
        firstCheckIn: type === 'CHECK_IN' ? now : null,
        lastCheckOut: type === 'CHECK_OUT' ? now : null,
        isComplete: false
      }
    });

    await logAudit(userId, 'attendance_punches', punch.id, 'CREATE', null, { type, timestamp: now });
    return res.status(201).json(punch);
  } catch (error) {
    console.error('Punch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



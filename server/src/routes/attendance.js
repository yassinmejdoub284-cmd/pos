const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

// GET /api/attendance
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, department, view } = req.query;
    
    // Build where clause
    const whereClause = {};
    
    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate + 'T00:00:00.000Z'),
        lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }
    
    if (employeeId) {
      whereClause.userId = parseInt(employeeId);
    }
    
    if (department) {
      whereClause.depotId = parseInt(department);
    }
    
    // Get attendance days with user and depot info
    const attendanceDays = await prisma.attendanceDay.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            depotId: true
          }
        },
        depot: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { user: { firstName: 'asc' } }
      ]
    });
    
    // Calculate totals
    const totals = {
      workedHours: 0,
      overtimeHours: 0,
      lateCount: 0,
      absenceCount: 0,
      pausesHours: 0
    };
    
    // Transform data and calculate totals
    const rows = attendanceDays.map(day => {
      const workedHours = day.workedSeconds / 3600;
      const overtimeHours = day.overtimeSeconds / 3600;
      const pausesHours = day.pausesSeconds / 3600;
      
      // Update totals
      totals.workedHours += workedHours;
      totals.overtimeHours += overtimeHours;
      totals.pausesHours += pausesHours;
      if (day.isLate) totals.lateCount++;
      if (day.isAbsent) totals.absenceCount++;
      
      return {
        employeeId: day.user.id,
        employeeName: `${day.user.firstName} ${day.user.lastName}`,
        department: day.depot?.name || 'N/A',
        date: day.date.toISOString().split('T')[0],
        firstCheckIn: day.firstCheckIn?.toISOString(),
        lastCheckOut: day.lastCheckOut?.toISOString(),
        pausesSeconds: day.pausesSeconds,
        workedSeconds: day.workedSeconds,
        overtimeSeconds: day.overtimeSeconds,
        isLate: day.isLate,
        isAbsent: day.isAbsent,
        isComplete: day.isComplete,
        status: day.isAbsent ? 'ABSENCE' : (day.isComplete ? 'COMPLET' : 'INCOMPLET')
      };
    });
    
    // Filter by view if specified
    let filteredRows = rows;
    if (view === 'PRESENCES') {
      filteredRows = rows.filter(r => !r.isAbsent);
    } else if (view === 'RETARDS') {
      filteredRows = rows.filter(r => r.isLate);
    } else if (view === 'ABSENCES') {
      filteredRows = rows.filter(r => r.isAbsent);
    } else if (view === 'OVERTIME') {
      filteredRows = rows.filter(r => r.overtimeSeconds > 0);
    }
    
    res.json({ 
      totals: {
        workedHours: Math.round(totals.workedHours * 100) / 100,
        overtimeHours: Math.round(totals.overtimeHours * 100) / 100,
        lateCount: totals.lateCount,
        absenceCount: totals.absenceCount,
        pausesHours: Math.round(totals.pausesHours * 100) / 100
      }, 
      rows: filteredRows 
    });
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

// GET /api/attendance/details/:userId
router.get('/details/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = {
        gte: new Date(startDate + 'T00:00:00.000Z'),
        lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }
    
    // Get attendance days for the user
    const attendanceDays = await prisma.attendanceDay.findMany({
      where: {
        userId: parseInt(userId),
        ...dateFilter
      },
      orderBy: { date: 'desc' },
      take: 30 // Limit to last 30 days
    });
    
    // Get punch history for more detailed info
    const punches = await prisma.attendancePunch.findMany({
      where: {
        userId: parseInt(userId),
        ...(startDate && endDate ? {
          timestamp: {
            gte: new Date(startDate + 'T00:00:00.000Z'),
            lte: new Date(endDate + 'T23:59:59.999Z')
          }
        } : {})
      },
      orderBy: { timestamp: 'desc' },
      take: 100
    });
    
    // Transform data
    const loginHistory = attendanceDays.map(day => ({
      date: day.date.toISOString().split('T')[0],
      loginTime: day.firstCheckIn ? day.firstCheckIn.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }) : null,
      logoutTime: day.lastCheckOut ? day.lastCheckOut.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }) : null,
      workedHours: Math.round((day.workedSeconds / 3600) * 100) / 100,
      isLate: day.isLate,
      isAbsent: day.isAbsent,
      isComplete: day.isComplete
    }));
    
    const punchHistory = punches.map(punch => ({
      type: punch.type,
      timestamp: punch.timestamp.toISOString(),
      time: punch.timestamp.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }),
      date: punch.timestamp.toISOString().split('T')[0],
      source: punch.source
    }));
    
    res.json({
      loginHistory,
      punchHistory,
      summary: {
        totalDays: attendanceDays.length,
        presentDays: attendanceDays.filter(d => !d.isAbsent).length,
        lateDays: attendanceDays.filter(d => d.isLate).length,
        absentDays: attendanceDays.filter(d => d.isAbsent).length,
        totalWorkedHours: Math.round((attendanceDays.reduce((sum, d) => sum + d.workedSeconds, 0) / 3600) * 100) / 100
      }
    });
  } catch (error) {
    console.error('Attendance details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Punch endpoint for login/leave
router.post('/punch', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    if (!['CHECK_IN', 'CHECK_OUT'].includes(type)) {
      return res.status(400).json({ error: 'Invalid punch type' });
    }
    
    // Use authenticated user's ID instead of body userId for security
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const now = new Date();

    const punch = await prisma.attendancePunch.create({
      data: { userId, type, timestamp: now, source: 'SYSTEM' }
    });

    // Upsert daily aggregate (use UTC midnight to match DATE column and avoid TZ drift)
    const dayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Get user info to get depot ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { depotId: true }
    });

    // Get existing day record
    const existingDay = await prisma.attendanceDay.findUnique({
      where: {
        userId_date: {
          userId,
          date: dayDate
        }
      }
    });

    let updateData = {};
    
    if (type === 'CHECK_IN') {
      updateData.firstCheckIn = now;
      // Check if late (assuming work starts at 8:00 AM)
      const workStartTime = new Date(dayDate);
      workStartTime.setUTCHours(8, 0, 0, 0);
      updateData.isLate = now > workStartTime;
      // Don't set lastCheckOut on check-in
      updateData.lastCheckOut = null;
    } else if (type === 'CHECK_OUT') {
      updateData.lastCheckOut = now;
      
      // Calculate worked hours if we have both check-in and check-out
      const firstCheckIn = existingDay?.firstCheckIn;
      if (firstCheckIn) {
        const workedSeconds = Math.floor((now.getTime() - firstCheckIn.getTime()) / 1000);
        updateData.workedSeconds = workedSeconds;
        
        // Check for overtime (assuming 8 hours = 28800 seconds is standard)
        const standardWorkSeconds = 8 * 3600; // 8 hours
        if (workedSeconds > standardWorkSeconds) {
          updateData.overtimeSeconds = workedSeconds - standardWorkSeconds;
        }
        
        // Mark as complete
        updateData.isComplete = true;
      }
    }

    await prisma.attendanceDay.upsert({
      where: {
        userId_date: {
          userId,
          date: dayDate
        }
      },
      update: updateData,
      create: {
        userId,
        depotId: user?.depotId || null,
        date: dayDate,
        firstCheckIn: type === 'CHECK_IN' ? now : null,
        lastCheckOut: type === 'CHECK_OUT' ? now : null,
        workedSeconds: 0,
        overtimeSeconds: 0,
        pausesSeconds: 0,
        isLate: type === 'CHECK_IN' ? (now > new Date(dayDate.getTime() + 8 * 60 * 60 * 1000)) : false,
        isAbsent: false,
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



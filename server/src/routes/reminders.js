const express = require('express');
const multer = require('multer');
const path = require('path');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes here require auth
router.use(authenticateToken);

// Configure multer for voice uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/voice'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'voice-' + uniqueSuffix + '.webm');
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers audio sont autorisés'), false);
    }
  }
});

// Helper: compute tomorrow 08:30 Africa/Tunis in UTC
function getTomorrowMorning(targetTz) {
  const now = new Date();
  const date = new Date(now);
  date.setDate(now.getDate() + 1);
  // 08:30 in Africa/Tunis is UTC+1 or +2 depending DST; rely on string parse with tz not supported in Node.
  // Store local target wall time; admin and client will convert consistently. Here we simply set 08:30 local.
  date.setHours(8, 30, 0, 0);
  return date;
}

// Helper: get assignment data based on target type
function getAssignmentData(body, currentUserId) {
  if (body.targetType === 'ME') {
    // For "ME", assign to current user
    return {
      createMany: { data: [{ userId: currentUserId }] }
    };
  } else if (body.targetType === 'USERS' && body.userIds && body.userIds.length) {
    // For specific users
    return {
      createMany: { data: body.userIds.map(uid => ({ userId: uid })) }
    };
  }
  // For ROLES or ALL_COMPANY, no direct assignments needed
  return undefined;
}

// Admin: list reminders with filters
router.get('/', async (req, res) => {
  try {
    const { statut, priorite, audience, recurrence, dateFrom, dateTo, q } = req.query;
    const where = {};
    if (statut) where.status = statut;
    if (priorite) where.priority = priorite;
    if (recurrence) where.recurrenceType = recurrence;
    if (q) where.OR = [
      { title: { contains: String(q), mode: 'insensitive' } },
      { description: { contains: String(q), mode: 'insensitive' } }
    ];
    if (dateFrom || dateTo) where.dueAt = {
      gte: dateFrom ? new Date(String(dateFrom)) : undefined,
      lte: dateTo ? new Date(String(dateTo)) : undefined
    };
    // audience filter is broad; client can filter locally using targets
    const reminders = await prisma.reminder.findMany({
      where,
      include: { roleTargets: true }
    });
    res.json(reminders);
  } catch (e) {
    res.status(500).json({ error: 'Erreur chargement rappels' });
  }
});

// Admin: create reminder
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const reminder = await prisma.reminder.create({
      data: {
        title: body.title,
        description: body.description || null,
        dueAt: new Date(body.dueAt),
        timezone: body.timezone || 'Africa/Tunis',
        priority: body.priority || 'NORMAL',
        recurrenceType: body.recurrenceType || 'NONE',
        recurrenceText: body.recurrenceText || null,
        targetType: body.targetType,
        visibilityScope: body.visibilityScope || 'TARGETS',
        snoozeAllowed: body.snoozeAllowed ?? true,
        snoozeMaxMin: body.snoozeMaxMin ?? null,
        escalateAfterMin: body.escalateAfterMin ?? null,
        escalateToRole: body.escalateToRole || null,
        escalateToUserId: body.escalateToUserId || null,
        allowVoiceResponses: body.allowVoiceResponses ?? false,
        status: 'ACTIVE',
        createdById: req.user.id,
        roleTargets: body.roles && body.roles.length ? {
          create: body.roles.map(r => ({ role: r }))
        } : undefined,
        assignments: getAssignmentData(body, req.user.id)
      },
      include: { roleTargets: true }
    });
    res.json(reminder);
  } catch (e) {
    console.error('Error creating reminder:', e);
    res.status(400).json({ error: 'Erreur création rappel: ' + (e.message || 'Erreur inconnue') });
  }
});

// Admin: get detail
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: { roleTargets: true, assignments: true }
    });
    if (!reminder) return res.status(404).json({ error: 'Rappel introuvable' });
    res.json(reminder);
  } catch (e) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Admin: update
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        timezone: body.timezone,
        priority: body.priority,
        recurrenceType: body.recurrenceType,
        recurrenceText: body.recurrenceText,
        targetType: body.targetType,
        visibilityScope: body.visibilityScope,
        snoozeAllowed: body.snoozeAllowed,
        snoozeMaxMin: body.snoozeMaxMin,
        escalateAfterMin: body.escalateAfterMin,
        escalateToRole: body.escalateToRole,
        escalateToUserId: body.escalateToUserId,
        allowVoiceResponses: body.allowVoiceResponses,
        updatedById: req.user.id
      }
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: 'Erreur mise à jour' });
  }
});

// Admin: pause/resume/cancel/delete
router.post('/:id/action', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { action } = req.body;
    
    if (action === 'delete') {
      // Actually delete the reminder and all related records
      await prisma.reminderAssignment.deleteMany({ where: { reminderId: id } });
      await prisma.reminderRoleTarget.deleteMany({ where: { reminderId: id } });
      await prisma.reminderVoiceResponse.deleteMany({ where: { reminderId: id } });
      await prisma.reminder.delete({ where: { id } });
      res.json({ success: true, deleted: true });
    } else {
      // For other actions, just update status
      const map = { pause: 'PAUSED', resume: 'ACTIVE', cancel: 'CANCELLED' };
      if (!map[action]) return res.status(400).json({ error: 'Action inconnue' });
      const updated = await prisma.reminder.update({ where: { id }, data: { status: map[action] } });
      res.json(updated);
    }
  } catch (e) {
    console.error('Error in reminder action:', e);
    res.status(400).json({ error: 'Erreur action: ' + (e.message || 'Erreur inconnue') });
  }
});

// End-user: get due reminders (max 3) - for login flow (ignores snooze)
router.get('/me/due', async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    // For login flow, show ALL active reminders regardless of snooze status
    // direct assignments due and unread (ignore snooze for login)
    const direct = await prisma.reminderAssignment.findMany({
      where: {
        userId,
        isRead: false,
        reminder: { status: 'ACTIVE', dueAt: { lte: now } }
      },
      include: { reminder: true },
      orderBy: { updatedAt: 'desc' },
      take: 3
    });

    // role-based
    const role = req.user.role;
    const roleDue = await prisma.reminder.findMany({
      where: {
        status: 'ACTIVE',
        dueAt: { lte: now },
        roleTargets: { some: { role } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 3
    });

    // company-wide
    const companyDue = await prisma.reminder.findMany({
      where: { status: 'ACTIVE', dueAt: { lte: now }, targetType: 'ALL_COMPANY' },
      orderBy: { updatedAt: 'desc' },
      take: 3
    });

    // merge unique by id and cap 3
    const merged = [];
    const pushUnique = (r) => { if (!merged.find(x => x.id === r.id)) merged.push(r); };
    direct.forEach(a => pushUnique(a.reminder));
    roleDue.forEach(pushUnique);
    companyDue.forEach(pushUnique);

    res.json(merged.slice(0, 3));
  } catch (e) {
    res.status(500).json({ error: 'Erreur récupération des rappels' });
  }
});

// End-user: get due reminders (max 3) - for in-app use (respects snooze)
router.get('/me/due-respect-snooze', async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    // direct assignments due and unread or snoozedUntil <= now
    const direct = await prisma.reminderAssignment.findMany({
      where: {
        userId,
        OR: [
          { snoozedUntil: null },
          { snoozedUntil: { lte: now } }
        ],
        isRead: false,
        reminder: { status: 'ACTIVE', dueAt: { lte: now } }
      },
      include: { reminder: true },
      orderBy: { updatedAt: 'desc' },
      take: 3
    });

    // role-based
    const role = req.user.role;
    const roleDue = await prisma.reminder.findMany({
      where: {
        status: 'ACTIVE',
        dueAt: { lte: now },
        roleTargets: { some: { role } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 3
    });

    // company-wide
    const companyDue = await prisma.reminder.findMany({
      where: { status: 'ACTIVE', dueAt: { lte: now }, targetType: 'ALL_COMPANY' },
      orderBy: { updatedAt: 'desc' },
      take: 3
    });

    // merge unique by id and cap 3
    const merged = [];
    const pushUnique = (r) => { if (!merged.find(x => x.id === r.id)) merged.push(r); };
    direct.forEach(a => pushUnique(a.reminder));
    roleDue.forEach(pushUnique);
    companyDue.forEach(pushUnique);

    res.json(merged.slice(0, 3));
  } catch (e) {
    res.status(500).json({ error: 'Erreur récupération des rappels' });
  }
});

// Get next snooze expiration time for scheduling
router.get('/me/next-snooze', async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    // Find the earliest snooze expiration time
    const nextSnooze = await prisma.reminderAssignment.findFirst({
      where: {
        userId,
        snoozedUntil: { gt: now },
        isRead: false,
        reminder: { status: 'ACTIVE' }
      },
      select: {
        snoozedUntil: true
      },
      orderBy: {
        snoozedUntil: 'asc'
      }
    });

    res.json({ 
      nextSnoozeTime: nextSnooze?.snoozedUntil || null,
      hasSnoozedReminders: !!nextSnooze
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur récupération du prochain snooze' });
  }
});

// End-user: mark as read
router.post('/:id/read', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    // if assignment exists, mark read else create a read assignment to prevent re-show
    const existing = await prisma.reminderAssignment.findFirst({ where: { reminderId: id, userId } });
    let result;
    if (existing) {
      result = await prisma.reminderAssignment.update({ where: { id: existing.id }, data: { isRead: true, snoozedUntil: null } });
    } else {
      result = await prisma.reminderAssignment.create({ data: { reminderId: id, userId, isRead: true } });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: 'Erreur marquage comme lu' });
  }
});

// End-user: snooze
router.post('/:id/snooze', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    const { minutes, demainMatin } = req.body || {};
    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) return res.status(404).json({ error: 'Rappel introuvable' });
    if (!reminder.snoozeAllowed) return res.status(400).json({ error: 'Snooze non autorisé' });

    let until;
    if (demainMatin) {
      until = getTomorrowMorning(reminder.timezone);
    } else {
      const mins = Number(minutes || 0);
      until = new Date(Date.now() + mins * 60000);
    }
    // respect snoozeMaxMin
    if (reminder.snoozeMaxMin && !demainMatin) {
      const maxUntil = new Date(Date.now() + reminder.snoozeMaxMin * 60000);
      if (until > maxUntil) until = maxUntil;
    }

    const existing = await prisma.reminderAssignment.findFirst({ where: { reminderId: id, userId } });
    let result;
    if (existing) {
      result = await prisma.reminderAssignment.update({ where: { id: existing.id }, data: { snoozedUntil: until, isRead: false } });
    } else {
      result = await prisma.reminderAssignment.create({ data: { reminderId: id, userId, snoozedUntil: until, isRead: false } });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: 'Erreur de report (snooze)' });
  }
});

// Admin: upload voice message for reminder
router.post('/:id/voice', upload.single('voice'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier vocal requis' });
    }
    
    const voiceUrl = `/uploads/voice/${req.file.filename}`;
    const updated = await prisma.reminder.update({
      where: { id },
      data: { voiceMessageUrl: voiceUrl }
    });
    res.json({ voiceUrl, reminder: updated });
  } catch (e) {
    res.status(400).json({ error: 'Erreur upload message vocal' });
  }
});

// End-user: post voice response
router.post('/:id/voice-response', upload.single('voice'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier vocal requis' });
    }
    
    const voiceUrl = `/uploads/voice/${req.file.filename}`;
    const duration = Math.round(req.body.duration || 0);
    
    const response = await prisma.reminderVoiceResponse.create({
      data: { reminderId: id, userId, voiceUrl, duration }
    });
    res.json(response);
  } catch (e) {
    res.status(400).json({ error: 'Erreur envoi réponse vocale' });
  }
});

// Get voice responses for a reminder
router.get('/:id/voice-responses', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const responses = await prisma.reminderVoiceResponse.findMany({
      where: { reminderId: id },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(responses);
  } catch (e) {
    res.status(500).json({ error: 'Erreur récupération réponses vocales' });
  }
});

module.exports = router;



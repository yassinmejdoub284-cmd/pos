const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// List companies with depot counts
router.get('/', async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { depots: true } }
      }
    });
    const data = companies.map(c => ({
      ...c,
      depotCount: c._count.depots
    }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company by id with its depots
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const company = await prisma.company.findUnique({
      where: { id },
      include: { depots: true }
    });
    if (!company) return res.status(404).json({ error: 'Not found' });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create company
router.post('/', async (req, res) => {
  const payload = req.body;
  try {
    const company = await prisma.company.create({ data: payload });
    res.status(201).json(company);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create company' });
  }
});

// Update company
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const payload = req.body;
  try {
    const company = await prisma.company.update({ where: { id }, data: payload });
    res.json(company);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update company' });
  }
});

// Delete company (soft-delete could be used; here hard delete if no deps)
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    // Unassign depots before delete
    await prisma.depot.updateMany({ where: { companyId: id }, data: { companyId: null } });
    await prisma.company.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete company' });
  }
});

// List unassigned depots (or not belonging to this company)
router.get('/:id/unassigned-depots', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const depots = await prisma.depot.findMany({ where: { companyId: null } });
    res.json(depots);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch depots' });
  }
});

// Assign multiple depots to company
router.post('/:id/depots', async (req, res) => {
  const id = Number(req.params.id);
  const { depotIds } = req.body; // number[]
  if (!Array.isArray(depotIds)) return res.status(400).json({ error: 'depotIds array required' });
  try {
    await prisma.depot.updateMany({ where: { id: { in: depotIds } }, data: { companyId: id } });
    const depots = await prisma.depot.findMany({ where: { companyId: id } });
    res.json(depots);
  } catch (err) {
    res.status(400).json({ error: 'Failed to assign depots' });
  }
});

// Unassign a depot
router.delete('/:id/depots/:depotId', async (req, res) => {
  const id = Number(req.params.id);
  const depotId = Number(req.params.depotId);
  try {
    await prisma.depot.update({ where: { id: depotId }, data: { companyId: null } });
    const depots = await prisma.depot.findMany({ where: { companyId: id } });
    res.json(depots);
  } catch (err) {
    res.status(400).json({ error: 'Failed to unassign depot' });
  }
});

module.exports = router;

// ---- File upload setup (company logos) ----
const LOGOS_DIR = path.join((process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '../..')), 'uploads/logos');
if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `logo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Upload logo and return URL (no DB write)
router.post('/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    return res.json({ logoUrl });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Upload logo and persist on a company
router.post('/:id/logo', upload.single('logo'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    const updated = await prisma.company.update({ where: { id }, data: { logoUrl } });
    return res.json({ logoUrl, company: updated });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to upload logo' });
  }
});



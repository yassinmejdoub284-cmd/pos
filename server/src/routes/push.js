const express = require('express');
const { saveSubscription } = require('../lib/push');

const router = express.Router();

// Save a push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const body = req.body || {};
    const subscription = body.subscription?.endpoint ? body.subscription : (body.endpoint ? body : null);
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    saveSubscription(subscription);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save subscription' + (e?.message ? ' : ' + e.message : ''), code: e?.code });
  }
});

module.exports = router;



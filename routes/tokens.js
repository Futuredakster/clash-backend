const express = require('express');
const { nanoid } = require('nanoid');
const {StreamToken} = require('../models');

const router = express.Router();

router.post('/', async (req, res) => {
  const { bracket_id } = req.body;
  if (!bracket_id) return res.status(400).json({ error: 'bracket_id required' });

  // ✅ Check if a host already exists for this round
  const existingHost = await StreamToken.findOne({
    where: { bracket_id, role: 'host', isActive: true },
  });

  if (existingHost) {
    return res.status(400).json({ error: 'A host already exists for this bracket_id' });
  }

  const hostToken = 'host-' + nanoid(10);
  const viewerToken = 'view-' + nanoid(10);

  await Promise.all([
    StreamToken.create({ token: hostToken, bracket_id, role: 'host',isActive: true }),
    StreamToken.create({ token: viewerToken, bracket_id, role: 'viewer', isActive: true}),
  ]);


  res.json({ hostToken, viewerToken });
});

router.get('/', async (req,res) => {
    const { bracket_id } = req.query;
    if (!bracket_id) return res.status(400).json({ error: 'bracket not found'})
    const viewerToken = await StreamToken.findOne({
    where: { bracket_id, role: 'viewer',isActive: true},
    });
    if (!viewerToken) return res.status(404).json({ error: 'No stream token'})
        res.json(viewerToken.token)
})

module.exports = router;

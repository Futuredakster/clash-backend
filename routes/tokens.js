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

// New endpoint to get bracket_id from token
router.get('/bracket-id', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token required' });
    
    try {
        const streamToken = await StreamToken.findOne({
            where: { token, isActive: true }
        });
        
        if (!streamToken) {
            return res.status(404).json({ error: 'Token not found or inactive' });
        }
        
        res.json({ 
            bracket_id: streamToken.bracket_id,
            role: streamToken.role 
        });
    } catch (error) {
        console.error('Error fetching bracket_id from token:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

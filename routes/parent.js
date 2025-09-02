const express = require("express");
const router = express.Router();
const {Parent,participant,EmailVerification} = require ("../models");
const jwt = require('jsonwebtoken');
const {validateParent} = require("../middlewares/validateParent");
const { Resend } = require('resend');
const { Op } = require('sequelize');
require('dotenv').config();
const resend = new Resend(process.env.SENDGRID_API_KEY);

router.post("/", async (req, res) => {
    const {name,email} = req.body;
    if(!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
    }
    if(await isEmailAlreadyInDivision(email)) {
        return res.status(400).json({ error: "Email already registered" });
    }
    try {
        const newParent = await Parent.create({
            name,
            email
        })
        const parentToken = jwt.sign({ id: newParent.parent_id, name:newParent.name}, 'your_jwt_secret');
        res.json({ id: newParent.parent_id, name: newParent.name, parentToken });

    } catch(error){
        console.error("Error creating parent:", error);
        res.status(500).json({ error: "Internal server error" });
    }
})

router.get("/auth", validateParent, async (req, res) => {
  res.json(req.parent);
})

router.get("/details", validateParent, async (req, res) => {
  const parent = req.parent;
  try {
    const parentDetails = await Parent.findOne({ 
      where: { parent_id: parent.id },
      attributes: ['parent_id', 'name', 'email', 'created_at']
    });
    
    if (!parentDetails) {
      return res.status(404).json({ error: "Parent not found" });
    }
    
    res.json({
      id: parentDetails.parent_id,
      name: parentDetails.name,
      email: parentDetails.email,
      created_at: parentDetails.created_at
    });
  } catch (error) {
    console.error("Error fetching parent details:", error);
    res.status(500).json({ error: "Failed to fetch parent details" });
  }
})

router.put("/details", validateParent, async (req, res) => {
  const { name, email } = req.body;
  const parent = req.parent;
  
  try {
    // Find the parent record
    const parentRecord = await Parent.findOne({ 
      where: { parent_id: parent.id }
    });
    
    if (!parentRecord) {
      return res.status(404).json({ error: "Parent not found" });
    }
    
    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined && name.trim() !== '') {
      updateData.name = name.trim();
    }
    if (email !== undefined && email.trim() !== '') {
      const trimmedEmail = email.trim();
      
      // Check if email is being changed and if new email already exists
      if (trimmedEmail !== parentRecord.email) {
        const existingParent = await Parent.findOne({ 
          where: { 
            email: trimmedEmail,
            parent_id: { [Op.ne]: parent.id } // Exclude current parent
          }
        });
        
        if (existingParent) {
          return res.status(400).json({ error: "Email address is already in use by another account" });
        }
      }
      
      updateData.email = trimmedEmail;
    }
    
    // Only update if there's something to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    
    // Update the parent record
    Object.assign(parentRecord, updateData);
    await parentRecord.save({ validate: true });
    
    res.json({
      message: "Parent details updated successfully",
      parent: {
        id: parentRecord.parent_id,
        name: parentRecord.name,
        email: parentRecord.email
      }
    });
    
  } catch (error) {
    console.error("Error updating parent details:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "Email address is already in use" });
    }
    res.status(500).json({ error: "Failed to update parent details" });
  }
})

router.post("/participants", validateParent, async (req, res) => {
  const { parent_id, children } = req.body;
  
  if (!children || !Array.isArray(children) || children.length === 0) {
    return res.status(400).json({ error: "Children array is required" });
  }
  
  try {
    const createdParticipants = [];
    
    for (const child of children) {
      const newChild = await participant.create({
        ...child,
        parent_id
      });
      createdParticipants.push(newChild);
    }
    
    res.json({ 
      message: "Participants created successfully",
      participants: createdParticipants,
      count: createdParticipants.length
    });
    
  } catch (error) {
    console.error("Error creating participants:", error);
    res.status(500).json({ error: "Failed to create participants" });
  }
});

router.get("/participants", validateParent, async (req, res) => {
    const parent = req.parent;
    try {
        const participants = await participant.findAll({ where: { parent_id: parent.id } });
        res.json(participants);
    } catch (error) {
        console.error("Error fetching participants:", error);
        res.status(500).json({ error: "Failed to fetch participants" });
    }
});

router.post("/auth", async (req,res) => {
 const email = req.body.email;
 const parents = await Parent.findOne({ where: { email } });
 if(parents){
    const code = Math.floor(100000 + Math.random() * 900000).toString();
     await EmailVerification.create({
      code,
      parent_id: parents.parent_id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
     emailer(email,code);
    res.status(201).json({ parent_id: parents.parent_id});
  } else{
    res.status(500).json({error:'Your email wasnt found please register for a tournament if you havent yet or retry your email'});
  }
});

router.post('/code', async (req,res) => {
    const {code,parent_id} = req.body;
    const parents = await Parent.findOne({ where: { parent_id } });
    const name = parents.name;
    console.log("Parent found:", name);
    try {
        await EmailVerification.destroy({
          where: {
         expiresAt: {
        [Op.lt]: new Date(), // delete all expired codes
                },
             },
        });
        const verify = await EmailVerification.findOne({
            where: {
                code,
                parent_id,
                expiresAt: {
                    [Op.gt]: new Date()
                }
            }
        });
         console.log("Verification entry:", verify);
         if (!verify) {
              return res.status(400).json({ error: 'Invalid or expired code.' });
            }
        
            // Optionally mark the code as verified if you want
            await verify.update({ verified: true });
        
            // Create a JWT token and send it back
            const parentToken = jwt.sign({ id: parent_id, name }, "your_jwt_secret", {
              expiresIn: '30m',
            });
         
            res.json({ parentToken, id: parent_id, name:name});
        
          } catch (err) {
            console.error('Error during verification:', err);
            res.status(500).json({ error: 'Server error during verification.' });
          }
})
 

const isEmailAlreadyInDivision = async (email) => {
    const parent = await Parent.findOne({ where: { email} });
    return parent !== null;
};

router.put("/participants/:participant_id", validateParent, async (req, res) => {
  const { participant_id } = req.params;
  const { name, date_of_birth, belt_color } = req.body;
  const parent = req.parent;
  
  try {
    // First, verify the participant belongs to this parent
    const child = await participant.findOne({ 
      where: { 
        participant_id: participant_id,
        parent_id: parent.id 
      } 
    });
    
    if (!child) {
      return res.status(404).json({ error: "Child not found or not authorized" });
    }
    
    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined && name.trim() !== '') {
      updateData.name = name.trim();
    }
    if (date_of_birth !== undefined && date_of_birth !== '') {
      updateData.date_of_birth = date_of_birth;
    }
    if (belt_color !== undefined && belt_color !== '') {
      updateData.belt_color = belt_color;
    }
    
    // Only update if there's something to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    
    // Update the participant instance directly
    Object.assign(child, updateData);
    await child.save({ validate: true });
    
    res.json({
      message: "Child updated successfully",
      participant: child
    });
    
  } catch (error) {
    console.error("Error updating participant:", error);
    res.status(500).json({ error: "Failed to update child information" });
  }
});

const emailer = (email, message) => {
  const msg = resend.emails.send({
    from: 'onboarding@resend.dev', // Change to your verified sender
      to: email, // Change to your recipient
    subject: 'Your Verification Code',
    html: `<p>Your verification code is: <strong>${message}</strong></p>`,
  })
  if(msg){
      console.log('Email sent')
    }else{
      console.error(error)
    }
}

module.exports = router;
const express = require("express");
const { participant, ParticipantDivision, EmailVerification } = require("../models");
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const { Resend } = require('resend');
const { validateToken } = require("../middlewares/AuthMiddleware");
const { validateParticipant } = require('../middlewares/validateParticipant')
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
require('dotenv').config();


const resend = new Resend(process.env.SENDGRID_API_KEY);

router.post('/', async (req, res) => {
  try {
    const { name, date_of_birth, belt_color, division_id, age_group, proficiency_level, email } = req.body;

    if (!name || !date_of_birth || !belt_color || !division_id || !age_group) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isAge(age_group, date_of_birth)) {
      return res.json({ error: 'Wrong age' });
    }
    if (!canCompete(proficiency_level, belt_color)) {
      return res.json({ error: "Wrong division level" });
    }
    const emailExists = await isEmailAlreadyInDivision(email,division_id);
    if (emailExists) {
      return res.json({ error: "This email is already registered" });
    }

    const newParticipant = await participant.create({
      name,
      date_of_birth,
      belt_color,
      email
    });
    
    const newParticipantDivision = await ParticipantDivision.create({
      participant_id: newParticipant.participant_id, // Use the correct ID field for participant_id
      division_id,
      created_at: new Date(),
      modified_at: new Date()
    });
    // emailer(email);
    res.status(201).json(newParticipant);
  } catch (error) {
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/auth', async (req,res) => {
  const email = req.body.email;
  const participent = await participant.findOne({
    where: {
      email:email
    }
  })
  if(participent){
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await EmailVerification.create({
      code,
      participant_id: participent.participant_id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    emailer(email,code);
    res.status(201).json({ participant_id : participent.participant_id});
  } else{
    res.status(500).json({error:'Your email wasnt found please register for a tournament if you havent yet or retry your email'});
  }
});






router.post('/code', async (req, res) => {
  const { code, participant_id } = req.body;

  const participent = await participant.findOne({
    where: {
      participant_id
    }
  });

  const name = participent.name;

  console.log("Received participant_id:", participant_id);  // Log the received participant_id

  try {
    // Clean up expired codes first
    await EmailVerification.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date(), // delete all expired codes
        },
      },
    });

    // Verify the code and participant_id
    const verify = await EmailVerification.findOne({
      where: {
        code,
        participant_id,  // Ensure participant_id is a proper value
        expiresAt: {
          [Op.gt]: new Date(), // Check if the code is still valid (not expired)
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
    const token = jwt.sign({ participant_id, name }, "importantsecrets", {
      expiresIn: '30m',
    });
 
    res.json({ token, id: participant_id, name:name});

  } catch (err) {
    console.error('Error during verification:', err);
    res.status(500).json({ error: 'Server error during verification.' });
  }
});

// modifications: added name field to the token being created

router.get('/', async (req, res) => {
  const { division_id } = req.query;
  try {
    const participantIds = await ParticipantDivision.findAll({
      where: {
        division_id
      },
      attributes: ['participant_id']
      // only return whats in the attribute
    });

    const ids = participantIds.map(pd => pd.participant_id);
  // Filters it so you only get the values of the ids
    const participants = await participant.findAll({
      where: {
        participant_id: ids
      },
      attributes: ['name']
    });

    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/All', async (req, res) => {
  try {
    const { division_id } = req.query; // get division_id from query params
    if (!division_id) {
      return res.status(400).json({ error: "division_id is required" });
    }

    // Get all participant_ids in this division
    const participantDivisions = await ParticipantDivision.findAll({
      where: { division_id },
      attributes: ['participant_id']
    });

    const participantIds = participantDivisions.map(pd => pd.participant_id);

    // Fetch participant names
    const participants = await participant.findAll({
      where: { participant_id: participantIds },
      attributes: ['name', 'participant_id', 'email'] // optional: include email for reference
    });

    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', validateToken, async (req, res) => {
  try {
     const userObj = req.user;
     const { search } = req.query;
     
     // Build where clause with search functionality
     const whereClause = { account_id: userObj.account_id };
     
     if (search && search.trim()) {
       whereClause[Op.or] = [
         { name: { [Op.like]: `%${search.trim()}%` } },
         { email: { [Op.like]: `%${search.trim()}%` } },
         { belt_color: { [Op.like]: `%${search.trim()}%` } }
       ];
     }
     
     const participants = await participant.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']] // Latest participants first
    });
    res.json(participants);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})


router.get('/user', validateToken, async (req, res) => {
  const { division_id } = req.query;
  try {
    const participantIds = await ParticipantDivision.findAll({
      where: {
        division_id
      },
      attributes: ['participant_id']
    });

    const ids = participantIds.map(pd => pd.participant_id);

    const participants = await participant.findAll({
      where: {
        participant_id: ids
      }
    });

    // Also fetch division information
    const { Divisions, tournaments } = require('../models');
    const division = await Divisions.findOne({
      where: { division_id }
    });

    let tournamentInfo = null;
    if (division && division.tournament_id) {
      tournamentInfo = await tournaments.findOne({
        where: { tournament_id: division.tournament_id },
        attributes: ['tournament_name', 'tournament_id']
      });
    }

    res.json({
      participants,
      division: division ? {
        division_id: division.division_id,
        division_name: division.division_name,
        age_group: division.age_group,
        proficiency_level: division.proficiency_level,
        gender: division.gender,
        category: division.category,
        tournament: tournamentInfo
      } : null
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// try outs 
router.post('/login', async (req, res) => {
  try {
    const { name, date_of_birth, belt_color, email } = req.body;

    if (!name || !date_of_birth || !belt_color || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const newParticipant = await participant.create({
      name,
      date_of_birth,
      belt_color,
      email
    });
     const token = jwt.sign({ participant_id: newParticipant.participant_id, name }, "importantsecrets", {
      expiresIn: '30m',
    });
   res.json({ token, id: newParticipant.participant_id, name });
  } catch (error) {
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/auths', validateParticipant, (req,res) => {
res.json(req.participant);
});

router.get('/details', validateParticipant, async (req, res) => {
  const participantToken = req.participant;
  try {
    const participantDetails = await participant.findOne({ 
      where: { participant_id: participantToken.participant_id },
      attributes: ['participant_id', 'name', 'date_of_birth', 'belt_color', 'email', 'created_at']
    });
    
    if (!participantDetails) {
      return res.status(404).json({ error: "Participant not found" });
    }
    
    res.json({
      id: participantDetails.participant_id,
      name: participantDetails.name,
      date_of_birth: participantDetails.date_of_birth,
      belt_color: participantDetails.belt_color,
      email: participantDetails.email,
      created_at: participantDetails.created_at
    });
  } catch (error) {
    console.error("Error fetching participant details:", error);
    res.status(500).json({ error: "Failed to fetch participant details" });
  }
});

router.put('/details', validateParticipant, async (req, res) => {
  const { name, email, date_of_birth, belt_color } = req.body;
  const participantToken = req.participant;
  
  try {
    // Find the participant record
    const participantRecord = await participant.findOne({ 
      where: { participant_id: participantToken.participant_id }
    });
    
    if (!participantRecord) {
      return res.status(404).json({ error: "Participant not found" });
    }
    
    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined && name.trim() !== '') {
      updateData.name = name.trim();
    }
    if (email !== undefined && email.trim() !== '') {
      const trimmedEmail = email.trim();
      
      // Check if email is being changed and if new email already exists
      if (trimmedEmail !== participantRecord.email) {
        const existingParticipant = await participant.findOne({ 
          where: { 
            email: trimmedEmail,
            participant_id: { [Op.ne]: participantToken.participant_id } // Exclude current participant
          }
        });
        
        if (existingParticipant) {
          return res.status(400).json({ error: "Email address is already in use by another participant" });
        }
      }
      
      updateData.email = trimmedEmail;
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
    
    // Update the participant record
    Object.assign(participantRecord, updateData);
    await participantRecord.save({ validate: true });
    
    res.json({
      message: "Participant details updated successfully",
      participant: {
        id: participantRecord.participant_id,
        name: participantRecord.name,
        email: participantRecord.email,
        date_of_birth: participantRecord.date_of_birth,
        belt_color: participantRecord.belt_color
      }
    });
    
  } catch (error) {
    console.error("Error updating participant details:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "Email address is already in use" });
    }
    res.status(500).json({ error: "Failed to update participant details" });
  }
});

router.post("/bulk", validateToken, async (req, res) => {
   const participants = req.body.participants;
   const userObj = req.user;
   if (!Array.isArray(participants) || participants.length === 0) {
     return res.status(400).json({ error: "Invalid participants data" });
   }

   if (!userObj || !userObj.account_id) {
     return res.status(403).json({ error: "User not authorized" });
   }
   try{
     for(const competitor of participants) {
      if(await compareEmail(competitor.email)){
        return res.status(400).json({ error: `Email ${competitor.email} is already in use` });
      }
       await participant.create({
         ...competitor,
         account_id: userObj.account_id
       });
     }
     res.status(201).json({ message: "Participants created successfully" });
   }catch(error){
     console.error("Error creating participants:", error);
     res.status(500).json({ error: "Failed to create participants" });
   }
});

router.put("/:participant_id", validateToken, async (req, res) => {
  try {
    const { participant_id } = req.params;
    const userObj = req.user;
    const updateData = req.body;

    // Find the participant and verify ownership
    const existingParticipant = await participant.findOne({
      where: { 
        participant_id: participant_id,
        account_id: userObj.account_id 
      }
    });

    if (!existingParticipant) {
      return res.status(404).json({ error: 'Participant not found or access denied' });
    }

    // Build update object with only provided fields (all optional)
    const fieldsToUpdate = {};
    
    if (updateData.name !== undefined && updateData.name.trim() !== '') {
      fieldsToUpdate.name = updateData.name.trim();
    }
    
    if (updateData.email !== undefined && updateData.email.trim() !== '') {
      const trimmedEmail = updateData.email.trim();
      
      // Check if email is being changed and if new email already exists
      if (trimmedEmail !== existingParticipant.email) {
        const emailExists = await participant.findOne({
          where: { 
            email: trimmedEmail,
            participant_id: { [Op.ne]: participant_id } // Exclude current participant
          }
        });
        
        if (emailExists) {
          return res.status(400).json({ error: 'Email address is already in use by another participant' });
        }
      }
      
      fieldsToUpdate.email = trimmedEmail;
    }
    
    if (updateData.date_of_birth !== undefined && updateData.date_of_birth !== '') {
      fieldsToUpdate.date_of_birth = updateData.date_of_birth;
    }
    
    if (updateData.belt_color !== undefined && updateData.belt_color !== '') {
      fieldsToUpdate.belt_color = updateData.belt_color;
    }

    // Only update if there's something to update
    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Update the participant
    await existingParticipant.update(fieldsToUpdate);

    res.json({
      message: 'Participant updated successfully',
      participant: {
        participant_id: existingParticipant.participant_id,
        name: existingParticipant.name,
        email: existingParticipant.email,
        date_of_birth: existingParticipant.date_of_birth,
        belt_color: existingParticipant.belt_color
      }
    });

  } catch (error) {
    console.error('Error updating participant:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Email address is already in use' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete("/:participant_id", validateToken, async (req, res) => {
  try {
    const { participant_id } = req.params;
    const userObj = req.user;

    // Find the participant and verify ownership
    const existingParticipant = await participant.findOne({
      where: { 
        participant_id: participant_id,
        account_id: userObj.account_id 
      }
    });

    if (!existingParticipant) {
      return res.status(404).json({ error: 'Participant not found or access denied' });
    }

    // Delete the participant
    await existingParticipant.destroy();

    res.json({
      message: 'Participant deleted successfully',
      participant_id: participant_id
    });

  } catch (error) {
    console.error('Error deleting participant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  
// Email function -----------------------------------------------------------------------------------------------------------------------------------
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

// helper functions ---------------------------------------------------------------------------------------------------------------------

function canCompete(level, userBelt) {
  const beginnerBelts = ["white", "yellow"];
  const intermediateBelts = ["orange", "green"];
  const advancedBelts = ["purple", "brown", "black"];

  level = level.toLowerCase();
  userBelt = userBelt.toLowerCase();

  if (level === "begginer") {
    return beginnerBelts.includes(userBelt);
  } else if (level === "intermediate") {
    return intermediateBelts.includes(userBelt) || beginnerBelts.includes(userBelt);
  } else if (level === "advanced") {
    return advancedBelts.includes(userBelt) || intermediateBelts.includes(userBelt) || beginnerBelts.includes(userBelt);
  }
  return false;
}

function isAge(age_group, date_of_birth) {
  const [minAge, maxAge] = age_group.split('-').map(Number);
  const [year, month, day] = date_of_birth.split('-').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  const dayDifference = today.getDate() - birthDate.getDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age--;
  }

  if (age < minAge || age > maxAge) {
    return false;
  }
  return true;
}

async function compareEmail(email) {
  const sameEmail = await participant.findOne({
    where: {
      email: email,
    },
  });
  if (sameEmail != null) {
    return true;
  }
  return false;
}

async function isEmailAlreadyInDivision(email, divisionId) {
  // Find all participants with this email
  const participants = await participant.findAll({ where: { email } });

  if (participants.length === 0) {
    // No participants with this email, so no conflict
    return false;
  }

  // Collect participant IDs
  const participantIds = participants.map(p => p.participant_id);

  // Check if any of these participant IDs are assigned to the division
  const count = await ParticipantDivision.count({
    where: {
      participant_id: participantIds,
      division_id: divisionId,
    },
  });

  return count > 0;
}




module.exports = router;







































/*const express = require("express");
const {participant} = require("../models");
const router = express.Router();
const sgMail = require('@sendgrid/mail')
const { validateToken } = require("../middlewares/AuthMiddleware");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


router.post('/', async (req, res) => {
  try {
    const { name, date_of_birth, belt_color, division_id, age_group,proficiency_level,email} = req.body;

    if (!name || !date_of_birth || !belt_color || !division_id || !age_group) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isAge(age_group,date_of_birth)) {
      return res.json({ error: 'Wrong age' });
    }

     if(!canCompete(proficiency_level,belt_color)){
     return  res.json({error: "Wrong division level"});
     }
     
     const emailExists = await compareEmail(email,division_id); 
     if (emailExists) {
       return res.json({ error: "This email is already registered" });
     }

    const newParticipant = await participant.create({
      name,
      date_of_birth,
      belt_color,
      division_id,
      email
    });
   // emailer(email);
    res.status(201).json(newParticipant);
  } catch (error) {
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/', async (req,res)=>{
  const { division_id } = req.query;
  try{
  const names = await participant.findAll({
    where: {
      division_id: division_id
    },
    attributes: ['name']
  });

  res.json(names);
} catch (error) {
  console.error('Error fetching participants:', error);
  throw error;
}
})

router.get('/user',validateToken, async (req,res)=>{
  const { division_id } = req.query;
  try{
  const participants = await participant.findAll({
    where: {
      division_id: division_id
    }
  });

  res.json(participants);
} catch (error) {
  console.error('Error fetching participants:', error);
  throw error;
}
})



// Email function -----------------------------------------------------------------------------------------------------------------------------------
const emailer = (email) =>{
  const msg = {
    to: email, // Change to your recipient
    from: 'danny.kaikov.m@gmail.com', // Change to your verified sender
    subject: 'Testing',
    text: 'Did you watch Demon Slayer Episode 3 yet',
    html: '<strong>Did you watch Demon Slayer Episode 3 yet ??</strong>',
  }
  sgMail
    .send(msg)
    .then(() => {
      console.log('Email sent')
    })
    .catch((error) => {
      console.error(error)
    })
}



// helper functions ---------------------------------------------------------------------------------------------------------------------

function canCompete(level, userBelt) {
  const beginnerBelts = ["white", "yellow"];
  const intermediateBelts = ["orange", "green"];
  const advancedBelts = ["purple", "brown", "black"];
  
  level = level.toLowerCase();
  userBelt = userBelt.toLowerCase();

  if (level === "begginer") {
      return beginnerBelts.includes(userBelt);
  } else if (level === "intermediate") {
      return intermediateBelts.includes(userBelt) || beginnerBelts.includes(userBelt);
  } else if (level === "advanced") {
      return advancedBelts.includes(userBelt) || intermediateBelts.includes(userBelt) || beginnerBelts.includes(userBelt);
  }
  return false;
}

function isAge(age_group,date_of_birth){
  const [minAge, maxAge] = age_group.split('-').map(Number);
  const [year, month, day] = date_of_birth.split('-').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  const dayDifference = today.getDate() - birthDate.getDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age--;
  }

  if (age < minAge || age > maxAge) {
    return false
  }
  return true;
}

async function compareEmail(email,division_id){
  const sameEmail = await participant.findOne({
    where: {
      email: email,
      division_id: division_id,
    },
  });
  if(sameEmail!=null){
     return true;
  }
  return false;
}


module.exports = router;
*/


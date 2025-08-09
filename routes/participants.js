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
    const token = jwt.sign({ participant_id }, "importantsecrets", {
      expiresIn: '30m',
    });
 
    res.json({ token, id: participant_id });

  } catch (err) {
    console.error('Error during verification:', err);
    res.status(500).json({ error: 'Server error during verification.' });
  }
});





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

router.get('/All', validateParticipant, async (req, res) => {
  try {
    const participant_id = req.participant.participant_id;

    const participantDivision = await ParticipantDivision.findOne({
         where: { participant_id },
       }); 
 
       const division_id = participantDivision.division_id;
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

    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
//
  
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


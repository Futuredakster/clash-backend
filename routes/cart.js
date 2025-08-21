const express = require("express");
const { participant, ParticipantDivision, EmailVerification,cart, Divisions } = require("../models");
const router = express.Router();
const { validateParticipant } = require('../middlewares/validateParticipant')

router.post('/', validateParticipant, async (req, res) => {
     const { division_id, age_group, proficiency_level} = req.body;
   const participant_id = req.participant.participant_id;

     
     const participantData = await participant.findOne({ where: { participant_id: participant_id } });
     const email = participantData.email;
     const belt_color = participantData.belt_color;
     const date_of_birth = participantData.date_of_birth;

     const divisionData = await Divisions.findOne({ where: { division_id: division_id } });
     const cost = divisionData.cost;

   if (!date_of_birth || !belt_color || !division_id || !age_group) {
  console.log("❌ Missing required fields", { date_of_birth, belt_color, division_id, age_group });
  return res.status(400).json({ error: 'Missing required fields' });
}
if (!isAge(age_group, date_of_birth)) {
  console.log("❌ Age validation failed", { age_group, date_of_birth });
  return res.json({ error: 'Wrong age' });
}
if (!canCompete(proficiency_level, belt_color)) {
  console.log("❌ Belt validation failed", { proficiency_level, belt_color });
  return res.json({ error: "Wrong division level" });
}
const emailExists = await isEmailAlreadyInDivision(email, division_id);
if (emailExists) {
  console.log("❌ Email already registered", { email, division_id });
  return res.json({ error: "This email is already registered" });
}


    const cartItem = await cart.create({
      participant_id: participant_id,
      division_id: division_id,
    });

    const newParticipantDivision = await ParticipantDivision.create({
      participant_id: participant_id, // Use the correct ID field for participant_id
      division_id,
      created_at: new Date(),
      modified_at: new Date()
    });

    res.status(201).json({ message: 'Participant added to cart', cartItem });
})


router.get('/', validateParticipant, async (req, res) => {
       const participant_id = req.participant.participant_id;
       const cartItems = await cart.findAll({ where: { participant_id,is_active:true } });
       const divisions = await Divisions.findAll({ where: { division_id: cartItems.map(item => item.division_id) } });
       res.json({ divisions });
})


// helper functions 

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

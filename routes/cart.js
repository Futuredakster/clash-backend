const express = require("express");
const { participant, ParticipantDivision, EmailVerification,cart, Divisions,tournaments,users } = require("../models");
const router = express.Router();
const { validateParticipant } = require('../middlewares/validateParticipant')
const Stripe = require("stripe");
const { Op } = require("sequelize");
const bodyParser = require("body-parser");
require('dotenv').config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);



router.post('/', validateParticipant, async (req, res) => {
     const { division_id, age_group, proficiency_level} = req.body;
   const participant_id = req.participant.participant_id;
//
     
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

   

    res.status(201).json({ message: 'Participant added to cart', cartItem });
})


router.get('/', validateParticipant, async (req, res) => {
       const participant_id = req.participant.participant_id;
       const cartItems = await cart.findAll({ where: { participant_id,is_active:true } });
       const divisions = await Divisions.findAll({ where: { division_id: cartItems.map(item => item.division_id) } });
       res.json({ divisions });
})




router.post("/create-checkout-session", validateParticipant,async (req, res) => {
  try {
    const { cartItems } = req.body;
    const participant_id = req.participant.participant_id;
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // assume all items belong to the same tournament
    const tournament_id = cartItems[0].tournament_id;

    // find the tournament
    const tournament = await tournaments.findOne({ where: { tournament_id } });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    // find the organizer (user) who owns this tournament
    const organizer = await users.findOne({
      where: {
        account_id: tournament.account_id,
        stripe_account: { [Op.ne]: null },
      },
    });
    if (!organizer) {
      return res.status(404).json({ error: "Organizer Stripe account not found" });
    }

    const organizerStripeId = organizer.stripe_account;

    // build Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: cartItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: buildDivisionName(item), // e.g. "Advanced Male Kata 20-21"
          },
          unit_amount: item.cost, // in cents
        },
        quantity: 1,
      })),
      payment_intent_data: {
        application_fee_amount: 500, // optional platform fee
        transfer_data: {
          destination: organizerStripeId,
        },
      },
      success_url: "https://clash-t.netlify.app/CompetitorView",
      cancel_url: "https://clash-t.netlify.app/DisplayCart",
    });

    // 🔑 Save session.id to each cart item so webhook can later mark them paid
    for (const item of cartItems) {
      await cart.update(
        { stripeSessionId: session.id, status: "pending" },
        {
          where: {
            participant_id: participant_id,
            division_id: item.division_id,
          },
        }
      );
    }

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
 
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.sendStatus(400);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // 🔑 Mark cart items as paid
      const cartItems = await cart.findAll({ where: { stripeSessionId: session.id } });
      
      for (const item of cartItems) {
         
          await ParticipantDivision.create({
            participant_id: item.participant_id,
            division_id: item.division_id,
            created_at: new Date(),
            modified_at: new Date()
          });
        }
      await cart.update(
        { status: "paid", is_active: false },
        { where: { stripeSessionId: session.id } }
      );

      

      console.log(`✅ Cart items for session ${session.id} marked as paid`);
    }

    res.json({ received: true });
  }
);


// 1. Create a Checkout Session
/*router.post("/create-checkout-session", async (req, res) => {
  try {
    const { cartItems } = req.body;

    // assume all items belong to same tournament
    const tournament_id = cartItems[1].tournament_id;

    // find the tournament
    const tournament = await tournaments.findOne({ where: { tournament_id } });
    if (!tournament) return res.status(404).json({ error: "Tournament not found" });

    // find the organizer (user) who owns this tournament
    const organizer = await users.findOne({
      where: {
        account_id: tournament.account_id,
        stripe_account: { [Op.ne]: null },
      },
    });
    if (!organizer) return res.status(404).json({ error: "Organizer Stripe account not found" });

    const organizerStripeId = organizer.stripe_account;

    // build Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: cartItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: buildDivisionName(item), // e.g. division name
          },
          unit_amount: item.cost, // in cents
        },
        quantity: 1,
      })),
      payment_intent_data: {
        application_fee_amount: 500, // optional platform fee
        transfer_data: {
          destination: organizerStripeId,
        },
      },
      success_url: "https://clash-t.netlify.app/CompetitorView",
      cancel_url: "https://clash-t.netlify.app/DisplayCart",
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("Error creating checkout session:", err);
    res.status(500).json({ error: err.message });
  }
}); */


// helper functions 
function buildDivisionName(item) {
  // you can tweak capitalization logic to match your frontend
  const cap = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  return `${cap(item.proficiency_level)} ${cap(item.gender)} ${cap(item.category)} ${cap(item.age_group)}`;
}


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

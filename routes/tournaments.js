const express = require("express");
const multer = require("multer");
const router = express.Router();
const { tournaments ,Divisions,ParticipantDivision  } = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");
const { Op } = require("sequelize");
const { cloudinary, storage } = require("../utils/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { validateParticipant } = require('../middlewares/validateParticipant')

const upload = multer({ storage });


router.get("/", validateToken, async (req, res) => {
  console.log('This should show up!');
  const { tournament_name } = req.query;
  try {
    let whereCondition = { is_published: true };
    if (tournament_name && tournament_name.trim() !== "") {
      whereCondition.tournament_name = {
        [Op.like]: `%${tournament_name}%`,
      }; 
    }

    const listOfPosts = await tournaments.findAll({
      where: whereCondition,
      order: [["start_date", "ASC"]],
    });

    const tournamentsWithImageUrl = listOfPosts.map((tournament) => ({
      ...tournament.dataValues,
      imageUrl: tournament.image_filename || null,
    }));

    res.json(tournamentsWithImageUrl);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/praticipent", async (req, res) => {
  const { tournament_name } = req.query;
  try {
    let whereCondition = { is_published: true };
    if (tournament_name && tournament_name.trim() !== "") {
      whereCondition.tournament_name = {
        [Op.like]: `%${tournament_name}%`,
      };
      
    }

    const listOfPosts = await tournaments.findAll({
      where: whereCondition,
      order: [["start_date", "ASC"]],
    });

    const tournamentsWithImageUrl = listOfPosts.map((tournament) => ({
      ...tournament.dataValues,
      imageUrl: tournament.image_filename || null,
    }));

    res.json(tournamentsWithImageUrl);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get("/signup", async (req, res) => {
  const { tournament_name } = req.query;
  const today = new Date().toISOString().split("T")[0];
  try {
    let whereCondition = { is_published: true };
    if (tournament_name && tournament_name.trim() !== "") {
      whereCondition.tournament_name = {
        [Op.like]: `%${tournament_name}%`,
      };
      
    }

    const listOfPosts = await tournaments.findAll({
      where: whereCondition,
      order: [["start_date", "ASC"]],
    });
    const results = listOfPosts.filter(tournament => tournament.signup_duedate >= today);

    const tournamentsWithImageUrl = results.map((tournament) => ({
      ...tournament.dataValues,
      imageUrl: tournament.image_filename || null,
    }));

    res.json(tournamentsWithImageUrl);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get('/OneParticipant', validateParticipant, async (req, res) => {
  const participant_id = req.participant.participant_id;

  try {
    // Step 1: Find the ParticipantDivision that matches the participant_id
    const participantDivision = await ParticipantDivision.findOne({
      where: { participant_id },
    });

    if (!participantDivision) {
      return res.status(404).json({ error: "Participant not found in any division" });
    }

    const division_id = participantDivision.division_id;

    // Step 2: Get the division
    const division = await Divisions.findOne({
      where: { division_id },
    });

    if (!division) {
      return res.status(404).json({ error: "Division not found" });
    }

    // Step 3: Get the tournament using the tournament_id from the division
    const tournament = await tournaments.findOne({
      where: { tournament_id: division.tournament_id },
    });

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json(tournament);
  } catch (err) {
    console.error("Error fetching participant and division:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/default", async (req, res) => {
  try {
    const { tournament_id } = req.query;
    const tournament = await tournaments.findOne({
      where: { tournament_id: tournament_id },
    });

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json(tournament);
  } catch (error) {
    console.error("Error fetching tournament:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/byaccount", validateToken, async (req, res) => {
  const { tournament_name } = req.query;
  const account_id = req.user.account_id;
  try {
    let whereCondition = { account_id };
    if (tournament_name && tournament_name.trim() !== "") {
      whereCondition.tournament_name = {
        [Op.like]: `%${tournament_name}%`,
      };
      
    }
    const listOfPosts = await tournaments.findAll({
      where: whereCondition,
      order: [["start_date", "ASC"]],
    });

    const tournamentsWithImageUrl = listOfPosts.map((tournament) => ({
      ...tournament.dataValues,
      imageUrl: tournament.image_filename || null,
    }));

    res.json(tournamentsWithImageUrl);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", validateToken, upload.single("image"), async (req, res) => {
  try {
    const { tournament_name, start_date, end_date, is_published,signup_duedate } = req.body;
    const account_id = req.user.account_id;
    console.log("POST / route hit - before multer");
    // Check if an image was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }
   console.log("Cloudinary config:", {
  cloud_name: process.env.cloudinary_cloud_name,
  api_key: process.env.cloudinary_api_key,
  api_secret: process.env.cloudinary_api_secret ? '***' : undefined,
});
    // Image upload to Cloudinary (adjust if necessary)
    const imageUrl = req.file?.url || req.file?.path;  // Cloudinary URL might be in `req.file.url`

    console.log("Image URL:", imageUrl);

    // Create tournament entry in the database
    const tournament = await tournaments.create({
      tournament_name,
      start_date,
      end_date,
      is_published,
      account_id,
      image_filename: imageUrl,  // Store Cloudinary URL here
      signup_duedate,
    });

    res.json(tournament);
  } catch (error) {
    console.error("Error creating tournament:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.patch("/", validateToken, upload.single("image"), async (req, res) => {
  try {
    const data = req.body;
    const tournamentRes = await tournaments.findOne({
      where: {
        account_id: req.user.account_id,
        tournament_id: data.tournament_id,
      },
    });

    if (tournamentRes) {
      const Tournament = tournamentRes.dataValues;

      Tournament.tournament_name = isNotNullOrEmpty(data.tournament_name)
        ? data.tournament_name
        : Tournament.tournament_name;
      Tournament.start_date = isNotNullOrEmpty(data.start_date)
        ? data.start_date
        : Tournament.start_date;
      Tournament.end_date = isNotNullOrEmpty(data.end_date)
        ? data.end_date
        : Tournament.end_date;
       Tournament.signup_duedate = isNotNullOrEmpty(data.signup_duedate)
        ? data.signup_duedate
        : Tournament.signup_duedate;

      if (req.file) {
        Tournament.image_filename = req.file.path; // Cloudinary URL will be stored here
      }

      await tournaments.update(Tournament, {
        where: { tournament_id: data.tournament_id },
      });

      res.status(200).json({ message: "Successfully updated" });
    } else {
      console.log("Not found");
      res.status(404).json({ error: "Tournament not found" });
    }
  } catch (error) {
    console.error("Error updating tournament:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.patch("/publish", validateToken, async (req, res) => {
  try {
    const tournament_id = req.body.tournament_id;
    const tournamentRes = await tournaments.findOne({
      where: {
        account_id: req.user.account_id,
        tournament_id: tournament_id,
      },
    });
    if (tournamentRes) {
      const Tournament = tournamentRes.dataValues;
      Tournament.is_published = true;
      await tournaments.update(Tournament, {
        where: { tournament_id: tournament_id },
      });
      res.status(200).json({ message: "Successfully updated" });
    } else {
      console.log("Not found");
      res.status(404).json({ error: "Tournament not found" });
    }
  } catch (error) {
    console.error("Error updating tournament:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/", validateToken, async (req, res) => {
  const account_id = req.user.account_id;
  const tournament_id = req.body.tournament_id;

  try {
    const deletedTournament = await tournaments.destroy({
      where: {
        account_id: account_id,
        tournament_id: tournament_id,
      },
    });

    if (deletedTournament > 0) {
      res.status(200).json({ message: "Tournament deleted successfully." });
    } else {
      res.status(404).json({ message: "Tournament not found or not deleted." });
    }
  } catch (error) {
    console.error("Error occurred while deleting tournament:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

function isNotNullOrEmpty(str) {
  return str !== null && str !== "";
}

module.exports = router;
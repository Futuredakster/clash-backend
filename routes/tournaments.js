const express = require("express");
const multer = require("multer");
const router = express.Router();
const { tournaments ,Divisions,ParticipantDivision,participant, brackets, Mats  } = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");
const { Op } = require("sequelize");
const { cloudinary, storage } = require("../utils/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { validateParticipant } = require('../middlewares/validateParticipant')
const {validateParent} = require("../middlewares/validateParent");

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
  try {
    const participant_id = req.participant.participant_id;
    const participent = await participant.findOne({ where: { participant_id } });

    if (!participent) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const email = participent.email;

    // Get all participant_ids with this email
    const participants = await participant.findAll({ where: { email } });
    const participantIds = participants.map(p => p.participant_id);

    // Get all divisions for those participantIds
    const participantDivisions = await ParticipantDivision.findAll({
      where: { participant_id: { [Op.in]: participantIds } },
    });

    if (participantDivisions.length === 0) {
      return res.status(404).json({ error: "Participant not found in any division" });
    }

    const divisionIds = participantDivisions.map(pd => pd.division_id);

    // Get all divisions
    const divisions = await Divisions.findAll({
      where: { division_id: { [Op.in]: divisionIds } },
    });

    if (divisions.length === 0) {
      return res.status(404).json({ error: "Division not found" });
    }

    // Get all tournaments
    const tournamentIds = divisions.map(d => d.tournament_id);
    const tournamentsList = await tournaments.findAll({
      where: { tournament_id: { [Op.in]: tournamentIds } },
    });

    if (tournamentsList.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json(tournamentsList);

  } catch (err) {
    console.error("Error fetching participant and division:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/parent",validateParent, async (req, res) => {
  try {
  const parent_id = req.parent.id;
  console.log(parent_id)
  const participants = await participant.findAll({ where: { parent_id } });
  const participantIds = participants.map(p => p.participant_id);
  const participantDivisions = await ParticipantDivision.findAll({
      where: { participant_id: { [Op.in]: participantIds } },
    });
    if (participantDivisions.length === 0) {
      return res.status(404).json({ error: "Participant not found in any division" });
    }

    const divisionIds = participantDivisions.map(pd => pd.division_id);

    // Get all divisions
    const divisions = await Divisions.findAll({
      where: { division_id: { [Op.in]: divisionIds } },
    });

    if (divisions.length === 0) {
      return res.status(404).json({ error: "Division not found" });
    }

    // Get all tournaments
    const tournamentIds = divisions.map(d => d.tournament_id);
    const tournamentsList = await tournaments.findAll({
      where: { tournament_id: { [Op.in]: tournamentIds } },
    });

    if (tournamentsList.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json(tournamentsList);

  } catch (err) {
    console.error("Error fetching participant and division:", err);
    res.status(500).json({ error: "Internal server error" });
  }

})


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
    // Verify tournament ownership first
    const tournament = await tournaments.findOne({
      where: {
        account_id: account_id,
        tournament_id: tournament_id,
      },
    });

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found." });
    }

    // Get all divisions for this tournament
    const divisionsInTournament = await Divisions.findAll({
      where: { tournament_id: tournament_id }
    });

    const divisionIds = divisionsInTournament.map(div => div.division_id);

    if (divisionIds.length > 0) {
      // 1. Delete participant_division records first
      await ParticipantDivision.destroy({
        where: { division_id: { [Op.in]: divisionIds } }
      });

      // 2. Delete brackets records for these divisions
      await brackets.destroy({
        where: { division_id: { [Op.in]: divisionIds } }
      });

      // 3. Delete divisions
      await Divisions.destroy({
        where: { tournament_id: tournament_id }
      });
    }

    // 4. Delete mats for this tournament
    await Mats.destroy({
      where: { tournament_id: tournament_id }
    });

    // 5. Finally delete the tournament
    const deletedTournament = await tournaments.destroy({
      where: {
        account_id: account_id,
        tournament_id: tournament_id,
      },
    });

    if (deletedTournament > 0) {
      res.status(200).json({ message: "Tournament and all related data deleted successfully." });
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
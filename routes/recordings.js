// routes/recordings.js
const express = require("express");
const multer = require("multer");
const router = express.Router();
const { recordings, brackets } = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");
const { cloudinary, storage, videoStorage } = require("../utils/cloudinary");

// Configure multer for video uploads
const upload = multer({ 
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  }
});

// POST /recordings - Create a new recording entry and upload to Cloudinary
router.post("/", upload.single("video"), async (req, res) => {
  try {
    console.log('=== RECORDINGS POST REQUEST ===');
    console.log('req.body:', req.body);
    console.log('req.file:', req.file ? 'File uploaded' : 'No file');
    
    const { bracket_id, duration, file_size } = req.body;
    
    // Check if a video file was uploaded
    if (!req.file) {
      console.log('Error: No video file uploaded');
      return res.status(400).json({ error: "Video file is required" });
    }

    // Validate bracket_id
    if (!bracket_id) {
      console.log('Error: No bracket_id provided');
      return res.status(400).json({ error: "bracket_id is required" });
    }

    console.log('Checking if bracket exists...');
    // Verify bracket exists
    const bracket = await brackets.findOne({
      where: { bracket_id: bracket_id }
    });

    if (!bracket) {
      console.log('Error: Bracket not found');
      return res.status(404).json({ error: "Bracket not found" });
    }

    console.log('Bracket found, processing upload...');
    // Get Cloudinary URL from uploaded file
    const videoUrl = req.file?.url || req.file?.path;
    const cloudinaryPublicId = req.file?.public_id;

    console.log("Video URL:", videoUrl);
    console.log("Cloudinary Public ID:", cloudinaryPublicId);

    // Create recording entry in the database
    const recording = await recordings.create({
      bracket_id,
      cloudinary_public_id: cloudinaryPublicId,
      cloudinary_url: videoUrl,
      original_filename: req.file.originalname,
      file_size: file_size || req.file.size,
      duration: duration || null,
      recording_status: 'uploaded',
      started_at: new Date(),
      completed_at: new Date(),
      uploaded_at: new Date()
    });

    res.json(recording);
  } catch (error) {
    console.error("=== ERROR IN RECORDINGS POST ===");
    console.error("Error creating recording:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// GET /recordings - Get recordings by bracket_id
router.get("/", async (req, res) => {
  try {
    const { bracket_id } = req.query;
    
    if (!bracket_id) {
      return res.status(400).json({ error: "bracket_id is required" });
    }

    const recordingsList = await recordings.findAll({
      where: { bracket_id },
      order: [["createdAt", "DESC"]],
    });

    res.json(recordingsList);
  } catch (error) {
    console.error("Error fetching recordings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /recordings/division - Get all recordings for a division
router.get("/division", async (req, res) => {
  try {
    const { division_id } = req.query;
    
    if (!division_id) {
      return res.status(400).json({ error: "division_id is required" });
    }

    // Get recordings with bracket and division info
    const recordingsList = await recordings.findAll({
      include: [{
        model: brackets,
        required: true,
        where: { division_id },
        attributes: ['bracket_id', 'division_id', 'user1', 'user2', 'round', 'is_complete']
      }],
      where: { recording_status: 'uploaded' }, // Only show successfully uploaded recordings
      order: [["createdAt", "DESC"]],
      attributes: [
        'recording_id', 
        'cloudinary_url', 
        'original_filename', 
        'file_size', 
        'duration', 
        'started_at', 
        'completed_at',
        'createdAt'
      ]
    });

    res.json(recordingsList);
  } catch (error) {
    console.error("Error fetching division recordings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /recordings/byaccount - Get recordings by user account
router.get("/byaccount", validateToken, async (req, res) => {
  try {
    const account_id = req.user.account_id;
    
    const recordingsList = await recordings.findAll({
      include: [{
        model: brackets,
        include: [{
          model: tournaments, // If you want to include tournament info
          where: { account_id }
        }]
      }],
      order: [["createdAt", "DESC"]],
    });

    res.json(recordingsList);
  } catch (error) {
    console.error("Error fetching recordings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /recordings - Delete a recording
router.delete("/", validateToken, async (req, res) => {
  try {
    const { recording_id } = req.body;
    
    if (!recording_id) {
      return res.status(400).json({ error: "recording_id is required" });
    }

    // Find the recording first to get Cloudinary public_id
    const recording = await recordings.findOne({
      where: { recording_id }
    });

    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    // Delete from Cloudinary if public_id exists
    if (recording.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(recording.cloudinary_public_id, {
          resource_type: "video"
        });
        console.log("Video deleted from Cloudinary");
      } catch (cloudinaryError) {
        console.error("Error deleting from Cloudinary:", cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    const deletedRecording = await recordings.destroy({
      where: { recording_id }
    });

    if (deletedRecording > 0) {
      res.status(200).json({ message: "Recording deleted successfully." });
    } else {
      res.status(404).json({ message: "Recording not found or not deleted." });
    }
  } catch (error) {
    console.error("Error occurred while deleting recording:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const {Mats} = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");

// Create a new mat
router.post('/', validateToken, async (req, res) => {
    try {
        const { tournament_id, mat_name } = req.body;
        
        if (!tournament_id || !mat_name) {
            return res.status(400).json({ error: "Tournament ID and mat name are required" });
        }

        const mat = await Mats.create({
            tournament_id: tournament_id,
            mat_name: mat_name,
            is_active: true
        });

        res.json({
            message: "Mat created successfully",
            mat: mat
        });
    } catch (error) {
        console.error("Error creating mat:", error);
        
        // Handle unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: "A mat with this name already exists for this tournament" });
        }
        
        res.status(500).json({ error: "Something went wrong while creating the mat" });
    }
});

// Get all mats for a tournament
router.get('/', validateToken, async (req, res) => {
    try {
        const { tournament_id } = req.query;
        
        if (!tournament_id) {
            return res.status(400).json({ error: "Tournament ID is required" });
        }

        const mats = await Mats.findAll({
            where: { tournament_id: tournament_id },
            order: [['mat_id', 'ASC']]
        });

        res.json(mats);
    } catch (error) {
        console.error("Error fetching mats:", error);
        res.status(500).json({ error: "Something went wrong while fetching mats" });
    }
});

// Update mat
router.patch('/', validateToken, async (req, res) => {
    try {
        const { mat_id, mat_name, is_active } = req.body;
        
        if (!mat_id) {
            return res.status(400).json({ error: "Mat ID is required" });
        }

        const mat = await Mats.findOne({ where: { mat_id: mat_id } });
        
        if (!mat) {
            return res.status(404).json({ error: "Mat not found" });
        }

        // Update fields if provided
        if (mat_name !== undefined) mat.mat_name = mat_name;
        if (is_active !== undefined) mat.is_active = is_active;

        await mat.save();

        res.json({
            message: "Mat updated successfully",
            mat: mat
        });
    } catch (error) {
        console.error("Error updating mat:", error);
        res.status(500).json({ error: "Something went wrong while updating the mat" });
    }
});

// Delete mat
router.delete('/', validateToken, async (req, res) => {
    try {
        const { mat_id } = req.body;
        
        if (!mat_id) {
            return res.status(400).json({ error: "Mat ID is required" });
        }

        const deletedMat = await Mats.destroy({
            where: { mat_id: mat_id }
        });

        if (deletedMat > 0) {
            res.json({ message: 'Mat deleted successfully' });
        } else {
            res.status(404).json({ error: 'Mat not found' });
        }
    } catch (error) {
        console.error("Error deleting mat:", error);
        res.status(500).json({ error: "Something went wrong while deleting the mat" });
    }
});

// Delete all mats for a tournament
router.delete('/all', validateToken, async (req, res) => {
    try {
        const { tournament_id } = req.body;
        
        if (!tournament_id) {
            return res.status(400).json({ error: "Tournament ID is required" });
        }

        // First, remove mat assignments from divisions
        const { Divisions } = require("../models");
        await Divisions.update(
            { mat_id: null, is_active: false },
            { where: { tournament_id: tournament_id, mat_id: { [require('sequelize').Op.ne]: null } } }
        );

        // Then delete all mats for the tournament
        const deletedMats = await Mats.destroy({
            where: { tournament_id: tournament_id }
        });

        res.json({ 
            message: `Successfully deleted ${deletedMats} mats and removed all mat assignments`,
            deleted_count: deletedMats 
        });
    } catch (error) {
        console.error("Error deleting all mats:", error);
        res.status(500).json({ error: "Something went wrong while deleting all mats" });
    }
});

module.exports = router;
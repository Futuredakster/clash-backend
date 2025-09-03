const express = require("express");
const router = express.Router();
const {Mats} = require("../models");
const {tournaments} = require("../models");
const {Divisions} = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");

// Create a new mat
router.post('/', validateToken, async (req, res) => {
    try {
        const { tournament_id, mat_name } = req.body;
        const user_account_id = req.user.account_id;
        
        if (!tournament_id || !mat_name) {
            return res.status(400).json({ error: "Tournament ID and mat name are required" });
        }

        // Check if user owns the tournament
        const authCheck = await checkTournamentOwnership(user_account_id, tournament_id);
        if (!authCheck.authorized) {
            return res.status(401).json({ error: authCheck.error });
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
        const user_account_id = req.user.account_id;
        
        if (!tournament_id) {
            return res.status(400).json({ error: "Tournament ID is required" });
        }

        // Check if user owns the tournament
        const authCheck = await checkTournamentOwnership(user_account_id, tournament_id);
        if (!authCheck.authorized) {
            return res.status(401).json({ error: authCheck.error });
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
        const user_account_id = req.user.account_id;
        
        if (!mat_id) {
            return res.status(400).json({ error: "Mat ID is required" });
        }

        const mat = await Mats.findOne({ where: { mat_id: mat_id } });
        
        if (!mat) {
            return res.status(404).json({ error: "Mat not found" });
        }

        // Check if user owns the tournament this mat belongs to
        const authCheck = await checkTournamentOwnership(user_account_id, mat.tournament_id);
        if (!authCheck.authorized) {
            return res.status(401).json({ error: authCheck.error });
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
        const user_account_id = req.user.account_id;
        
        if (!mat_id) {
            return res.status(400).json({ error: "Mat ID is required" });
        }

        // First find the mat to get tournament_id for authorization
        const mat = await Mats.findOne({ where: { mat_id: mat_id } });
        
        if (!mat) {
            return res.status(404).json({ error: "Mat not found" });
        }

        // Check if user owns the tournament this mat belongs to
        const authCheck = await checkTournamentOwnership(user_account_id, mat.tournament_id);
        if (!authCheck.authorized) {
            return res.status(401).json({ error: authCheck.error });
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
        const user_account_id = req.user.account_id;
        
        if (!tournament_id) {
            return res.status(400).json({ error: "Tournament ID is required" });
        }

        // Check if user owns the tournament
        const authCheck = await checkTournamentOwnership(user_account_id, tournament_id);
        if (!authCheck.authorized) {
            return res.status(401).json({ error: authCheck.error });
        }

        // First, remove mat assignments from divisions
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

// Helper function to check tournament ownership
async function checkTournamentOwnership(user_account_id, tournament_id, division_id = null) {
    try {
        console.log("=== checkTournamentOwnership called ===");
        console.log("user_account_id:", user_account_id);
        console.log("tournament_id:", tournament_id);
        console.log("division_id:", division_id);
        
        let tournamentIdToCheck = tournament_id;
        
        // If tournament_id is not provided but division_id is, get tournament_id from division
        if (!tournamentIdToCheck && division_id) {
            console.log("No tournament_id provided, looking up from division_id:", division_id);
            
            const division = await Divisions.findOne({
                where: { division_id: division_id },
                attributes: ['tournament_id']
            });
            
            console.log("Division lookup result:", division);
            
            if (!division) {
                console.log("Division not found");
                return { authorized: false, error: "Division not found" };
            }
            
            tournamentIdToCheck = division.tournament_id;
            console.log("Found tournament_id from division:", tournamentIdToCheck);
        }
        
        if (!tournamentIdToCheck) {
            console.log("No tournament_id available");
            return { authorized: false, error: "Tournament ID is required" };
        }
        
        // Convert to integer to ensure proper database lookup
        const tournamentIdInt = parseInt(tournamentIdToCheck);
        if (isNaN(tournamentIdInt)) {
            console.log("Invalid tournament_id format:", tournamentIdToCheck);
            return { authorized: false, error: "Invalid tournament ID format" };
        }
        
        // Get tournament and check ownership
        console.log("Looking up tournament with ID:", tournamentIdInt);
        const tournament = await tournaments.findOne({
            where: { tournament_id: tournamentIdInt },
            attributes: ['account_id']
        });
        
        console.log("Tournament lookup result:", tournament);
        
        if (!tournament) {
            console.log("Tournament not found");
            return { authorized: false, error: "Tournament not found" };
        }
        
        // Convert account IDs to integers for comparison
        const tournamentAccountId = parseInt(tournament.account_id);
        const userAccountId = parseInt(user_account_id);
        
        console.log("Tournament account_id:", tournamentAccountId);
        console.log("User account_id:", userAccountId);
        console.log("Account IDs match:", tournamentAccountId === userAccountId);
        
        if (tournamentAccountId !== userAccountId) {
            console.log("Authorization failed: User doesn't own tournament");
            return { authorized: false, error: "Unauthorized: You don't own this tournament" };
        }
        
        console.log("Authorization successful");
        return { authorized: true, tournament_id: tournamentIdInt };
    } catch (error) {
        console.error("Error checking tournament ownership:", error);
        return { authorized: false, error: "Internal server error" };
    }
}

module.exports = router;
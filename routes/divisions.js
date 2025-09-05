const express = require("express");
const router = express.Router();
const {Divisions} = require ("../models");
const {participant} = require("../models");
const {ParticipantDivision} = require("../models");
const {tournaments} = require("../models");
const {Mats} = require("../models");
const {Parent} = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");
const { validateParticipant } = require('../middlewares/validateParticipant')
const {validateParent} = require("../middlewares/validateParent");
const { Op } = require("sequelize");
const { Sequelize } = require('sequelize');


router.post('/', validateToken, async (req, res) => {
    try {
      const data = req.body;
      const user_account_id = req.user.account_id;
      
      // Check if user owns the tournament
      const authCheck = await checkTournamentOwnership(user_account_id, data.tournament_id);
      if (!authCheck.authorized) {
        return res.status(401).json({ error: authCheck.error });
      }
      
      console.log("Creating division with data:", data);
      const division = await Divisions.create(data);
      res.json("Bracket Created");
    } catch (error) {
      console.error("Error creating division:", error);
      
      // Check for Sequelize unique constraint violations
      if (error.name === 'SequelizeUniqueConstraintError' || 
          error.name === 'SequelizeValidationError' ||
          error.original?.code === 'ER_DUP_ENTRY' || // MySQL
          error.original?.code === '23505' || // PostgreSQL
          error.original?.code === 'SQLITE_CONSTRAINT') { // SQLite
        res.status(400).json({ 
          error: "A division with these exact details (age group, proficiency level, gender, and category) already exists for this tournament." 
        });
      } else {
        res.status(500).json({ error: "Something went wrong while creating the division." });
      }
    }
  });

router.post('/bulk', validateToken, async (req, res) => {
  try {
    const { divisions, tournament_id } = req.body;
    const user_account_id = req.user.account_id;
    
    // Validate input
    if (!divisions || !Array.isArray(divisions) || divisions.length === 0) {
      return res.status(400).json({ error: "Divisions array is required and cannot be empty" });
    }
    
    if (!tournament_id) {
      return res.status(400).json({ error: "Tournament ID is required" });
    }

    // Check if user owns the tournament
    const authCheck = await checkTournamentOwnership(user_account_id, tournament_id);
    if (!authCheck.authorized) {
      return res.status(401).json({ error: authCheck.error });
    }

    console.log(`Creating ${divisions.length} divisions for tournament ${tournament_id}`);
    
    // Validate each division has required fields
    const requiredFields = ['age_group', 'proficiency_level', 'gender', 'category'];
    for (let i = 0; i < divisions.length; i++) {
      const division = divisions[i];
      for (const field of requiredFields) {
        if (!division[field] || division[field].trim() === '') {
          return res.status(400).json({ 
            error: `Missing required field '${field}' in division ${i + 1}` 
          });
        }
      }
      // Ensure tournament_id is set for each division
      division.tournament_id = tournament_id;
    }

    // Import sequelize instance from models
    const { sequelize } = require('../models');
    const transaction = await sequelize.transaction();
    
    try {
      // Check for existing divisions that would cause duplicates
      const existingDivisions = await Divisions.findAll({
        where: { tournament_id: tournament_id },
        transaction
      });
      
      const duplicates = [];
      divisions.forEach((newDiv, index) => {
        const duplicate = existingDivisions.find(existing => 
          existing.age_group === newDiv.age_group &&
          existing.proficiency_level === newDiv.proficiency_level &&
          existing.gender === newDiv.gender &&
          existing.category === newDiv.category
        );
        
        if (duplicate) {
          duplicates.push({
            index: index + 1,
            details: `${newDiv.age_group} ${newDiv.proficiency_level} ${newDiv.gender} ${newDiv.category}`
          });
        }
      });
      
      if (duplicates.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: "Duplicate divisions found",
          duplicates: duplicates.map(dup => `Division ${dup.index}: ${dup.details}`)
        });
      }
      
      // Create all divisions in bulk
      const createdDivisions = await Divisions.bulkCreate(divisions, {
        transaction,
        validate: true,
        returning: true
      });
      
      await transaction.commit();
      
      console.log(`Successfully created ${createdDivisions.length} divisions`);
      res.json({
        message: `Successfully created ${createdDivisions.length} divisions`,
        count: createdDivisions.length,
        divisions: createdDivisions
      });
      
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
    
  } catch (error) {
    console.error("Error creating bulk divisions:", error);
    
    // Check for Sequelize unique constraint violations
    if (error.name === 'SequelizeUniqueConstraintError' || 
        error.name === 'SequelizeValidationError' ||
        error.original?.code === 'ER_DUP_ENTRY' || // MySQL
        error.original?.code === '23505' || // PostgreSQL
        error.original?.code === 'SQLITE_CONSTRAINT') { // SQLite
      res.status(400).json({ 
        error: "One or more divisions have conflicting details (age group, proficiency level, gender, and category) that already exist for this tournament." 
      });
    } else {
      res.status(500).json({ 
        error: "Something went wrong while creating divisions.",
        details: error.message 
      });
    }
  }
});

  router.get('/',validateToken,async (req,res) =>{
    const { tournament_id, search } = req.query;
    const user_account_id = req.user.account_id;
    
    // Check if user owns the tournament
    const authCheck = await checkTournamentOwnership(user_account_id, tournament_id);
    if (!authCheck.authorized) {
      return res.status(401).json({ error: authCheck.error });
    }
    
    // Build where clause with search functionality
    const whereClause = { tournament_id: tournament_id };
    
    if (search && search.trim()) {
      whereClause[Op.or] = [
        { age_group: { [Op.like]: `%${search.trim()}%` } },
        { proficiency_level: { [Op.like]: `%${search.trim()}%` } },
        { gender: { [Op.like]: `%${search.trim()}%` } },
        { category: { [Op.like]: `%${search.trim()}%` } }
      ];
    }
    
    const divisions = await Divisions.findAll({
        where: whereClause,
      });
      
    // Sort divisions by age group in ascending order (youngest first)
    const sortedDivisions = divisions.sort((a, b) => {
      const rangeA = ageRange(a);
      const rangeB = ageRange(b);
      
      // Sort by minimum age ascending (youngest divisions first)
      if (rangeA[0] !== rangeB[0]) {
        return rangeA[0] - rangeB[0]; // Ascending by min age
      }
      
      // If same min age, sort by maximum age ascending
      if (rangeA[1] !== rangeB[1]) {
        return rangeA[1] - rangeB[1]; // Ascending by max age
      }
      
      // If same age range, sort by proficiency level (beginner first for ascending)
      return getProficiencyOrder(a.proficiency_level) - getProficiencyOrder(b.proficiency_level);
    });
    
    res.json(sortedDivisions);
  });


  router.get('/praticepent', async (req, res) => {
    const { tournament_id, search } = req.query;
  
    try {
      // Build where clause with search functionality
      const whereClause = { tournament_id };
      
      if (search && search.trim()) {
        whereClause[Op.or] = [
          { age_group: { [Op.like]: `%${search.trim()}%` } },
          { proficiency_level: { [Op.like]: `%${search.trim()}%` } },
          { gender: { [Op.like]: `%${search.trim()}%` } },
          { category: { [Op.like]: `%${search.trim()}%` } }
        ];
      }

      const divisions = await Divisions.findAll({
        where: whereClause,
        attributes: {
          include: [
            [Sequelize.fn('COUNT', Sequelize.col('participant_id')), 'participant_count']
          ]
        },
        include: [
          {
            model: ParticipantDivision,
            as: 'participantDivisions', // Use the correct alias
            attributes: [],
          }
        ],
        group: ['Divisions.division_id']
      });
  
      res.json(divisions);
    } catch (error) {
      console.error('Error fetching divisions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
router.get('/partview', validateParticipant, async (req, res) => {
  const participant_id = req.participant.participant_id;
  const { tournamentId } = req.query;
  
  try {
    // Check if participant has access to this tournament
    const accessCheck = await checkParticipantAccess(participant_id, tournamentId);
    if (!accessCheck.authorized) {
      return res.status(401).json({ error: accessCheck.error });
    }
    
    const participent = await participant.findOne({ where: { participant_id } });
    let time = 0;
    // make time a array to store time for each division
    const email = participent.email;

    // Get all participant_ids with this email
    const participants = await participant.findAll({ where: { email } });
    const participantIds = participants.map(p => p.participant_id);

    const participantDivisions = await ParticipantDivision.findAll({
      where: { participant_id: { [Op.in]: participantIds } },
    });

    if (!participantDivisions || participantDivisions.length === 0) {
      return res.status(404).json({ error: "Participant not found in any division" });
    }

    const divisionIds = participantDivisions.map(pd => pd.division_id);

    const divisions = await Divisions.findAll({
      where: { division_id: { [Op.in]: divisionIds }, tournament_id: tournamentId },
    });
    
    const allDivisions = await Divisions.findAll({
      where : {tournament_id: divisions[0].tournament_id},
    });
    allDivisions.sort((a, b) => {
      const [minA, maxA] = ageRange(a);
      const [minB, maxB] = ageRange(b);
      
      // First sort by age range
      if (minA !== minB) return minA - minB;
      if (maxA !== maxB) return maxA - maxB;
      
      // If same age range, sort by proficiency level (beginner first)
      return getProficiencyOrder(a.proficiency_level) - getProficiencyOrder(b.proficiency_level);
    });

    const highestAgeDivision = highetAgeDivision(allDivisions); // typo in 'highet'?
    const lowerAgeDivision = lowestAgeDivision(allDivisions);
    console.log(highestAgeDivision);
    console.log(lowerAgeDivision);
    for (const division of divisions) {
      const myAgeRange = ageRange(division);

      if (myAgeRange[1] > 35) {
        let startIndex = allDivisions.findIndex(
          div => div.division_id === highestAgeDivision.division_id
        );
        console.log(startIndex);
        console.log(allDivisions.length);
         if(startIndex === allDivisions.length - 1){
          startIndex =0;
         }
        for (let i = startIndex; i < allDivisions.length; i++) {
          const range = ageRange(allDivisions[i]);
           console.log("range:",range);
          if (
            range[0] === myAgeRange[0] &&
            range[1] === myAgeRange[1]
          ) {
            console.log("break");
            break;
          }

                  if (
            allDivisions[i] && 
            (range[0] !== myAgeRange[0] || range[1] !== myAgeRange[1]) &&
            !allDivisions[i].is_complete
          )
          {
            console.log("time", allDivisions[i].time);
            time += allDivisions[i].time;
            console.log("time after addition:", time);
          }
        }
      } else if (myAgeRange[1]<35) {
        console.log("else");
        const startIndex = allDivisions.findIndex(
          div => div.division_id === lowerAgeDivision.division_id
        );

        for (let i = startIndex; i < allDivisions.length; i++) {
          const range = ageRange(allDivisions[i]);

          if (
            range[0] === myAgeRange[0] &&
            range[1] === myAgeRange[1]
          ) {
            break;
          }

          if (
          allDivisions[i] && 
          (range[0] !== myAgeRange[0] || range[1] !== myAgeRange[1]) &&
          !allDivisions[i].is_complete
        )
        {
            time += allDivisions[i].time;
          }
        }
      }
    }
      console.log("Total time for participant:", time);
    res.json({ divisions, total_time: time });
  } catch (err) {
    console.error("Error fetching participant and divisions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/parentview", validateParent, async (req, res) => {
  const parent_id = req.parent.id;
  const { tournamentId } = req.query;
  
  try {
    // Check if parent has access to this tournament
    const accessCheck = await checkParentAccess(parent_id, tournamentId);
    if (!accessCheck.authorized) {
      return res.status(401).json({ error: accessCheck.error });
    }
    
    const participants = await participant.findAll({ where: { parent_id } });
    const participantIds = participants.map(p => p.participant_id);
    let time = 0;

    const participantDivisions = await ParticipantDivision.findAll({
      where: { participant_id: { [Op.in]: participantIds } },
    });

    if (!participantDivisions || participantDivisions.length === 0) {
      return res.status(404).json({ error: "Participant not found in any division" });
    }

    const divisionIds = participantDivisions.map(pd => pd.division_id);

    const divisions = await Divisions.findAll({
      where: { division_id: { [Op.in]: divisionIds }, tournament_id: tournamentId },
    });
    
    const allDivisions = await Divisions.findAll({
      where : {tournament_id: divisions[0].tournament_id},
    });
    allDivisions.sort((a, b) => {
      const [minA, maxA] = ageRange(a);
      const [minB, maxB] = ageRange(b);
      
      // First sort by age range
      if (minA !== minB) return minA - minB;
      if (maxA !== maxB) return maxA - maxB;
      
      // If same age range, sort by proficiency level (beginner first)
      return getProficiencyOrder(a.proficiency_level) - getProficiencyOrder(b.proficiency_level);
    });

    const highestAgeDivision = highetAgeDivision(allDivisions); // typo in 'highet'?
    const lowerAgeDivision = lowestAgeDivision(allDivisions);
    console.log(highestAgeDivision);
    console.log(lowerAgeDivision);
    for (const division of divisions) {
      const myAgeRange = ageRange(division);

      if (myAgeRange[1] > 35) {
        let startIndex = allDivisions.findIndex(
          div => div.division_id === highestAgeDivision.division_id
        );
        console.log(startIndex);
        console.log(allDivisions.length);
         if(startIndex === allDivisions.length - 1){
          startIndex =0;
         }
        for (let i = startIndex; i < allDivisions.length; i++) {
          const range = ageRange(allDivisions[i]);
           console.log("range:",range);
          if (
            range[0] === myAgeRange[0] &&
            range[1] === myAgeRange[1]
          ) {
            console.log("break");
            break;
          }

                  if (
            allDivisions[i] && 
            (range[0] !== myAgeRange[0] || range[1] !== myAgeRange[1]) &&
            !allDivisions[i].is_complete
          )
          {
            console.log("time", allDivisions[i].time);
            time += allDivisions[i].time;
            console.log("time after addition:", time);
          }
        }
      } else if (myAgeRange[1]<35) {
        console.log("else");
        const startIndex = allDivisions.findIndex(
          div => div.division_id === lowerAgeDivision.division_id
        );

        for (let i = startIndex; i < allDivisions.length; i++) {
          const range = ageRange(allDivisions[i]);

          if (
            range[0] === myAgeRange[0] &&
            range[1] === myAgeRange[1]
          ) {
            break;
          }

          if (
          allDivisions[i] && 
          (range[0] !== myAgeRange[0] || range[1] !== myAgeRange[1]) &&
          !allDivisions[i].is_complete
        )
        {
            time += allDivisions[i].time;
          }
        }
      }
    }
      console.log("Total time for participant:", time);
    res.json({ divisions, total_time: time });
  } catch (err) {
    console.error("Error fetching participant and divisions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
  router.get('/default',async (req,res) => {
    const { division_id } = req.query;
    const divisions = await Divisions.findOne({
        where: {division_id:division_id},
      });
    
      res.json(divisions);
  }); 



  router.patch("/", validateToken, async (req, res) => {
    try {
      const data = req.body;
      const user_account_id = req.user.account_id;
      
      // Check if user owns the tournament (using division_id to get tournament_id)
      const authCheck = await checkTournamentOwnership(user_account_id, null, data.division_id);
      if (!authCheck.authorized) {
        return res.status(401).json({ error: authCheck.error });
      }
      
      const DivisionRes = await Divisions.findOne({ where: { division_id: data.division_id } });
      
      if (DivisionRes) {
        const Division = DivisionRes.dataValues;
        Division.age_group = isNotNullOrEmpty(data.age_group) ? data.age_group : Division.age_group;
        Division.proficiency_level = isNotNullOrEmpty(data.proficiency_level) ? data.proficiency_level : Division.proficiency_level;
        Division.gender = isNotNullOrEmpty(data.gender) ? data.gender : Division.gender;
        Division.category = isNotNullOrEmpty(data.category) ? data.category : Division.category;
  
        await Divisions.update(Division, {
          where: { division_id: data.division_id }
        });
  
        res.status(200).json({ message: "Successfully updated" });
      } else {
        console.log("Not found");
        res.status(404).json({ error: "Division not found" });
      }
    } catch (error) {
      console.error("Error updating division:", error);
      
      // Check for Sequelize unique constraint violations
      if (error.name === 'SequelizeUniqueConstraintError' || 
          error.name === 'SequelizeValidationError' ||
          error.original?.code === 'ER_DUP_ENTRY' || // MySQL
          error.original?.code === '23505' || // PostgreSQL
          error.original?.code === 'SQLITE_CONSTRAINT') { // SQLite
        res.status(400).json({ 
          error: "A division with these exact details (age group, proficiency level, gender, and category) already exists for this tournament." 
        });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  router.delete("/", validateToken, async (req, res) => {
    const division_id = req.body.division_id;
    const user_account_id = req.user.account_id;
  // Log the received division_id
    try {
      // Check if user owns the tournament (using division_id to get tournament_id)
      const authCheck = await checkTournamentOwnership(user_account_id, null, division_id);
      if (!authCheck.authorized) {
        return res.status(401).json({ error: authCheck.error });
      }

      // First delete brackets associated with this division
      const {brackets} = require("../models");
      await brackets.destroy({
        where: {
          division_id: division_id
        }
      });

      // Then delete participant-division associations
      await ParticipantDivision.destroy({
        where: {
          division_id: division_id
        }
      });
      
      // Finally delete the division
      const deletedDivision = await Divisions.destroy({
        where: {
          division_id: division_id
        }
      });

      if (deletedDivision > 0) {
        res.status(200).json({ message: 'Division deleted successfully.' });
      } else {
        res.status(404).json({ message: 'Division not found or not deleted.' });
      }
    } catch (error) {
      console.error('Error occurred while deleting division:', error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });

  function isNotNullOrEmpty(str) {
    return str !== null && str !== '';
  }

  function ageRange(division){
    if (!division || !division.age_group) return [0, 0];
      return range = division.age_group.split('-').map(Number);
  }

  function highetAgeDivision(allDivisions){
    let count = {
      maxAge: 0,
      division_id: null
    };
      for(const division of allDivisions){
          if(division.is_active){
            const range = ageRange(division)
            if(count.maxAge < range[1]){
            count.maxAge = range[1];
            count.division_id = division.division_id;
            }
          }
       }
       return count;
       // we got the highest age active division
  }

    function lowestAgeDivision(allDivisions){
    let count = {
      minAge: 0,
      division_id: null
    };
      for(const division of allDivisions){
          if(division.is_active){
            const range = ageRange(division)
            if(count.minAge > range[0]){
            count.minAge = range[0];
            count.division_id = division.division_id;
            }
          }
       }
       return count;
       // we got the highest age active division
  }



  router.get('/tournament-order',async (req, res) => {
  const { tournament_id } = req.query;

  try {
    if (!tournament_id) {
      return res.status(400).json({ error: "Tournament ID is required" });
    }

    // Get all divisions for the tournament with mat information
    const allDivisions = await Divisions.findAll({
      where: { tournament_id: tournament_id },
      include: [
        {
          model: Mats,
          as: 'mat',
          attributes: ['mat_id', 'mat_name'],
          required: false // Left join to include divisions without mats
        }
      ],
      order: [['division_id', 'ASC']] // Consistent ordering
    });

    if (!allDivisions || allDivisions.length === 0) {
      return res.status(404).json({ error: "No divisions found for this tournament" });
    }

    // Sort divisions by age range, then by proficiency level (beginner first)
    allDivisions.sort((a, b) => {
      const [minA, maxA] = ageRange(a);
      const [minB, maxB] = ageRange(b);
      
      // First sort by age range
      if (minA !== minB) return minA - minB;
      if (maxA !== maxB) return maxA - maxB;
      
      // If same age range, sort by proficiency level (beginner first)
      return getProficiencyOrder(a.proficiency_level) - getProficiencyOrder(b.proficiency_level);
    });

    // Check if there are any active divisions under 35
    const hasUnder35Divisions = allDivisions.some(division => {
      if (!division.is_active) return false;
      const range = ageRange(division);
      return range[1] < 35; // max age is under 35
    });

    // Determine starting point based on whether under 35 divisions exist
    let startingDivision;
    if (hasUnder35Divisions) {
      // Start from lowest age division (kids/teens first)
      startingDivision = lowerAgeDivision(allDivisions);
    } else {
      // Start from highest age division (adults 35+ only)
      startingDivision = higherAgeDivision(allDivisions);
    }

    if (!startingDivision.division_id) {
      return res.status(404).json({ error: "No active divisions found" });
    }

    const orderedDivisions = [];
    const processedIds = new Set();

    // Find the starting division index
    const startIndex = allDivisions.findIndex(
      div => div.division_id === startingDivision.division_id
    );

    if (startIndex === -1) {
      return res.status(500).json({ error: "Could not find starting division" });
    }

    // Process divisions in age order (always ascending)
    let currentIndex = startIndex;
    let hasWrapped = false;

    while (orderedDivisions.length < allDivisions.length) {
      const currentDivision = allDivisions[currentIndex];
      
      if (currentDivision && !processedIds.has(currentDivision.division_id)) {
        orderedDivisions.push({
          division_id: currentDivision.division_id,
          age_group: currentDivision.age_group,
          proficiency_level: currentDivision.proficiency_level,
          gender: currentDivision.gender,
          category: currentDivision.category,
          time: currentDivision.time,
          is_active: currentDivision.is_active,
          is_complete: currentDivision.is_complete,
          tournament_order: orderedDivisions.length + 1,
          status: currentDivision.is_complete ? 'completed' : 
                 currentDivision.is_active ? 'in_progress' : 'pending',
          mat_id: currentDivision.mat ? currentDivision.mat.mat_id : null,
          mat_name: currentDivision.mat ? currentDivision.mat.mat_name : null
        });
        processedIds.add(currentDivision.division_id);
      }

      // Move to next division (always ascending through ages)
      currentIndex++;

      // Handle wrap-around when we reach the end
      if (currentIndex >= allDivisions.length && !hasWrapped) {
        // If we started with under 35, wrap to 35+ divisions
        // If we started with 35+, wrap to under 35 divisions  
        currentIndex = 0;
        hasWrapped = true;
      }

      // Prevent infinite loop
      if (hasWrapped && currentIndex >= startIndex) {
        break;
      }
    }

    // Calculate cumulative time to show when each division approximately starts
    let cumulativeTime = 0;
    const divisionsWithTiming = orderedDivisions.map(division => {
      const divisionWithTiming = {
        ...division,
        estimated_start_time: cumulativeTime, // in minutes from tournament start
        estimated_start_time_formatted: formatTime(cumulativeTime)
      };
      
      // Add this division's time to cumulative (only if not complete)
      if (!division.is_complete) {
        cumulativeTime += division.time;
      }
      
      return divisionWithTiming;
    });

    res.json({
      tournament_id: tournament_id,
      total_divisions: divisionsWithTiming.length,
      tournament_order: divisionsWithTiming,
      total_estimated_time: cumulativeTime,
      total_estimated_time_formatted: formatTime(cumulativeTime)
    });

  } catch (error) {
    console.error('Error fetching tournament order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to automatically assign divisions to mats
router.post('/assign-mats', validateToken, async (req, res) => {
  const { tournament_id } = req.body;
  const user_account_id = req.user.account_id;

  try {
    console.log('Assign mats request for tournament:', tournament_id);
    
    if (!tournament_id) {
      return res.status(400).json({ error: "Tournament ID is required" });
    }

    // Check if user owns the tournament
    const authCheck = await checkTournamentOwnership(user_account_id, tournament_id);
    if (!authCheck.authorized) {
      return res.status(401).json({ error: authCheck.error });
    }

    // Get all divisions for the tournament in proper order
    const allDivisions = await Divisions.findAll({
      where: { tournament_id: tournament_id },
      order: [['division_id', 'ASC']]
    });

    if (!allDivisions || allDivisions.length === 0) {
      return res.status(404).json({ error: "No divisions found for this tournament" });
    }

    // Sort divisions by age range, then by proficiency level (same logic as tournament-order)
    allDivisions.sort((a, b) => {
      const [minA, maxA] = ageRange(a);
      const [minB, maxB] = ageRange(b);
      
      // First sort by age range
      if (minA !== minB) return minA - minB;
      if (maxA !== maxB) return maxA - maxB;
      
      // If same age range, sort by proficiency level (beginner first)
      return getProficiencyOrder(a.proficiency_level) - getProficiencyOrder(b.proficiency_level);
    });

    // Get all active mats for this tournament
    const mats = await Mats.findAll({
      where: { 
        tournament_id: tournament_id, 
        is_active: true 
      },
      order: [['mat_id', 'ASC']] // Consistent ordering
    });

    if (!mats || mats.length === 0) {
      return res.status(404).json({ error: "No active mats found for this tournament" });
    }

    // Clear any existing mat assignments for this tournament
    await Divisions.update(
      { mat_id: null },
      { where: { tournament_id: tournament_id } }
    );

    // Only assign the first division to each mat initially
    // Subsequent divisions will be assigned automatically when current divisions complete
    const assignments = [];
    const matsAssigned = new Set();
    
    for (let i = 0; i < allDivisions.length && matsAssigned.size < mats.length; i++) {
      const division = allDivisions[i];
      const matIndex = i % mats.length;
      const assignedMat = mats[matIndex];

      // Only assign if this mat hasn't been assigned yet
      if (!matsAssigned.has(assignedMat.mat_id)) {
        // Update the division with mat assignment and make it active
        await Divisions.update(
          { 
            mat_id: assignedMat.mat_id,
            is_active: true // First division on each mat becomes active
          },
          { where: { division_id: division.division_id } }
        );

        assignments.push({
          division_id: division.division_id,
          age_group: division.age_group,
          proficiency_level: division.proficiency_level,
          gender: division.gender,
          category: division.category,
          mat_id: assignedMat.mat_id,
          mat_name: assignedMat.mat_name,
          assignment_order: i + 1,
          is_active: true
        });

        matsAssigned.add(assignedMat.mat_id);
      }
    }

    res.json({
      message: "Mats assigned successfully",
      tournament_id: tournament_id,
      total_divisions: allDivisions.length,
      total_mats: mats.length,
      assignments: assignments
    });

  } catch (error) {
    console.error('Error assigning mats:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to assign mats',
      details: error.message 
    });
  }
});

// Route to mark division as complete and trigger mat reassignment
router.patch('/complete', validateToken, async (req, res) => {
  const { division_id } = req.body;
  const user_account_id = req.user.account_id;

  try {
    if (!division_id) {
      return res.status(400).json({ error: "Division ID is required" });
    }

    // Check if user owns the tournament (using division_id to get tournament_id)
    const authCheck = await checkTournamentOwnership(user_account_id, null, division_id);
    if (!authCheck.authorized) {
      return res.status(401).json({ error: authCheck.error });
    }

    // Get the completed division
    const completedDivision = await Divisions.findOne({
      where: { division_id: division_id }
    });

    if (!completedDivision) {
      return res.status(404).json({ error: "Division not found" });
    }

    // Mark the division as complete and inactive
    await Divisions.update(
      { is_complete: true, is_active: false },
      { where: { division_id: division_id } }
    );

    // If this division was assigned to a mat, reassign that mat to the next division
    let reassignmentResult = null;
    if (completedDivision.mat_id) {
      reassignmentResult = await reassignMatToNextDivision(completedDivision.tournament_id, completedDivision.mat_id);
    }

    res.json({
      message: "Division marked as complete",
      division_id: division_id,
      mat_reassigned: !!completedDivision.mat_id,
      next_division: reassignmentResult
    });

  } catch (error) {
    console.error('Error completing division:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to reassign mat to next available division following tournament order
async function reassignMatToNextDivision(tournament_id, mat_id) {
  try {
    // Get all divisions for the tournament
    const allDivisions = await Divisions.findAll({
      where: { tournament_id: tournament_id },
      order: [['division_id', 'ASC']]
    });

    if (!allDivisions || allDivisions.length === 0) {
      return null;
    }

    // Use the SAME ordering logic as tournament-order route
    allDivisions.sort((a, b) => {
      const [minA, maxA] = ageRange(a);
      const [minB, maxB] = ageRange(b);
      
      // First sort by age range
      if (minA !== minB) return minA - minB;
      if (maxA !== maxB) return maxA - maxB;
      
      // If same age range, sort by proficiency level (beginner first)
      return getProficiencyOrder(a.proficiency_level) - getProficiencyOrder(b.proficiency_level);
    });

    // Determine starting point based on tournament logic (same as tournament-order)
    const hasUnder35Divisions = allDivisions.some(division => {
      if (!division.is_active && division.is_complete) return false;
      const range = ageRange(division);
      return range[1] < 35;
    });

    let startingDivision;
    if (hasUnder35Divisions) {
      startingDivision = lowerAgeDivision(allDivisions);
    } else {
      startingDivision = higherAgeDivision(allDivisions);
    }

    if (!startingDivision.division_id) {
      return null;
    }

    // Find the starting division index
    const startIndex = allDivisions.findIndex(
      div => div.division_id === startingDivision.division_id
    );

    if (startIndex === -1) {
      return null;
    }

    // Process divisions in tournament order to find next available
    let currentIndex = startIndex;
    let hasWrapped = false;

    while (currentIndex < allDivisions.length) {
      const currentDivision = allDivisions[currentIndex];
      
      // Check if this division is available (not active, not complete, no mat assigned)
      if (currentDivision && 
          !currentDivision.is_active && 
          !currentDivision.is_complete &&
          !currentDivision.mat_id) {
        
        // Assign this division to the mat and make it active
        await Divisions.update(
          { 
            mat_id: mat_id, 
            is_active: true 
          },
          { where: { division_id: currentDivision.division_id } }
        );

        console.log(`Mat ${mat_id} reassigned to division ${currentDivision.division_id} (${currentDivision.age_group} ${currentDivision.proficiency_level})`);
        
        return {
          division_id: currentDivision.division_id,
          age_group: currentDivision.age_group,
          proficiency_level: currentDivision.proficiency_level,
          gender: currentDivision.gender,
          category: currentDivision.category
        };
      }

      // Move to next division (always ascending through ages)
      currentIndex++;

      // Handle wrap-around when we reach the end
      if (currentIndex >= allDivisions.length && !hasWrapped) {
        currentIndex = 0;
        hasWrapped = true;
      }

      // Prevent infinite loop
      if (hasWrapped && currentIndex >= startIndex) {
        break;
      }
    }

    // No available divisions found
    console.log(`No more divisions available for mat ${mat_id}`);
    return null;

  } catch (error) {
    console.error('Error reassigning mat:', error);
    throw error;
  }
}

// Helper function to format time in minutes to HH:MM format
function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Helper function to get proficiency level order (beginner first)
function getProficiencyOrder(proficiency) {
  const order = {
    'beginner': 1,
    'Beginner': 1,
    'BEGINNER': 1,
    'intermediate': 2,
    'Intermediate': 2,
    'INTERMEDIATE': 2,
    'advanced': 3,
    'Advanced': 3,
    'ADVANCED': 3
  };
  return order[proficiency] || 999; // Unknown proficiency levels go last
}

// Helper function to get proficiency level order for descending sort (advanced first)
function getProficiencyOrderDescending(proficiency) {
  const order = {
    'advanced': 1,
    'Advanced': 1,
    'ADVANCED': 1,
    'intermediate': 2,
    'Intermediate': 2,
    'INTERMEDIATE': 2,
    'beginner': 3,
    'Beginner': 3,
    'BEGINNER': 3
  };
  return order[proficiency] || 999; // Unknown proficiency levels go last
}

// Fixed version of highest age division function (fixing the typo)
function higherAgeDivision(allDivisions) {
  let count = {
    maxAge: 0,
    division_id: null
  };
  
  for (const division of allDivisions) {
    if (division.is_active) {
      const range = ageRange(division);
      if (count.maxAge < range[1]) {
        count.maxAge = range[1];
        count.division_id = division.division_id;
      }
    }
  }
  return count;
}

// Fixed version of lowest age division function
function lowerAgeDivision(allDivisions) {
  let count = {
    minAge: Infinity, // Fixed: was 0, should be Infinity
    division_id: null
  };
  
  for (const division of allDivisions) {
    if (division.is_active) {
      const range = ageRange(division);
      if (count.minAge > range[0]) {
        count.minAge = range[0];
        count.division_id = division.division_id;
      }
    }
  }
  return count;
}

async function checkParentAccess(parent_id, tournament_id, division_id = null) {
  try {
    console.log("=== checkParentAccess called ===");
    console.log("parent_id:", parent_id);
    console.log("tournament_id:", tournament_id);
    console.log("division_id:", division_id);
    
    // Get the parent to verify they exist
    const parentRecord = await Parent.findOne({
      where: { parent_id: parent_id },
      attributes: ['parent_id', 'email', 'name']
    });
    
    console.log("Parent lookup result:", parentRecord);
    
    if (!parentRecord) {
      console.log("Parent not found");
      return { authorized: false, error: "Parent not found" };
    }
    
    // Get all participants (children) for this parent
    const participants = await participant.findAll({ 
      where: { parent_id: parent_id },
      attributes: ['participant_id', 'name', 'email']
    });
    
    console.log("Parent's children found:", participants);
    
    if (!participants || participants.length === 0) {
      console.log("Parent has no children registered");
      return { authorized: false, error: "Parent has no children registered" };
    }
    
    const participantIds = participants.map(p => p.participant_id);
    console.log("Children participant IDs:", participantIds);
    
    // Get all divisions the children are enrolled in
    const participantDivisions = await ParticipantDivision.findAll({
      where: { participant_id: { [Op.in]: participantIds } },
      attributes: ['division_id', 'participant_id']
    });
    
    console.log("Children's divisions found:", participantDivisions);
    
    if (!participantDivisions || participantDivisions.length === 0) {
      console.log("Parent's children not enrolled in any divisions");
      return { authorized: false, error: "Parent's children not enrolled in any divisions" };
    }
    
    const divisionIds = participantDivisions.map(pd => pd.division_id);
    console.log("Division IDs children are enrolled in:", divisionIds);
    
    // If checking specific division access
    if (division_id) {
      if (!divisionIds.includes(division_id)) {
        console.log("Parent's children not enrolled in specified division");
        return { authorized: false, error: "Parent's children not enrolled in this division" };
      }
    }
    
    // Get divisions and check if they belong to the specified tournament
    const divisions = await Divisions.findAll({
      where: { 
        division_id: { [Op.in]: divisionIds },
        ...(tournament_id && { tournament_id: tournament_id })
      },
      attributes: ['division_id', 'tournament_id']
    });
    
    console.log("Divisions in specified tournament:", divisions);
    
    if (!divisions || divisions.length === 0) {
      console.log("Parent's children not enrolled in any divisions for this tournament");
      return { authorized: false, error: "Parent's children not enrolled in any divisions for this tournament" };
    }
    
    // Verify tournament access
    const tournamentIds = [...new Set(divisions.map(d => d.tournament_id))];
    
    // Convert tournament_id to integer for comparison (query params are strings)
    const tournamentIdInt = tournament_id ? parseInt(tournament_id) : null;
    
    if (tournamentIdInt && !tournamentIds.includes(tournamentIdInt)) {
      console.log("Parent's children not enrolled in specified tournament");
      console.log("Looking for tournament_id:", tournamentIdInt, "in tournamentIds:", tournamentIds);
      return { authorized: false, error: "Parent's children not enrolled in this tournament" };
    }
    
    console.log("Parent access authorized");
    return { 
      authorized: true, 
      parent_id: parent_id,
      children: participants,
      enrolled_divisions: divisionIds,
      tournament_ids: tournamentIds
    };
    
  } catch (error) {
    console.error("Error checking parent access:", error);
    return { authorized: false, error: "Internal server error" };
  }
}

async function checkParticipantAccess(participant_id, tournament_id, division_id = null) {
  try {
    console.log("=== checkParticipantAccess called ===");
    console.log("participant_id:", participant_id);
    console.log("tournament_id:", tournament_id);
    console.log("division_id:", division_id);
    
    // Get the participant to verify they exist
    const participantRecord = await participant.findOne({
      where: { participant_id: participant_id },
      attributes: ['participant_id', 'email']
    });
    
    console.log("Participant lookup result:", participantRecord);
    
    if (!participantRecord) {
      console.log("Participant not found");
      return { authorized: false, error: "Participant not found" };
    }
    
    // Get all participant_ids with the same email (for family accounts)
    const participantRecords = await participant.findAll({ 
      where: { email: participantRecord.email },
      attributes: ['participant_id']
    });
    const participantIds = participantRecords.map(p => p.participant_id);
    
    console.log("All participant IDs with same email:", participantIds);
    
    // Get all divisions this participant (or family members) are enrolled in
    const participantDivisions = await ParticipantDivision.findAll({
      where: { participant_id: { [Op.in]: participantIds } },
      attributes: ['division_id', 'participant_id']
    });
    
    console.log("Participant divisions found:", participantDivisions);
    
    if (!participantDivisions || participantDivisions.length === 0) {
      console.log("Participant not enrolled in any divisions");
      return { authorized: false, error: "Participant not enrolled in any divisions" };
    }
    
    const divisionIds = participantDivisions.map(pd => pd.division_id);
    console.log("Division IDs participant is enrolled in:", divisionIds);
    
    // If checking specific division access
    if (division_id) {
      if (!divisionIds.includes(division_id)) {
        console.log("Participant not enrolled in specified division");
        return { authorized: false, error: "Participant not enrolled in this division" };
      }
    }
    
    // Get divisions and check if they belong to the specified tournament
    const divisions = await Divisions.findAll({
      where: { 
        division_id: { [Op.in]: divisionIds },
        ...(tournament_id && { tournament_id: tournament_id })
      },
      attributes: ['division_id', 'tournament_id']
    });
    
    console.log("Divisions in specified tournament:", divisions);
    
    if (!divisions || divisions.length === 0) {
      console.log("Participant not enrolled in any divisions for this tournament");
      return { authorized: false, error: "Participant not enrolled in any divisions for this tournament" };
    }
    
    // Verify tournament access
    const tournamentIds = [...new Set(divisions.map(d => d.tournament_id))];
    
    // Convert tournament_id to integer for comparison (query params are strings)
    const tournamentIdInt = tournament_id ? parseInt(tournament_id) : null;
    
    if (tournamentIdInt && !tournamentIds.includes(tournamentIdInt)) {
      console.log("Participant not enrolled in specified tournament");
      console.log("Looking for tournament_id:", tournamentIdInt, "in tournamentIds:", tournamentIds);
      return { authorized: false, error: "Participant not enrolled in this tournament" };
    }
    
    console.log("Participant access authorized");
    return { 
      authorized: true, 
      participant_id: participant_id,
      enrolled_divisions: divisionIds,
      tournament_ids: tournamentIds
    };
    
  } catch (error) {
    console.error("Error checking participant access:", error);
    return { authorized: false, error: "Internal server error" };
  }
}

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

// Helper functions for validation
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

// Add competitors to division
router.post('/:divisionId/competitors', validateToken, async (req, res) => {
  try {
    console.log('=== ADD COMPETITORS ENDPOINT CALLED ===');
    const { divisionId } = req.params;
    const { competitors } = req.body; // Array of participant_ids
    console.log('Division ID:', divisionId);
    console.log('Competitors:', competitors);
    const user_account_id = req.user.account_id;
    console.log('User account ID:', user_account_id);

    // Verify division exists
    const division = await Divisions.findOne({
      where: { division_id: divisionId }
    });

    if (!division) {
      return res.status(404).json({ error: "Division not found" });
    }

    // Verify user owns the tournament
    const tournament = await tournaments.findOne({
      where: { 
        tournament_id: division.tournament_id,
        account_id: user_account_id 
      }
    });

    if (!tournament) {
      return res.status(403).json({ error: "Access denied - you don't own this tournament" });
    }

    // First, filter out competitors already in this division
    const existingParticipants = await ParticipantDivision.findAll({
      where: { 
        division_id: divisionId,
        participant_id: competitors 
      }
    });

    const existingParticipantIds = existingParticipants.map(p => p.participant_id);
    const newCompetitors = competitors.filter(id => !existingParticipantIds.includes(id));

    // Only validate NEW competitors that are being added
    if (newCompetitors.length > 0) {
      const competitorDetails = await participant.findAll({
        where: { 
          participant_id: newCompetitors,
          account_id: user_account_id 
        }
      });

      if (competitorDetails.length !== newCompetitors.length) {
        return res.status(403).json({ error: "One or more new competitors don't belong to your account" });
      }

      // Validate each NEW participant against division requirements
      const validationErrors = [];
      for (const competitor of competitorDetails) {
        const { name, date_of_birth, belt_color, participant_id } = competitor;
        
        // Check required fields
        if (!name || !date_of_birth || !belt_color) {
          validationErrors.push(`Participant ${name || participant_id}: Missing required fields`);
          continue;
        }
        
        // Check age compatibility
        if (!isAge(division.age_group, date_of_birth)) {
          validationErrors.push(`Participant ${name}: Age doesn't match division age group (${division.age_group})`);
        }
        
        // Check belt/proficiency compatibility
        if (!canCompete(division.proficiency_level, belt_color)) {
          validationErrors.push(`Participant ${name}: Belt color (${belt_color}) doesn't match division level (${division.proficiency_level})`);
        }
      }

      // If there are validation errors, return them
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          error: "Validation failed for some participants",
          details: validationErrors
        });
      }
    }

    // Add only new participants to the division
    if (newCompetitors.length > 0) {
      const participantDivisions = newCompetitors.map(participantId => ({
        participant_id: participantId,
        division_id: divisionId
      }));

      await ParticipantDivision.bulkCreate(participantDivisions);
    }

    res.json({ 
      message: "Competitors added successfully",
      added: newCompetitors.length,
      skipped: competitors.length - newCompetitors.length
    });

  } catch (error) {
    console.error('Error adding competitors to division:', error);
    res.status(500).json({ error: "Failed to add competitors to division" });
  }
});

module.exports = router;
module.exports.reassignMatToNextDivision = reassignMatToNextDivision;
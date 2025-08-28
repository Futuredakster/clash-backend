const express = require("express");
const router = express.Router();
const {Divisions} = require ("../models");
const {participant} = require("../models");
const {ParticipantDivision} = require("../models");
const {Mats} = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");
const { validateParticipant } = require('../middlewares/validateParticipant')
const {validateParent} = require("../middlewares/validateParent");
const { Op } = require("sequelize");
const { Sequelize } = require('sequelize');


router.post('/', validateToken, async (req, res) => {
    try {
      const data = req.body;
      console.log("Creating division with data:", data);
      const division = await Divisions.create(data);
      res.json("Bracket Created");
    } catch (error) {
      console.error("Error creating division:", error);
      res.status(500).json({ error: "Something went wrong while creating the division." });
    }
  });

  router.get('/',validateToken,async (req,res) =>{
    const { tournament_id } = req.query;
    const divisions = await Divisions.findAll({
        where: {tournament_id:tournament_id},
      });
      res.json(divisions);
  });


  router.get('/praticepent', async (req, res) => {
    const { tournament_id } = req.query;
  
    try {
      const divisions = await Divisions.findAll({
        where: { tournament_id },
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
   const participent = await participant.findOne({ where: { participant_id } });
  let time = 0;
  // make time a array to store time for each division
  const email = participent.email;

    // Get all participant_ids with this email
    const participants = await participant.findAll({ where: { email } });
    const participantIds = participants.map(p => p.participant_id);

  try {
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

router.get("/parentview", validateParent,async (req, res) => {
     const parent_id = req.parent.id;
     const {tournamentId} = req.query;
     const participants = await participant.findAll({ where: { parent_id } });
     const participantIds = participants.map(p => p.participant_id);
      let time = 0;

  try {
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
        res.status(404).json({ error: "Tournament not found" });
      }
    } catch (error) {
      console.error("Error updating tournament:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  router.delete("/", validateToken, async (req, res) => {
    const division_id = req.body.division_id; 
    try {
      const deletedDivision = await Divisions.destroy({
        where: {
          division_id: division_id
        }
      });
  
      if (deletedDivision > 0) {
        res.status(200).json({ message: 'Tournament deleted successfully.' });
      } else {
        res.status(404).json({ message: 'Tournament not found or not deleted.' });
      }
    } catch (error) {
      console.error('Error occurred while deleting tournament:', error);
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

  try {
    console.log('Assign mats request for tournament:', tournament_id);
    
    if (!tournament_id) {
      return res.status(400).json({ error: "Tournament ID is required" });
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

  try {
    if (!division_id) {
      return res.status(400).json({ error: "Division ID is required" });
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

module.exports = router;
module.exports.reassignMatToNextDivision = reassignMatToNextDivision;
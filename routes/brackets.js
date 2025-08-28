const express = require("express");
const router = express.Router();
const { Divisions, participant, brackets,ParticipantDivision } = require("../models"); 
const { validateToken } = require("../middlewares/AuthMiddleware");
const { Sequelize } = require('sequelize');
const { validateParticipant } = require('../middlewares/validateParticipant')


router.post("/", async (req, res) => {
  const { division_id } = req.body;

  try {
    // Fetch participants for the given division
    const participants = await participant.findAll({
      attributes: ['participant_id', 'name'],
      include: [
        {
          model: Divisions,
          where: { division_id },
          through: { attributes: [] }
        }
      ]
    });

    // Fetch existing brackets with win_user info
    const existingBrackets = await brackets.findAll({
      where: { division_id },
      attributes: ['participant_id1', 'participant_id2', 'win_user1', 'win_user2', 'round'],
      order: [['bracket_id', 'ASC']]
    });

    // Determine the next round number
    let nextRound = 1;
    const roundsWithWinners = existingBrackets
      .filter(bracket => bracket.win_user1 || bracket.win_user2)
      .map(bracket => bracket.round);
    if (roundsWithWinners.length > 0) {
      nextRound = Math.max(...roundsWithWinners) + 1;
    }
    console.log("Next round will be:", nextRound);

    // Collect unavailable participants based on win/lose logic
    const unavailableParticipantIds = new Set();

    for (let i = 0; i < existingBrackets.length; i += 2) {
      const bracket1 = existingBrackets[i];
      const bracket2 = existingBrackets[i + 1];

      if (!bracket2) continue;

      const b1HasWinner = bracket1.win_user1 || bracket1.win_user2;
      const b2HasWinner = bracket2.win_user1 || bracket2.win_user2;

      const b1NoWinner = !bracket1.win_user1 && !bracket1.win_user2;
      const b2NoWinner = !bracket2.win_user1 && !bracket2.win_user2;

      if (b1HasWinner && b2NoWinner) {
        if (bracket1.win_user1) unavailableParticipantIds.add(bracket1.participant_id1);
        if (bracket1.win_user2) unavailableParticipantIds.add(bracket1.participant_id2);
      }

      if (b2HasWinner && b1NoWinner) {
        if (bracket2.win_user1) unavailableParticipantIds.add(bracket2.participant_id1);
        if (bracket2.win_user2) unavailableParticipantIds.add(bracket2.participant_id2);
      }
    }

    // Add losers to unavailable set
    existingBrackets.forEach(bracket => {
      if (bracket.participant_id1 && bracket.win_user1 === false) {
        unavailableParticipantIds.add(bracket.participant_id1);
      }
      if (bracket.participant_id2 && bracket.win_user2 === false) {
        unavailableParticipantIds.add(bracket.participant_id2);
      }
    });

    const availableParticipants = participants.filter(
      p => !unavailableParticipantIds.has(p.participant_id)
    );

    const biAlreadyUsed = existingBrackets.some(
      bracket => bracket.participant_id1 === -1 || bracket.participant_id2 === -1
    );

    // If only 1 available participant, create Bye bracket
    if (availableParticipants.length === 1 && !biAlreadyUsed) {
      const participant_id1 = availableParticipants[0].participant_id;
      const user1 = availableParticipants[0].name;
      const user2 = "Bi";

      await brackets.create({
        division_id,
        participant_id1,
        participant_id2: -1,
        win_user1: false,
        win_user2: false,
        user1,
        user2,
        round: nextRound
      });

      return res.json({
        message: "Bracket created with one participant vs Bye",
        bracket: { user1, user2 }
      });
    }

    // Shuffle available participants
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    shuffleArray(availableParticipants);

    const bracketPromises = [];
    while (availableParticipants.length > 1) {
      const participant1 = availableParticipants.pop();
      const participant2 = availableParticipants.pop();

      const participant_id1 = participant1.participant_id;
      const participant_id2 = participant2.participant_id;
      const user1 = participant1.name;
      const user2 = participant2.name;

      if (participant_id1 !== participant_id2) {
        bracketPromises.push(
          brackets.create({
            division_id,
            participant_id1,
            participant_id2,
            win_user1: false,
            win_user2: false,
            user1,
            user2,
            round: nextRound
          })
        );
      }
    }

    // Handle leftover participant (Bye)
    if (availableParticipants.length === 1 && !biAlreadyUsed) {
      const participant1 = availableParticipants.pop();
      const participant_id1 = participant1.participant_id;
      const user1 = participant1.name;
      const user2 = "Bi";

      bracketPromises.push(
        brackets.create({
          division_id,
          participant_id1,
          participant_id2: -1,
          win_user1: false,
          win_user2: false,
          user1,
          user2,
          round: nextRound
        })
      );
    }

    await Promise.all(bracketPromises);

    return res.json({ message: "Brackets created successfully" });
  } catch (error) {
    console.error("Error creating brackets:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


  router.get("/", async (req, res) => {
    const { division_id } = req.query;
  
    // Log for debugging to see what division_id is being passed
    console.log("Fetching brackets for division_id:", division_id);
  
    // Check if division_id is provided
    if (!division_id) {
      return res.status(400).json({ error: "division_id is required" });
    }
  
    try {
      // Query the database for brackets with the given division_id
      const bracket = await brackets.findAll({
        where: {
          division_id: division_id // Ensure division_id is used correctly in the query
        }
      });
  
      // Log the results for debugging
      console.log(`Found ${bracket.length} brackets for division ${division_id}`);
      console.log("Bracket IDs:", bracket.map(b => b.bracket_id));
      
      // If no brackets found, return 404
      if (bracket.length === 0) {
        return res.json([]); // Return an empty array
      }
      // Return the found bracket
      return res.json(bracket);
    } catch (error) {
      // Log the error for debugging
      console.error("Error fetching brackets:", error);
  
      // Return a 500 internal server error
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
  

  router.get('/One', async (req,res) => {
    const { bracket_id } = req.query;
    const bracket = await brackets.findOne({
      where: {
        bracket_id: bracket_id
      }
    })
    return res.json(bracket);
  });


  router.get("/participent", async (req, res) => {
const { division_id } = req.query; // get division_id from query params
    if (!division_id) {
      return res.status(400).json({ error: "division_id is required" });
    }
  
    try {
      // Query the database for brackets with the given division_id
      const bracket = await brackets.findAll({
        where: {
          division_id: division_id // Ensure division_id is used correctly in the query
        }
      });
  
      // If no brackets found, return 404
      if (bracket.length === 0) {
        return res.json([]); // Return an empty array
      }
      // Return the found bracket
      return res.json(bracket);
    } catch (error) {
      // Log the error for debugging
      console.error("Error fetching brackets:", error);
  
      // Return a 500 internal server error
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  router.patch('/updatePoints', async (req, res) => { 
    const { bracket_id, user, points,time } = req.body;
    try {
        // Fetch the bracket by bracket_id
        let bracket = await brackets.findOne({ where: { bracket_id: bracket_id } });
        let division= await Divisions.findOne({ where: { division_id: bracket.division_id } });
          if(!bracket.is_active){
             await brackets.update(
                { is_active: true },   
                { where: { bracket_id: bracket_id } }
            );
          }

        await brackets.update(
            { time: time },
            { where: { bracket_id: bracket_id } }
            );
     
        if (!bracket) {
            console.log("error");
            return res.status(404).send({ error: 'Bracket not found' });
        }

        // Determine which user to update based on 'user'
        if (user === 'user1') {
            await brackets.update(
                { points_user1: points },
                { where: { bracket_id: bracket_id } }
            );
            if(!division.is_active){
                await Divisions.update(
                    { is_active: true },   
                    { where: { division_id: bracket.division_id } }
                );
                // pseudo code first locate all the mats for this tournament by tournament_id and the amount of them
                // second check if there are any mats open  by querying mats for is_active = false,if there arnet any
                // open return a message sayin thre is mat open for this division yet. Then if there are assign the mats_id
                // thats open to the division. At the end once a division is done asign that mats is_active back to false.
            }
        } else if (user === 'user2') {
            await brackets.update(
                { points_user2: points },
                { where: { bracket_id: bracket_id } }
            );
            if(!division.is_active){
                await Divisions.update(
                    { is_active: true },   
                    { where: { division_id: bracket.division_id } }
                );
            }
        } else {
            return res.status(400).send({ error: 'Invalid user' });
        }

        // Fetch updated bracket after updating points
        bracket = await brackets.findOne({ where: { bracket_id: bracket_id } });

        // Check if win condition is met for user1
        if (bracket.points_user1 >= 8) {
            await brackets.update(
                { win_user1: true ,
                  is_active: false,
                  is_complete: true },
                { where: { bracket_id: bracket_id } }
            );
            await updateDivisionTime(bracket.division_id);
        } else if (bracket.points_user1 < 8) {
            await brackets.update(
                { win_user1: false },
                { where: { bracket_id: bracket_id } }
            );
        }

        // Check if win condition is met for user2
        if (bracket.points_user2 >= 8) {
            await brackets.update(
                { win_user2: true ,
                  is_active: false,
                  is_complete: true },
                { where: { bracket_id: bracket_id } }
            );
            await updateDivisionTime(bracket.division_id);
        } else if (bracket.points_user2 < 8) {
            await brackets.update(
                { win_user2: false },
                { where: { bracket_id: bracket_id } }
            );
        }

        res.status(200).send({ message: 'Points updated successfully' });
        
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'An error occurred while updating points' });
    }
});

router.delete('/', async (req, res) => {
  try {
    const division_id = req.body.division_id;

    if (!division_id) {
      return res.status(400).json({ error: 'division_id is required' });
    }

    const deletedCount = await brackets.destroy({
      where: { division_id },
    });

    await Divisions.update(
      { is_active: false, is_complete: false },
      { where: { division_id } }
    );

    return res.status(200).json({ message: 'Brackets deleted successfully', deleted: deletedCount });
  } catch (error) {
    console.error('Error deleting brackets:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/byOne', async (req, res) => {
  try {
    const bracket_id = req.body.bracket_id;

    // Fetch the bracket first to get participant IDs and division_id
    const bracket = await brackets.findOne({
      where: { bracket_id }
    });

    if (!bracket) {
      return res.status(404).json({ error: "Bracket not found" });
    }

    const { participant_id1, participant_id2, division_id } = bracket;

    // Remove both participants from the division (assumes a join table ParticipantDivision)
    const ParticipantDivision = require("../models").ParticipantDivision;

    const participantRemovals = [];

    if (participant_id1 && participant_id1 !== -1) {
      participantRemovals.push(
        ParticipantDivision.destroy({
          where: {
            participant_id: participant_id1,
            division_id: division_id
          }
        })
      );
    }

    if (participant_id2 && participant_id2 !== -1) {
      participantRemovals.push(
        ParticipantDivision.destroy({
          where: {
            participant_id: participant_id2,
            division_id: division_id
          }
        })
      );
    }

    await Promise.all(participantRemovals);

    // Now delete the bracket
    const deletedBracket = await brackets.destroy({
      where: { bracket_id }
    });

    return res.status(200).json({
      message: "Bracket and participants removed from division",
      deleted: deletedBracket
    });

  } catch (error) {
    console.error("Error deleting bracket and participants:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});



router.post('/initial', async (req, res) => {
  const { tournament_id } = req.body;
  
  try {
    const divisions = await Divisions.findAll({
      where: { tournament_id },
      attributes: ['division_id']
    });

    for (const division of divisions) {
      const division_id = division.division_id;

      // Get participants in this division
      const participants = await participant.findAll({
        attributes: ['participant_id', 'name'],
        include: [
          {
            model: Divisions,
            where: { division_id },
            through: { attributes: [] }
          }
        ]
      });

      // Shuffle participants
      for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
      }
     
      // Create brackets in pairs
      while (participants.length > 1) {
        const p1 = participants.pop();
        const p2 = participants.pop();

        await brackets.create({
          division_id,
          participant_id1: p1.participant_id,
          participant_id2: p2.participant_id,
          win_user1: false,
          win_user2: false,
          user1: p1.name,
          user2: p2.name,
          round: 1
        });
      }

      // Handle bye if odd number
      if (participants.length === 1) {
        const p1 = participants.pop();
        await brackets.create({
          division_id,
          participant_id1: p1.participant_id,
          participant_id2: -1,
          win_user1: false,
          win_user2: false,
          user1: p1.name,
          user2: "Bi",
          round: 1
        });
      }
      updateDivisionTime(division_id);
    }
     
    return res.json({ message: "Brackets created for all divisions" });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

//  Update division time function

const updateDivisionTime = async (division_id) =>{
   let count = await ParticipantDivision.count({
  where: { division_id: division_id }
});
count = count-1;
const amountCompleted = await brackets.count({
  where: {
    division_id: division_id,
    is_complete: true
  }
});
count = count - amountCompleted;
const timeOfCurrent = await brackets.findAll({
  where: { division_id: division_id,
  is_active: true 
  },
  attributes: ['time'],
  order: [['time', 'DESC']],
  limit: 1
})
let timeLeft = 0;
let isActiveBrackets=0;
 for (const bracket of timeOfCurrent) {
  isActiveBrackets++;
  timeLeft += bracket.time;
}
count = count - isActiveBrackets;
if(count === 0){
  await Divisions.update(
    { is_complete: true,
      is_active: false
    },
    { where: { division_id: division_id } }
  );
}
console.log("time", timeLeft);
console.log("count", count);
const divisionTime = timeLeft + (count * 300); 
console.log("divisionTime", divisionTime);
  await Divisions.update(
    { time: divisionTime },
    { where: { division_id: division_id } }
  );
}
  
module.exports = router;
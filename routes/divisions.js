const express = require("express");
const router = express.Router();
const {Divisions} = require ("../models");
const {participant} = require("../models");
const {ParticipantDivision} = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");
const { validateParticipant } = require('../middlewares/validateParticipant')
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
  let time = 0;
  // make time a array to store time for each division
  try {
    const participantDivisions = await ParticipantDivision.findAll({
      where: { participant_id },
    });

    if (!participantDivisions || participantDivisions.length === 0) {
      return res.status(404).json({ error: "Participant not found in any division" });
    }

    const divisionIds = participantDivisions.map(pd => pd.division_id);

    const divisions = await Divisions.findAll({
      where: { division_id: divisionIds },
    });
    
    const allDivisions = await Divisions.findAll({
      where : {tournament_id: divisions[0].tournament_id},
    });
    allDivisions.sort((a, b) => {
      const [minA, maxA] = ageRange(a);
      const [minB, maxB] = ageRange(b);
      return minA !== minB ? minA - minB : maxA - maxB;
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

module.exports = router;
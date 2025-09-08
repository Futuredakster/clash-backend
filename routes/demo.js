const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { 
  accounts, 
  users, 
  tournaments, 
  Divisions, 
  Parent, 
  participant, 
  ParticipantDivision,
  sequelize 
} = require("../models");

// Demo endpoint to create mock data
router.post("/", async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log("Starting demo data creation...");
    
    // First, clean up any existing demo data
    console.log("Cleaning up existing demo data...");
    
    // Find existing demo account by email
    const existingUser = await users.findOne({
      where: { email: "demo@karateacademy.com" }
    }, { transaction });
    
    if (existingUser) {
      const existingAccountId = existingUser.account_id;
      console.log("Found existing demo account:", existingAccountId);
      
      // Delete in reverse order of dependencies
      
      // 1. Delete ParticipantDivision records
      await ParticipantDivision.destroy({
        where: {},
        transaction
      });
      
      // 2. Delete participants (both children and adults)
      await participant.destroy({
        where: {
          [sequelize.Sequelize.Op.or]: [
            { account_id: existingAccountId },
            { email: { [sequelize.Sequelize.Op.like]: '%@email.com' } }
          ]
        },
        transaction
      });
      
      // 3. Delete parents
      await Parent.destroy({
        where: { email: { [sequelize.Sequelize.Op.like]: '%@email.com' } },
        transaction
      });
      
      // 4. Delete brackets first (before divisions due to foreign key)
      const existingTournaments = await tournaments.findAll({
        where: { account_id: existingAccountId },
        transaction
      });
      
      if (existingTournaments.length > 0) {
        const tournamentIds = existingTournaments.map(t => t.tournament_id);
        
        // Get division IDs first
        const existingDivisions = await Divisions.findAll({
          where: { tournament_id: tournamentIds },
          transaction
        });
        
        if (existingDivisions.length > 0) {
          const divisionIds = existingDivisions.map(d => d.division_id);
          
          // Delete brackets first
          const { brackets } = require("../models");
          await brackets.destroy({
            where: { division_id: divisionIds },
            transaction
          });
          
          // Now delete divisions
          await Divisions.destroy({
            where: { tournament_id: tournamentIds },
            transaction
          });
        }
      }
      
      // 5. Delete tournaments
      await tournaments.destroy({
        where: { account_id: existingAccountId },
        transaction
      });
      
      // 6. Delete user
      await users.destroy({
        where: { account_id: existingAccountId },
        transaction
      });
      
      // 7. Delete account
      await accounts.destroy({
        where: { account_id: existingAccountId },
        transaction
      });
      
      console.log("Cleaned up existing demo data");
    }
    
    // 1. Create Demo Account
    const demoAccount = await accounts.create({
      account_type: "Martial Arts School",
      account_name: "Demo Karate Academy",
      account_description: "A demonstration martial arts school with sample tournaments and participants"
    }, { transaction });
    
    console.log("Created demo account:", demoAccount.account_id);
    
    // 2. Create Demo User (Tournament Host)
    const hashedPassword = await bcrypt.hash("demo123", 10);
    const demoUser = await users.create({
      username: "demohost",
      email: "demo@karateacademy.com", 
      password_hash: hashedPassword,
      account_id: demoAccount.account_id,
      role: "Host"
    }, { transaction });
    
    console.log("Created demo user:", demoUser.user_id);
    
    // 3. Create Sample Tournaments
    const tournaments_data = [
      {
        tournament_name: "Spring Championship 2024",
        start_date: "2024-04-15",
        end_date: "2024-04-15", 
        signup_duedate: "2024-04-10",
        account_id: demoAccount.account_id,
        description: "Annual spring karate championship featuring kata and kumite competitions",
        is_published: true
      },
      {
        tournament_name: "Summer Youth Open",
        start_date: "2024-07-20",
        end_date: "2024-07-21",
        signup_duedate: "2024-07-15", 
        account_id: demoAccount.account_id,
        description: "Youth-focused tournament welcoming all skill levels",
        is_published: true
      }
    ];
    
    const createdTournaments = [];
    for (const tournamentData of tournaments_data) {
      const tournament = await tournaments.create(tournamentData, { transaction });
      createdTournaments.push(tournament);
    }
    
    console.log(`Created ${createdTournaments.length} tournaments`);
    
    // 4. Create Divisions for each Tournament
    const divisionTemplates = [
      // Kids divisions - unique combinations of age_group + proficiency_level
      { age_group: "6-8", proficiency_level: "beginner", gender: "Mixed", category: "Kata", cost: 2500, time: 45 },
      { age_group: "9-11", proficiency_level: "beginner", gender: "Mixed", category: "Kata", cost: 2500, time: 45 },
      { age_group: "9-11", proficiency_level: "intermediate", gender: "Mixed", category: "Kata", cost: 3000, time: 50 },
      
      // Teen divisions
      { age_group: "12-14", proficiency_level: "beginner", gender: "Mixed", category: "Kata", cost: 3000, time: 50 },
      { age_group: "12-14", proficiency_level: "intermediate", gender: "Mixed", category: "Kumite", cost: 3500, time: 80 },
      { age_group: "15-17", proficiency_level: "intermediate", gender: "Mixed", category: "Kata", cost: 3500, time: 55 },
      { age_group: "15-17", proficiency_level: "advanced", gender: "Mixed", category: "Kumite", cost: 4000, time: 90 },
      
      // Adult divisions  
      { age_group: "18-34", proficiency_level: "beginner", gender: "Mixed", category: "Kata", cost: 4000, time: 60 },
      { age_group: "18-34", proficiency_level: "intermediate", gender: "Mixed", category: "Kumite", cost: 4500, time: 95 },
      { age_group: "18-34", proficiency_level: "advanced", gender: "Mixed", category: "Kata", cost: 5000, time: 65 },
      { age_group: "35-50", proficiency_level: "intermediate", gender: "Mixed", category: "Kata", cost: 4000, time: 55 },
    ];
    
    const createdDivisions = [];
    for (const tournament of createdTournaments) {
      for (const divisionTemplate of divisionTemplates) {
        const division = await Divisions.create({
          ...divisionTemplate,
          tournament_id: tournament.tournament_id
        }, { transaction });
        createdDivisions.push(division);
      }
    }
    
    console.log(`Created ${createdDivisions.length} divisions`);
    
    // 5. Create Parent Accounts
    const parentsData = [
      { name: "Sarah Johnson", email: "sarah.johnson@email.com" },
      { name: "Mike Chen", email: "mike.chen@email.com" },
      { name: "Lisa Rodriguez", email: "lisa.rodriguez@email.com" },
      { name: "David Kim", email: "david.kim@email.com" },
      { name: "Emma Wilson", email: "emma.wilson@email.com" }
    ];
    
    const createdParents = [];
    for (const parentData of parentsData) {
      const parent = await Parent.create(parentData, { transaction });
      createdParents.push(parent);
    }
    
    console.log(`Created ${createdParents.length} parents`);
    
    // 6. Create Participant Children
    const participantsData = [
      // Sarah Johnson's kids
      { name: "Alex Johnson", date_of_birth: "2016-03-15", belt_color: "white", parent_id: null },
      { name: "Maya Johnson", date_of_birth: "2014-08-22", belt_color: "yellow", parent_id: null },
      
      // Mike Chen's kids  
      { name: "Kevin Chen", date_of_birth: "2015-11-10", belt_color: "white", parent_id: null },
      { name: "Sophie Chen", date_of_birth: "2012-06-18", belt_color: "orange", parent_id: null },
      
      // Lisa Rodriguez's kids
      { name: "Carlos Rodriguez", date_of_birth: "2013-04-25", belt_color: "green", parent_id: null },
      { name: "Isabella Rodriguez", date_of_birth: "2010-12-08", belt_color: "orange", parent_id: null },
      
      // David Kim's kids
      { name: "Ryan Kim", date_of_birth: "2008-09-14", belt_color: "purple", parent_id: null },
      { name: "Grace Kim", date_of_birth: "2011-02-28", belt_color: "green", parent_id: null },
      
      // Emma Wilson's kids
      { name: "Tyler Wilson", date_of_birth: "2007-07-03", belt_color: "brown", parent_id: null },
      { name: "Chloe Wilson", date_of_birth: "2015-05-20", belt_color: "white", parent_id: null },
      
      // Independent adult participants (no parent)
      { name: "Jennifer Adams", date_of_birth: "1995-01-15", belt_color: "black", email: "jennifer.adams@email.com" },
      { name: "Marcus Thompson", date_of_birth: "1988-11-22", belt_color: "brown", email: "marcus.thompson@email.com" },
      { name: "Amanda Lee", date_of_birth: "1982-04-10", belt_color: "purple", email: "amanda.lee@email.com" },
      { name: "Robert Martinez", date_of_birth: "1975-09-30", belt_color: "green", email: "robert.martinez@email.com" }
    ];
    
    // Assign parent IDs to children
    const participantsWithParents = [
      ...participantsData.slice(0, 2).map(p => ({ ...p, parent_id: createdParents[0].parent_id })), // Sarah's kids
      ...participantsData.slice(2, 4).map(p => ({ ...p, parent_id: createdParents[1].parent_id })), // Mike's kids  
      ...participantsData.slice(4, 6).map(p => ({ ...p, parent_id: createdParents[2].parent_id })), // Lisa's kids
      ...participantsData.slice(6, 8).map(p => ({ ...p, parent_id: createdParents[3].parent_id })), // David's kids
      ...participantsData.slice(8, 10).map(p => ({ ...p, parent_id: createdParents[4].parent_id })), // Emma's kids
      ...participantsData.slice(10) // Independent adults
    ];
    
    const createdParticipants = [];
    for (const participantData of participantsWithParents) {
      const participant_obj = await participant.create(participantData, { transaction });
      createdParticipants.push(participant_obj);
    }
    
    console.log(`Created ${createdParticipants.length} participants`);
    
    // 7. Register Participants to Compatible Divisions - Simplified approach
    // Helper function to check belt/proficiency compatibility
    const canParticipantCompete = (participant, division) => {
      const beginnerBelts = ["white", "yellow"];
      const intermediateBelts = ["orange", "green"];
      const advancedBelts = ["purple", "brown", "black"];
      
      const level = division.proficiency_level.toLowerCase();
      const userBelt = participant.belt_color.toLowerCase();
      
      if (level === "beginner") {
        return beginnerBelts.includes(userBelt);
      } else if (level === "intermediate") {
        return intermediateBelts.includes(userBelt) || beginnerBelts.includes(userBelt);
      } else if (level === "advanced") {
        return advancedBelts.includes(userBelt) || intermediateBelts.includes(userBelt) || beginnerBelts.includes(userBelt);
      }
      
      return false;
    };

    const registrations = [];
    
    // Register participants to both tournaments
    for (const tournament of createdTournaments) {
      const tournamentDivisions = createdDivisions.filter(d => d.tournament_id === tournament.tournament_id);
      
      for (const participant of createdParticipants) {
        // Find compatible divisions for this participant
        const compatibleDivisions = tournamentDivisions.filter(division => 
          canParticipantCompete(participant, division)
        );
        
        // Register to 1-2 compatible divisions (kata and/or kumite)
        const selectedDivisions = compatibleDivisions.slice(0, Math.floor(Math.random() * 2) + 1);
        
        for (const division of selectedDivisions) {
          registrations.push({
            participant_id: participant.participant_id,
            division_id: division.division_id
          });
        }
      }
    }
    
    // Bulk create registrations
    if (registrations.length > 0) {
      await ParticipantDivision.bulkCreate(registrations, { transaction });
    }
    
    console.log(`Created ${registrations.length} participant-division registrations`);
    
    // Commit transaction
    await transaction.commit();
    
    res.json({
      message: "Demo data created successfully!",
      summary: {
        accounts: 1,
        users: 1,
        tournaments: createdTournaments.length,
        divisions: createdDivisions.length,
        parents: createdParents.length, 
        participants: createdParticipants.length,
        registrations: registrations.length
      },
      login_credentials: {
        tournament_host: {
          email: "demo@karateacademy.com",
          password: "demo123",
          username: "demohost",
          role: "Tournament Organizer"
        },
        sample_parent: {
          email: "sarah.johnson@email.com",
          name: "Sarah Johnson",
          role: "Parent (has 2 children: Alex & Maya)",
          login_method: "Email verification code"
        },
        sample_participant: {
          email: "jennifer.adams@email.com", 
          name: "Jennifer Adams",
          role: "Independent Adult Participant",
          belt: "Black Belt",
          login_method: "Email verification code"
        }
      }
    });
    
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error("Error creating demo data:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: "Failed to create demo data", 
      details: error.message,
      stack: error.stack 
    });
  }
});

module.exports = router;
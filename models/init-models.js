var DataTypes = require("sequelize").DataTypes;
var _accounts = require("./accounts");
var _attendees = require("./attendees");
var _brackets = require("./brackets");
var _divisions = require("./Divisions");
var _participant = require("./participant");
var _ParticipantDivision = require("./ParticipantDivision");
var _schedule = require("./schedule");
var _tournaments = require("./tournaments");
var _users = require("./users");

function initModels(sequelize) {
  var accounts = _accounts(sequelize, DataTypes);
  var attendees = _attendees(sequelize, DataTypes);
  var brackets = _brackets(sequelize, DataTypes);
  var divisions = _divisions(sequelize, DataTypes);
  var participant = _participant(sequelize, DataTypes);
  var ParticipantDivision = _ParticipantDivision(sequelize, DataTypes);
  var schedule = _schedule(sequelize, DataTypes);
  var tournaments = _tournaments(sequelize, DataTypes);
  var users = _users(sequelize, DataTypes);

  // Define associations

  // Define many-to-many relationship between Participants and Divisions
  participant.belongsToMany(divisions, {
    through: ParticipantDivision,
    foreignKey: 'participant_id',
    otherKey: 'division_id'
  });

  divisions.belongsToMany(participant, {
    through: ParticipantDivision,
    foreignKey: 'division_id',
    otherKey: 'participant_id'
  });

  return {
    accounts,
    attendees,
    brackets,
    divisions,
    participant,
    ParticipantDivision,
    schedule,
    tournaments,
    users,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;

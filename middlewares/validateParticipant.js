const { verify, TokenExpiredError } = require("jsonwebtoken");

const validateParticipant = (req, res, next) => {
  const participantAccessToken = req.header("participantAccessToken");

  console.log("Received Token:", participantAccessToken); // ✅ Log the token

  if (!participantAccessToken) {
    console.log("No token provided");
    return res.status(401).json({ error: "Access token required." });
  }

  try {
    const validToken = verify(participantAccessToken, "importantsecrets");
    console.log("Valid Token Payload:", validToken); // ✅ Log decoded payload
    req.participant = validToken;
    return next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      console.log("Token expired");
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }

    console.log("Token verification error:", err.message);
    return res.status(403).json({ error: "Invalid token." });
  }
};

module.exports = { validateParticipant };

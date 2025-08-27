const { verify, TokenExpiredError } = require('jsonwebtoken');
const validateParent = (req, res, next) => {
  const parentAccessToken = req.header("parentAccessToken");

  console.log("Received Token:", parentAccessToken); // ✅ Log the token

  if (!parentAccessToken) {
    console.log("No token provided");
    return res.status(401).json({ error: "Access token required." });
  }

  try {
    const validToken = verify(parentAccessToken, "your_jwt_secret");
    console.log("Valid Token Payload:", validToken); // ✅ Log decoded payload
    req.parent = validToken;
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

module.exports = { validateParent };
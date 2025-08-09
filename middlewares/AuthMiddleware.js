const {verify} = require("jsonwebtoken");

const validateToken = (req,res,next) => {
    const accessToken = req.header("accessToken");

    if (!accessToken) return res.status(401).json({error: "User not logged in!"});
    
    try{
    const validToken = verify(accessToken, "importantsecret");
    req.user=validToken;
    if (validToken){
        return next();
    }
    } catch (err) {
       return res.status(401).json({error: err});
    }
};

// We obtain the token from the frontend which gets it from the local storage and set it equal to accessTokem
// We then check if the access Toke is false  or not logged in if it we give an error 404
// If its not false we create a variable vlaidToken and check if the string set to the token is correct
// if it is we set req.user = tot he token where we can acces id and username
// we then check if the token is valid annd if it is we continue the action
// if not we throw a 401 error

const validate = (req,res,next) => {
    const token = req.header("token");

    if (!token) return res.status(401).json({error: "User not logged in!"});
    
    try{
    const validToken = verify(token, "importanttoken");
    req.user=validToken;
    if (token){
        return next();
    }
    } catch (err) {
       return res.status(401).json({error: err});
    }
};

module.exports = { validateToken,validate };
const express = require("express");
const router = express.Router();
const { accounts } = require("../models");
const { users } = require("../models");
const bcrypt = require("bcrypt");
const { validateToken } = require("../middlewares/AuthMiddleware");

router.post("/", async (req, res) => {
  const post = req.body;
  var a = await accounts.create(post);
  res.json(a);
});



router.post("/user", async (req, res) => {
  console.log(req.body);
  const accountObj = req.body.account;
  const userObj = req.body.user;
  var a = await accounts.create(accountObj);
  userObj.account_id = a.account_id;

  const sameEmail = await users.findOne({
    where: {
      email: userObj.email,
    },
  }); 
  if(sameEmail){
    console.log("No sirrie bob");
    return res.json({error: "This email already cooresponds to an account please login"});
  }

  bcrypt.hash(userObj.password_hash, 10).then((hash) => {
     users.create({
      username: userObj.username,
      password_hash: hash,
      email: userObj.email,
      account_id: userObj.account_id
    });
  });
  //var b = await users.create(userObj);
  res.json(a);
});

router.get("/info", validateToken, async (req, res) => {
  try {
    const userObj = req.user;
   
    
    const account = await accounts.findOne({
      where: { account_id: userObj.account_id }
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/", validateToken, async (req, res) => {
  try {
    const data = req.body;
    const accountRes = await accounts.findOne({ where: { account_id: data.account_id } });
    
    if (accountRes) {
      const account = accountRes.dataValues;
      account.account_name = isNotNullOrEmpty(data.account_name) ? data.account_name : account.account_name;
      account.account_type = isNotNullOrEmpty(data.account_type) ? data.account_type : account.account_type;
      account.account_description = isNotNullOrEmpty(data.account_description) ? data.account_description : account.account_description;
      

      await accounts.update(account, {
        where: { account_id: data.account_id }
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

function isNotNullOrEmpty(str) {
  return str !== null && str !== '';
}

module.exports = router;
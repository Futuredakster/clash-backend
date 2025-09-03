const express = require("express");
const router = express.Router();
const { users } = require("../models");
const bcrypt = require("bcrypt");
const {validateToken} = require('../middlewares/AuthMiddleware')
const {validate} = require('../middlewares/AuthMiddleware')
const { Resend } = require('resend');
const Stripe = require("stripe");
require('dotenv').config();

const resend = new Resend(process.env.SENDGRID_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);



const {sign} = require('jsonwebtoken');

router.post("/",validateToken, async (req, res) => {
  const { username, password_hash, email } = req.body;
  const emailExists = await compareEmail(email); 
  if(emailExists){
    console.log("Nope sirrie bob")
    return res.json({error: "This email already cooresponds to an account please login"});
  }
  bcrypt.hash(password_hash, 10).then((hash) => {
    const account_id = req.user.account_id;
    users.create({
      username: username,
      password_hash: hash,
      email: email,
      account_id:account_id,
    });
    res.json("SUCCESS");
  });
});


// You destruct the password,username and email the user puts in and then you hash the password and set the new 
// password equal the old one. This is collected from the user webpage

router.post("/Login", async (req, res) => {
  const { username, password } = req.body;

  const user = await users.findOne({ where: { username: username } });

  // You are checking to see where the username the user puts in is equal to the username in the database

  if (!user) {
    return res.json({ error: "User Doesn't Exist" });
  }

  bcrypt.compare(password, user.password_hash).then((match) => {
    if (!match) {
      return res.json({ error: "Wrong Username And Password Combination" });
    }
    const accessToken= sign({username : user.username, user_id:user.user_id, account_id:user.account_id, role:user.role }, "importantsecret");
    // if the username matches you search for the password and if that matches you are logged in now. This is collected from the login webpage.
    res.json({token: accessToken, username:username, id:user.user_id, account_id:user.account_id, role:user.role});
  });
});

router.get('/auth', validateToken, (req,res) => {
res.json(req.user);
});

router.get('/',validateToken,async (req,res) => {
    const data = req.user;
    const user = await users.findOne ({ 
      where: { user_id: data.user_id },
      attributes: { exclude: ['password_hash'] }
    });
    res.json(user);
})

router.patch("/", validateToken, async (req, res) => {
  try {
    const data = req.body;
    const userRes = await users.findOne({ where: { user_id: data.user_id } });
    
    if (userRes) {
      const user = userRes.dataValues;
      user.username = isNotNullOrEmpty(data.username) ? data.username : user.username;
      user.email = isNotNullOrEmpty(data.email) ? data.email : user.email;
      
      const check = await compareEmail(user.email);
      if(check){
       return res.json({error:"Email already exsists"});
      }

      await users.update(user, {
        where: { user_id: data.user_id }
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

router.patch("/pass", validateToken, async (req, res) => {
  const data = req.user;
  const { password, newPassword } = req.body;

  try {
    const user = await users.findOne({ where: { user_id: data.user_id } });

    if (!user) {
      return res.json({ error: "User Doesn't Exist" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.json({ error: "Wrong Password, please try again" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await users.update(
      { password_hash: hash },
      { where: { user_id: data.user_id } }
    );

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "An error occurred while updating the password" });
  }
});

router.post("/verifyemail", async (req, res) => {
  const {email} = req.body
  const sameEmail = await users.findOne({
    where: {
      email: email,
    },
  });
  if(sameEmail!=null){
    const verifyToken = sign(
      { user_id: sameEmail.user_id },
      "importanttoken",
      { expiresIn: '5m' } // Token expires in 5 minutes
    );
    const url = `https://clash-t.netlify.app/ForgotPass?token=${verifyToken}`;
   const msg= resend.emails.send({
      from: 'onboarding@resend.dev', // Change to your verified sender
      to: email, // Change to your recipient
      subject: 'Testing',
      html: `Please click this link to change your password: <a href="${url}">${url} </a>`,
    })
    if(msg){
        console.log('Email sent')
        res.json({message: "Password recovery email sent successfully!", token:verifyToken,user_id:sameEmail.user_id });
      }
      else if(!msg){
        console.error(error)
      }
  } else{
    res.json({error : "This user dosent exist "});
  }
})

router.patch("/newpassword", validate, async (req, res) => {
  const data = req.user;
  const {password} = req.body;
  const user = await users.findOne({
    where: {
      user_id:data.user_id
    }
  })
  if(user){
    const hash = await bcrypt.hash(password, 10);
    await users.update(
      { password_hash: hash },
      { where: { user_id: data.user_id } }
    );

    return res.json({ message: "Password updated successfully" });
  }
  else{
    res.json({error:"user not found"});
  }
})


router.get("/connect", validateToken,async (req, res) => {
  const data = req.user;
  try {
    const account = await stripe.accounts.create({
      type: "express", // or "standard" depending on what flow you want
    });

    const user = await users.findOne({
    where: {
      user_id:data.user_id
    }
  })
  if(user){
    await users.update(
      { stripe_account: account.id },
      { where: { user_id: data.user_id } }
    );
  }
        
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "https://clash-t.netlify.app/home", // where to go if they restart
      return_url: "https://clash-t.netlify.app/home", // where to go after finishing
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/status",validateToken, async (req,res) => {
  const data = req.user;
  const user = await users.findOne({
    where: {
      user_id:data.user_id
    }
  })
  if(user.stripe_account){
    res.json({message:true})
  }else{
    res.json({message:false})
  }
})



//  helper functions ----------------------------------------------------------------------------------------------------


async function compareEmail(email){
  const sameEmail = await users.findOne({
    where: {
      email: email,
    },
  });
  if(sameEmail!=null){
     return true;
  }
  return false;
}



function isNotNullOrEmpty(str) {
  return str !== null && str !== '';
}


module.exports = router;

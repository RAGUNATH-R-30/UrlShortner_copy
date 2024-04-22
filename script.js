// import { nanoid } from 'nanoid';

const express = require("express");
const { MongoClient } = require("mongodb");
const app = express();
const cors = require("cors");
var bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken")
// const  nanoid = require("nanoid")
let nanoid;
(async () => {
  const nanoidModule = await import("nanoid");
  nanoid = nanoidModule.nanoid;
})();

app.use(express.json());
app.listen(3000);
app.use(
  cors({
    origin: " http://localhost:5173",
  })
);

const URL = "mongodb+srv://ragunath3003:admin@cluster0.lmyxz0w.mongodb.net/";

const sendmail = async (mailoptions) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    auth: {
      user: "ragunath3003@gmail.com",
      pass: "wglm zmjs ahmr zmth",
    },
  });

  try {
    await transporter.sendMail(mailoptions);
  } catch (error) {
    console.log(error);
  }
};

function authenticate(req,res,next){
  console.log("authenticate")
  
if(!req.headers.authorization){
  console.log("unauthorized")
  return res.status(401).json({ message: "Not Authorized" });
}
jwt.verify(req.headers.authorization,"world2024",(err,decoded)=>{
  if(err){
    console.log("Not a Valid Token")
    return res.status(401).json({ message: "Not a Valid Token" });
  }
  req.payload = decoded;
  next();
})
}

function permit(module){
  console.log("permit")
  console.log()
  return (req, res, next) => {
    // console.log(req)
    console.log(req.method);
    const permissions = req.payload.permissions[module]; // ["GET","POST"]
    if (permissions.findIndex((p) => p == req.method) !== -1) {
      next();
    } else {
      res.status(401).json({
        message: "UnAuthorized",
      });
    }}
}

app.get("/", (req, res) => {
  res.json("API started Successfully");
});

app.post("/createuser", async (req, res) => {
  // console.log(req.body);
  try {
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const email = req.body.email;
    const already_exist = await users_collection.findOne({
      email: req.body.email,
    });

    console.log(already_exist);

    if (!already_exist) {
      const salt = bcrypt.genSaltSync(10);
      const hashed_password = bcrypt.hashSync(req.body.password, salt);
      req.body.password = hashed_password;
      req.body.status = "inactive";
      await users_collection.insertOne(req.body);

      const mailoptions = {
        from: {
          name: "Ragunath",
          address: "ragunath3003@gmail.com",
        },
        to: [email],
        subject: "Activate Account",
        text: "Activate Account",
        html: `<p>Click <a href="http://localhost:5173/accountactive?email=${email}">here</a> to <b>Activate your account.</b></p>`,
      };
      await sendmail(mailoptions);
      res.json("success");
      await connection.close();
    } else {
      res.json("user already exist");
      await connection.close();
    }
  } catch (error) {
    res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
});

app.post("/activateaccount", async (req, res) => {
  try {
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    // console.log(req.body);
    const email = req.body.email;
    // console.log(email);
    const already_exist = await users_collection.findOne({ email: email });
    if (already_exist.status == "active") {
      res.json("already active");
      console.log("already active")
    } else {
      if (already_exist) {
        try {
          const activate = await users_collection.updateOne(
            { email: email },
            { $set: { status: "active",urls:[] } }
          );
          res.json("success");
          await connection.close();
        } catch (error) {
          res.json("failed");
          res.status(500).json("SoMething went wrong");
        }
      } else {
        res.json("failed");
        await connection.close();
      }
    }
  } catch (error) {
    res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
});

app.post("/login",async(req,res)=>{
  try {
    const connection = await MongoClient.connect(URL)
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const user = await users_collection.findOne({email:req.body.email})
    if(user){
      const ispassword = bcrypt.compareSync(req.body.password,user.password)
      if(ispassword){
        const token = jwt.sign(
          {
            id:user._id,
            name:user.firstname,
            permissions:{
              users:["GET","POST",]
            }
          },
          "world2024",
          {expiresIn:"1h"}
        );
        res.json({token})
      }
      else{
        res.status(404).json({ message: "Invalid Credientials" });
      }
    }
    else{
      res.status(404).json({ message: "Invalid Credientials" });
    }
  } catch (error) {
    res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
})

app.get("/userinfo",[authenticate,permit("users")],async(req,res)=>{
try {
  const connection = await MongoClient.connect(URL)
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const user = await users_collection.findOne({email:req.body.email})
res.json(user)
} catch (error) {
  res.json("failed");
    res.status(500).json("SoMething went wrong");
}  
})
// [authenticate,permit],
app.post("/shortenurl",[authenticate,permit("users")],async(req,res)=>{
  try {
    console.log("shorten")
    const connection = await MongoClient.connect(URL)
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const url_collections = db.collection("urls");
    const urlid = nanoid(6);
    console.log("urlid",urlid)
    const base = "http://localhost:3000"
    const shortenurl = `${base}/${urlid}`
    // console.log(req)
    const user = await users_collection.updateOne({email:req.body.email},{$push:{urls:{urlid:urlid,url:req.body.url,shortenurl:shortenurl,click:0}}})
    const url = await url_collections.insertOne({urlid:urlid,url:req.body.url,shortenurl:shortenurl,email:req.body.email,click:0})
    res.json("sucess")
  } catch (error) {
    res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
})

app.get("/:urlid",async(req,res)=>{
  try {
    const urlid = req.params.urlid
    const connection = await MongoClient.connect(URL)
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const url_collections = db.collection("urls");
    const url = await url_collections.findOne({urlid:urlid})
    const urlclik = await  url_collections.updateOne({urlid:urlid},{$inc:{click:1}})
    const originalurl = url.url
    res.redirect(originalurl)
    console.log(url)
    await connection.close()
  } catch (error) {
    res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
})

app.get("/getuserurls/:email",async(req,res)=>{
  try {
    const email = req.params.email
    const connection = await MongoClient.connect(URL)
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const user = await users_collection.findOne({email:email})
    const url_collections = db.collection("urls");
    const allurl = await url_collections.find({email:email}).toArray()
// console.log(allurl)
    const userurls = user.urls
    res.json(allurl)
  } catch (error) {
    res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
})
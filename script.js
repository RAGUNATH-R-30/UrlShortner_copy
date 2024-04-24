// import { nanoid } from 'nanoid';

const express = require("express");
const { MongoClient } = require("mongodb");
const app = express();
const cors = require("cors");
var bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const moment = require("moment");
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

const URL = process.env.DB;

const sendmail = async (mailoptions) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    auth: {
      user: process.env.email,
      pass: process.env.password,
    },
  });

  try {
    await transporter.sendMail(mailoptions);
  } catch (error) {
    console.log(error);
  }
};

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
}

//This is the function which sends email
const sendmailotp = async (mailoptions) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    auth: {
      user: process.env.email,
      pass: process.env.password,
    },
  });
  try {
    await transporter.sendMail(mailoptions);
  } catch (error) {
    console.log(error);
  }
};
function authenticate(req, res, next) {
  console.log("authenticate");

  if (!req.headers.authorization) {
    console.log("unauthorized");
    return res.status(401).json({ message: "Not Authorized" });
  }
  jwt.verify(req.headers.authorization, "world2024", (err, decoded) => {
    if (err) {
      console.log("Not a Valid Token");
      return res.status(401).json({ message: "Not a Valid Token" });
    }
    req.payload = decoded;
    next();
  });
}

function permit(module) {
  console.log("permit");
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
    }
  };
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
    // res.json("failed");
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
      console.log("already active");
    } else {
      if (already_exist) {
        try {
          const activate = await users_collection.updateOne(
            { email: email },
            { $set: { status: "active", urls: [] } }
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
    // res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
});

app.post("/login", async (req, res) => {
  try {
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const user = await users_collection.findOne({ email: req.body.email });
    if (user) {
      const ispassword = bcrypt.compareSync(req.body.password, user.password);
      if (ispassword) {
        const token = jwt.sign(
          {
            id: user._id,
            name: user.firstname,
            permissions: {
              users: ["GET", "POST"],
            },
          },
          "world2024",
          { expiresIn: "1h" }
        );
        res.json({ token });
        await connection.close();
      } else {
        res.status(404).json({ message: "Invalid Credientials" });
        await connection.close();
      }
    } else {
      res.status(404).json({ message: "Invalid Credientials" });
      await connection.close();
    }
  } catch (error) {
    // res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
});

app.post("/userinfo", [authenticate, permit("users")], async (req, res) => {
  try {
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const url_collections = db.collection("urls");
    console.log("userinfo", req.body);
    console.log(req.body.email);
    const email = req.body.email;
    const user = await users_collection.findOne({ email: req.body.email });
    console.log("user", user);

    const urluser = await url_collections.findOne({ email: req.body.email });
    if (urluser) {
      const urlstoday = await url_collections
        .aggregate([
          {
            $match: {
              email: email,
            },
          },
          {
            $group: {
              _id: "$date",
              count: {
                $sum: 1,
              },
            },
          },
        ])
        .toArray();

      const month = moment().format("MM");
      const todaydate = moment().format("DD-MM-YYYY");
      let dates = [];
      const userurlsdate = user.urls.map((item) => {
        dates.push(item.date);
        console.log(item.date);
      });

      const currentmonthdates = dates.filter((date) => {
        return date.slice(3, 5) == month;
      });

      const today = dates.filter((date)=>date==todaydate)
      console.log("today",today.length)
      console.log(currentmonthdates);
      console.log(urlstoday);

      let urlstodaycount = urlstoday[0].count
      let monthurlcount = currentmonthdates.length
      res.json({
        user: user,
        count: today.length,
        monthurlcount: monthurlcount,
      });
      await connection.close();
    } else {
      res.json({ user: user, count: 0, monthurlcount: 0 });
      await connection.close();
    }
  } catch (error) {
    // res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
});
// [authenticate,permit],
app.post("/shortenurl", [authenticate, permit("users")], async (req, res) => {
  try {
    console.log("shorten");
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const url_collections = db.collection("urls");
    const urlid = nanoid(6);
    console.log("urlid", urlid);
    const base = "http://localhost:3000";
    const shortenurl = `${base}/${urlid}`;
    const date = moment().format("DD-MM-YYYY");
    // console.log(req)
    const user = await users_collection.updateOne(
      { email: req.body.email },
      {
        $push: {
          urls: {
            urlid: urlid,
            url: req.body.url,
            shortenurl: shortenurl,
            click: 0,
            date: date,
          },
        },
      }
    );
    const url = await url_collections.insertOne({
      urlid: urlid,
      url: req.body.url,
      shortenurl: shortenurl,
      email: req.body.email,
      click: 0,
      date: date,
    });
    res.status(200).json({ message: "sucess", shortenurl: shortenurl });
    await connection.close();
  } catch (error) {
    // res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
});

app.get("/:urlid", async (req, res) => {
  try {
    const urlid = req.params.urlid;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const url_collections = db.collection("urls");
    const url = await url_collections.findOne({ urlid: urlid });
    const urlclik = await url_collections.updateOne(
      { urlid: urlid },
      { $inc: { click: 1 } }
    );
    const originalurl = url.url;
    res.redirect(originalurl);
    console.log(url);
    await connection.close();
  } catch (error) {
    // res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
});

app.get("/getuserurls/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const users_collection = db.collection("users");
    const user = await users_collection.findOne({ email: email });
    const url_collections = db.collection("urls");
    const allurl = await url_collections.find({ email: email }).toArray();
    // console.log(allurl)
    const userurls = user.urls;
    res.json(allurl);
    await connection.close();
  } catch (error) {
    // res.json("failed");
    res.status(500).json("SoMething went wrong");
  }
});

app.get("/urls/:email", async (req, res) => {
  const email = req.params.email;

  try {
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortener");
    const urlsCollection = db.collection("urls");

    // Get current date
    const currentDate = new Date();
    const startOfDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    );
    const endOfDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + 1
    );
    console.log(startOfDay);
    console.log(endOfDay);

    // Aggregate to count URLs created today for the user
    const urlsToday = await urlsCollection
      .aggregate([
        {
          $match: {
            email: email,
            date: {
              $gte: startOfDay,
              $lt: endOfDay,
            },
          },
        },
      ])
      .toArray();

    res.json({
      urlsToday,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/forgotpassword/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const collection = db.collection("users");
    const user_exists = await collection.findOne({ email: email });
    if (user_exists) {
      res.json("User Exists");
      await connection.close();
    } else {
      res.json("User Not Exists");
      await connection.close();
    }
  } catch (error) {
    console.log(error);
    res.status(500).json("Something Went Wrong");
  }
});

//inserts otp to users collection
app.put("/generateotp/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const collection = db.collection("users");
    const otp = generateRandomString(5);
    const user_exists = await collection.updateOne(
      { email: email },
      { $set: { otp: otp } }
    );

    const mailoptions = {
      from: {
        name: "Ragunath",
        address: "ragunath3003@gmail.com",
      },
      to: [email],
      subject: "Password Reset.",
      text: "otp",
      html: `<p>Click <a href="http://localhost:5173/newpassword?email=${email}&otp=${otp}">here</a> to change your password.</p>`,
    };
    await sendmailotp(mailoptions);
    res.json("otpsent");
    await connection.close();
  } catch (error) {
    console.log(error);
    res.status(500).json("Something Went Wrong");
  }
});

//gets the otp from user collection
app.get("/verifyotp/:email/:otp", async (req, res) => {
  try {
    const email = req.params.email;
    const entered_otp = req.params.otp;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const collection = db.collection("users");
    const user = await collection.findOne({ email: email });
    const otp = user.otp;
    if (entered_otp == otp) {
      res.json("verified");
      await connection.close();
    } else {
      res.json("not verified");
      await connection.close();
    }
  } catch (error) {
    console.log(error);
    res.status(500).json("Something Went Wrong");
  }
});

app.put("/updatepassword/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const password = req.body.password;
    var salt = bcrypt.genSaltSync(10);
    var hased_password = bcrypt.hashSync(password, salt);
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const collection = db.collection("users");
    const user = await collection.updateOne(
      { email: email },
      { $set: { password: hased_password } }
    );
    await collection.updateOne({ email: email }, { $set: { otp: "" } });
    res.json("Password Updated Successfully");
    await connection.close();
  } catch (error) {
    console.log(error);
    res.status(500).json("Something Went Wrong");
  }
});

app.post("/getmonthsurl", async (req, res) => {
  try {
    const email = req.body.email;
    const connection = await MongoClient.connect(URL);
    const db = connection.db("urlshortner");
    const collection = db.collection("users");
    const user = await collection.findOne({ email: email });
    const month = moment().format("MM");
    console.log(moment().format("MM"));
    let dates = ["25-05-2024"];
    const userurlsdate = user.urls.map((item) => {
      dates.push(item.date);
      console.log(item.date);
    });

    const currentmonthdates = dates.filter((date) => {
      return date.slice(3, 5) == month;
    });
    console.log(currentmonthdates);
    res.json(dates);
  } catch (error) {
    console.log(error);
    res.status(500).json("Something Went Wrong");
  }
});

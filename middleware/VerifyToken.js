// verify jwt token
// middleware
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).send({ error: "Authorization header missing" });
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    if (!token) {
      return res.status(401).send({ error: "Token missing from header" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findOne({
      _id: decoded._id,
      "tokens.token": token,
    });

    if (!user) {
      return res.status(401).send({ error: "User not found or invalid token" });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error("Authentication error:", error.message); // Log the specific error
    res.status(401).send({ error: "Please authenticate" });
  }
};

module.exports = verifyToken;




























// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// const verifyToken = async (req, res, next) => {
//   try {
//     const authHeader = req.headers["Authorization"];
//     if (!authHeader) {
//       return res.status(401).send({ error: "Authorization header missing" });
//     }

//     const token = authHeader.replace("Bearer ", "");
//     const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
//     const user = await User.findOne({
//       _id: decoded._id,
//       "tokens.token": token,
//     });

//     if (!user) {
//       return res.status(401).send({ error: "User not found" });
//     }

//     req.user = user;
//     req.token = token;
//     next();
//   } catch (error) {
//     res.status(401).send({ error: "Please authenticate" });
//   }
// };


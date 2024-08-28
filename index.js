const mongoose = require("mongoose");
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const userRoutes = require("./routes/userRoutes");
const walletRoutes = require('./routes/walletRoutes');
const transactionRoutes = require("./routes/transactionRoutes");
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();


app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

mongoose
  .connect(
    `mongodb+srv://aakojuliusoluwanifemi:${process.env.DB_USER_PASSWORD}@kite-pay.raidlxg.mongodb.net/?retryWrites=true&w=majority&appName=Kite-Pay`,
    {
      serverSelectionTimeoutMS: 5000
    }
  )
  .then(() => console.log("MongoDB Connected Successfully!"))
  .catch((error) => console.log("Error connecting to MongoDB", error));
  

app.post("/jwt", async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1hr",
  });
  res.send({ token });
});


app.use("/api/users", userRoutes);
app.use('/api/wallet', walletRoutes);
app.use("/api/transactions", transactionRoutes);

app.get("/api", (req, res) => {
  res.send("Hello Developer AJ!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

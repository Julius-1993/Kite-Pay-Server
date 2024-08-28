const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const multer = require('multer');
const verifyToken = require("../middleware/VerifyToken");
const mongoose = require('mongoose');

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password, phoneNumber } = req.body;
  const newUser = new User({ name, email, password, phoneNumber });
  if(!name || !email || !password || !phoneNumber){
    return res.status(400).send('All field are required!');
  }
  try{
    await newUser.save();
  res.status(201).json({message: "User registered", userId: newUser._id});

  }catch(error){
    res.status(500).json({error: 'Iternal server error'});
  }
});


router.post("/login", async (req, res) => {
  const { phoneNumber, password } = req.body;
  if(!password || !phoneNumber){
    return res.status(400).send('Phone Number and Password are required');
  }
  try {
    // Find the user by phone number
    const user = await User.findOne({ phoneNumber });
    if (!user) return res.status(400).json({ error: "User not found" });

    // Check if the provided password matches the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    // Generate a JWT token
    const token = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1hr",
    });

    // Send the token and userId as JSON response
    res.json({ token, userId: user._id });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

router.get('/balance/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log('Fetching balance for:', userId)
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found.');
    }
    res.status(200).json({ balance: user.walletBalance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).send('Internal server error.');
  }
});


router.post("/updatePassword", verifyToken, async (req, res) => {
  const { userId, newPassword } = req.body;
  const user = await User.findById(userId);
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();
  res.send("Password updated");
});

router.put("/updatePin", verifyToken, async (req, res) => {
  const { userId, newPin } = req.body;
  const user = await User.findById(userId);
  user.transactionPin = newPin;
  await user.save();
  res.send("Transaction PIN updated");
});

// Get user profile
router.get('/profile/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Check if userId is undefined or not a valid ObjectId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid or missing userId' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});


//image update path using multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Ensure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Update user profile
router.put('/profile/:userId', upload.single('profilePicture'), async (req, res) => {
  const { userId } = req.params;
  const { name, email } = req.body;
  const profilePicture = req.file ? req.file.path : null;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { name, email, profilePicture },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Refresh token endpoint
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(403).json({ message: 'Refresh token is required' });
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Find the user with the decoded user ID
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a new JWT
    const newAccessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});


module.exports = router;

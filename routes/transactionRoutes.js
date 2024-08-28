const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const verifyToken = require('../middleware/VerifyToken');
// const { initializeTransaction, verifyTransaction } = require('../service/paystackService');


const router = express.Router();


router.get('/history/:userId', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.params.userId });
    res.json({ transactions }); // Return the transactions in an object with a key of "transactions"
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transaction history" });
  }
});


router.post('/purchaseAirtime', verifyToken, async (req, res) => {
  const { amount, phoneNumber } = req.body;

  try {
    const newBalance = await updateBalance(req.user._id, amount, 'debit', `Airtime purchase for ${phoneNumber}`);
    res.json({ walletBalance: newBalance });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post('/payUtilityBill', verifyToken, async (req, res) => {
  const { amount, utilityType } = req.body;

  try {
    const newBalance = await updateBalance(req.user._id, amount, 'debit', `Utility bill payment for ${utilityType}`);
    res.json({ walletBalance: newBalance });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post('/bettingFunds', verifyToken, async (req, res) => {
  const { amount, betType } = req.body;
  try {
    const newBalance = await updateBalance(req.user._id, amount, 'debit', `Betting funds for ${betType}`);
    res.json({ walletBalance: newBalance });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post('/qrTransfer', async (req, res) => {
  const { senderId, receiverPhone, amount, transactionPin } = req.body;
  const sender = await User.findById(senderId);
  const receiver = await User.findOne({ phoneNumber: receiverPhone });

  if (!receiver) {
    return res.status(400).send('Receiver not found');
  }

  if (sender.transactionPin !== transactionPin) {
    return res.status(400).send('Invalid transaction PIN');
  }

  if (sender.walletBalance < amount) {
    return res.status(400).send('Insufficient balance');
  }

  sender.walletBalance -= amount;
  receiver.walletBalance += amount;

  await sender.save();
  await receiver.save();

  const transaction = new Transaction({
    userId: sender._id,
    amount,
    type: 'debit',
    description: `Transfer to ${receiver.phoneNumber}`,
  });

  await transaction.save();

  res.json({ walletBalance: sender.walletBalance });
});

module.exports = router;


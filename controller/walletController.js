const paystack = require("paystack")(process.env.PAYMENT_PAYSTACK_SECRET_KEY);
const User = require("../models/User");
const crypto = require("crypto");
require("dotenv").config();
const axios = require("axios");
const Transaction = require('../models/Transaction');

console.log(process.env.PAYMENT_PAYSTACK_SECRET_KEY);

const addFundsToWallet = async (req, res) => {
  try {
      const { email, amount } = req.body;
      if (!email || !amount) {
          return res.status(400).json({ success: false, message: "Email and amount are required." });
      }

      const amountInKobo = amount * 100; // Paystack uses the smallest currency unit

      const response = await axios.post(
          "https://api.paystack.co/transaction/initialize",
          {
              email: email,
              amount: amountInKobo,
          },
          {
              headers: {
                  Authorization: `Bearer ${process.env.PAYMENT_PAYSTACK_SECRET_KEY}`,
              },
          }
      );

      if (response.data && response.data.status) {
          return res.status(200).json({
              success: true,
              authorization_url: response.data.data.authorization_url,
              access_code: response.data.data.access_code,
              reference: response.data.data.reference,
          });
      } else {
          return res.status(500).json({ success: false, message: response.data.message || "Transaction initialization failed." });
      }
  } catch (error) {
      console.error("Error in addFundsToWallet:", error.response ? error.response.data : error.message);
      return res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
  }
};

const verifyTransaction = async (req, res) => {
  const { reference, userId, amount } = req.body;

  if (!reference || !userId || !amount) {
    return res.status(400).send('Reference, user ID, and amount are required.');
  }

  try {
    // Check for existing transaction with the same reference before verifying with Paystack
    const existingTransaction = await Transaction.findOne({ reference });
    if (existingTransaction) {
      return res.status(400).json({
        success: false,
        message: 'Transaction already processed.',
        walletBalance: existingTransaction.walletBalance,
      });
    }

    // Verify the transaction with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYMENT_PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    // Check if the response from Paystack is valid and successful
    if (response.data && response.data.data && response.data.data.status === 'success') {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).send('User not found.');
      }

      if (isNaN(user.walletBalance)) {
        user.walletBalance = 0;
      }

      const validAmount = parseFloat(amount);
      if (isNaN(validAmount)) {
        return res.status(400).send('Invalid amount.');
      }

      // Save the transaction
      const transaction = new Transaction({
        userId: user._id,
        amount: validAmount,
        type: 'credit',
        reference,
        walletBalance: user.walletBalance + validAmount,
      });

      await transaction.save();

      // Update user's wallet balance
      user.walletBalance += validAmount;
      await user.save();

      return res.status(200).json({
        walletBalance: user.walletBalance,
        success: true,
        message: 'Transaction successful',
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || 'Verification failed.',
      });
    }
  } catch (error) {
    console.error(
      'Error in verifyTransaction:',
      error.response ? error.response.data : error.message
    );
    return res.status(500).json({
      success: false,
      message:
        error.response?.data?.message ||
        'Transaction verification failed. Please try again.',
    });
  }
};


const fetchBankList = async (req, res) => {
  try {
    const response = await axios.get('https://api.paystack.co/bank', {
      headers: {
        Authorization: `Bearer ${process.env.PAYMENT_PAYSTACK_SECRET_KEY}`
      }
    });

    const banks = response.data.data.map(bank => ({
      name: bank.name,
      code: bank.code
    }));

    return res.status(200).json({ success: true, banks });
  } catch (error) {
    console.error("Failed to fetch bank list:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch bank list" });
  }
};


// Step 3: Fetch account name based on account number and selected bank code
const getAccountName = async (req, res) => {
  try {
    const { account_number, bank_code } = req.body;

    if (!account_number || !bank_code) {
      return res.status(400).json({ success: false, message: "Account number and bank code are required" });
    }

    const response = await axios.get('https://api.paystack.co/bank/resolve', {
      headers: {
        Authorization: `Bearer ${process.env.PAYMENT_PAYSTACK_SECRET_KEY}`
      },
      params: {
        account_number,
        bank_code
      }
    });

    if (!response.data || !response.data.data || !response.data.data.account_name) {
      return res.status(400).json({ success: false, message: "Unable to resolve account name" });
    }

    return res.status(200).json({ success: true, accountName: response.data.data.account_name });
  } catch (error) {
    console.error("Error fetching account name:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


// Step 4: Proceed with the transfer
const transferFunds = async (req, res) => {
  try {
    const { amount, account_number, bank_code, reason, userId, pin } = req.body;

    if (!amount || !account_number || !bank_code) {
      return res.status(400).json({ success: false, message: "Amount, account number, and bank selection are required" });
    }

    const amountInKobo = amount * 100;

    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.USE_MOCK_PAYSTACK === 'true';

    let transferResponse;

    if (isTestEnvironment) {
      transferResponse = {
        success: true,
        message: "Transfer successful",
        data: {
          transfer_code: "TRF_1asfd7p3mqbw4",
          status: "success",
          amount: amountInKobo,
          recipient: {
            account_number,
            bank_code,
          },
        },
      };
    } else {
      const response = await axios.post(
        'https://api.paystack.co/transfer', 
        {
          source: "balance",
          amount: amountInKobo,
          recipient: {
            account_number,
            bank_code,
          },
          reason: reason,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYMENT_PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      transferResponse = response.data;
    }

    if (transferResponse.success) {
      // Generate a unique reference for the transaction
      const uniqueReference = `TRX_${new Date().getTime()}_${Math.floor(Math.random() * 100000)}`;

      const newTransaction = new Transaction({
        userId: userId,
        amount: amount,
        reference: uniqueReference, // Use the dynamically generated reference
        type: "debit",
        date: new Date(),
      });
      await newTransaction.save();

      const user = await User.findOne({ _id: userId });
      if (user) {
        user.walletBalance -= amount;
        user.transactions.push(newTransaction._id);
        await user.save();
      }

      return res.status(200).json({ 
        success: true, 
        transfer: transferResponse.data, 
        updatedBalance: user.walletBalance 
      });
    } else {
      return res.status(400).json({ success: false, message: transferResponse.message });
    }
  } catch (error) {
    console.error("Error during fund transfer:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};





const saveRecipient = async (req, res) => {
  try {
    const { name, account_number, bank_name } = req.body;

    const recipient = new Recipient({
      name,
      account_number,
      bank_name,
      userId: req.user.id,  // Assuming you have user authentication
    });

    await recipient.save();

    res.status(200).json({ success: true, message: "Recipient saved successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const paystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto
      .createHmac("sha512", secret)
      .update(req.body)
      .digest("hex");

    if (hash === req.headers["x-paystack-signature"]) {
      const event = JSON.parse(req.body);

      if (event.event === "charge.success") {
        const email = event.data.customer.email;
        const amount = event.data.amount / 100;

        const user = await User.findOne({ email });
        if (user) {
          user.walletBalance += amount;
          user.transactions.push({ amount, type: "credit", status: "success" });
          await user.save();
        }
      }
    }
    res.sendStatus(200);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addFundsToWallet,
  transferFunds,
  saveRecipient,
  paystackWebhook,
  verifyTransaction,
  fetchBankList,
  getAccountName
};

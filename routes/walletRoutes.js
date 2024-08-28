const express = require('express');
const { addFundsToWallet, transferFunds, fetchBankList, saveRecipient, paystackWebhook,  getBankDetails,
  getAccountName, verifyTransaction } = require('../controller/walletController');

const router = express.Router();

router.get('/fetch-bank-list', fetchBankList);
router.post('/add-funds', addFundsToWallet);
router.post('/verify', verifyTransaction);
router.post('/transfer-funds', transferFunds);
router.post('/save-recipient', saveRecipient);
// router.post('/get-bank-details',  getBankDetails);
router.post('/get-account-name', getAccountName);
router.post('/webhook', express.raw({ type: 'application/json' }), paystackWebhook);

module.exports = router;

const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  reference: {
    type: String,
    unique: true
  },
  type: String, // 'credit' or 'debit'
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', transactionSchema);



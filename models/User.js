const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
     type: String,
    required: true
    },
    email: {
      type: String,
      unique: true,
      required: true
    },
    phoneNumber: {
      type: String,
      unique: true,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    transactionPin: String,
    profilePicture: { 
      type: String 
    },
    // transactions:[ transactionSchema]
    transactions: [{type: mongoose.Schema.Types.ObjectId, ref: 'Transaction'}],

  },
  
  
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});
module.exports = mongoose.model("User", userSchema);

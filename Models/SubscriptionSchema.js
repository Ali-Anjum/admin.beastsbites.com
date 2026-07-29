const mongoose = require("mongoose");
const subscriptionSchema = new mongoose.Schema({
  subscription_id: { type: Number, required: true, unique: true },
  client_id: { type: Number, required: true },

  start_date: { type: Date, required: true },
  stop_date: { type: Date, required: true },

  subscription_type: {
    type: String,
    enum: ["Daily", "Weekly", "Monthly"],
    required: true
  },

  active_for_days: {
    type: Number,
    enum: [7, 20, 30],
    default: 30
  },

  food_preference: {
    type: String,
    enum: ["Veg", "Non-Veg"],
    required: true
  },

  status: {
    type: String,
    enum: ["Active", "Paused", "Stopped"],
    default: "Active"
  }
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
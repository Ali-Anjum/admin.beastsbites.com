const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema({
  delivery_id: {
    type: Number,
    required: true,
    unique: true,
    default: () => Math.floor(100000 + Math.random() * 900000)
  },
  subscription_id: { type: Number, required: false, default: null },
  customer_id: { type: Number, required: false, default: null },
  assigned_to_user_id: { type: Number, required: true },
  assigned_to_username: { type: String, required: true },
  delivery_date: { type: Date, required: true },
  food: {
    type: String,
    enum: [
      "Chicken Karahi",
      "Chicken Biryani",
      "Daal Chawal",
      "Mix Sabzi",
      "Pulao",
      "Combined Meal"
    ],
    default: "Combined Meal"
  },
  meal_time: {
    type: [String],
    enum: ["Breakfast", "Lunch", "Dinner"],
    default: []
  },
  photo_url: {
    type: String,
    default: ""
  },
  photo_uploaded_at: {
    type: Date,
    default: null
  },
  delivery_status_timestamp: {
    type: Date,
    default: null
  },
  delivery_status: {
    type: String,
    enum: ["Pending", "Delivered", "Cancelled"],
    default: "Pending"
  },
  comments: {
    type: String,
    default: ""
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Delivery", deliverySchema);
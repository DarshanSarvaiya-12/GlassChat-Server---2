const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected!');
  } catch (error) {
    console.error('MongoDB Error:', error.message);
  }
};

// Customer Schema
const customerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: null },
  session: {
    stage: { 
      type: String, 
      enum: ['new', 'browsing', 'confirmed', 'quantity', 'address', 'payment', 'confirming', 'completed'],
      default: 'new' 
    },
    cart: { type: Array, default: [] },
    selectedSize: { type: String, default: null },
    pendingCode: { type: String, default: null },
    paymentMethod: { type: String, default: null },
    askedToContinue: { type: Boolean, default: false },
    deliveryAddress: { type: String, default: null },
    orderTotal: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 99 },
    grandTotal: { type: Number, default: 0 },
    conversationHistory: { type: Array, default: [] },
    expiresAt: { 
      type: Date, 
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
    }
  },
  orders: { type: Array, default: [] },
  totalVisits: { type: Number, default: 1 },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = {
  connectDB,
  Customer
};

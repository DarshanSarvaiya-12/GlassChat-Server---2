require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { connectDB, Customer } = require('./db');
const { 
  sendTextMessage, 
  sendSizeButtons, 
  getOrCreateCustomer, 
  updateCustomer,
  getGroqReply,
  SYSTEM_PROMPT,
  calculateTotals 
} = require('./services');

const products = require('./products');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

connectDB();

// Health Check
app.get('/', (req, res) => res.send('✅ GlassChat Server is Running!'));

// Webhook Verification
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// Main Webhook
app.post('/webhook', async (req, res) => {
  try {
    const messageObj = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!messageObj) return res.sendStatus(200);

    const userPhone = messageObj.from;
    const msgType = messageObj.type;

    let customer = await getOrCreateCustomer(userPhone);

    // Button Reply Handler
    if (msgType === 'interactive') {
      const buttonId = messageObj.interactive?.button_reply?.id;
      if (buttonId?.startsWith('size_')) {
        const sizes = { size_s: 'S', size_m: 'M', size_l: 'L', size_xl: 'XL', size_xxl: 'XXL' };
        const size = sizes[buttonId];

        await updateCustomer(userPhone, {
          'session.selectedSize': size,
          'session.stage': 'browsing'
        });

        await sendTextMessage(userPhone, `✅ Size *${size}* selected!\n\nHere is our collection 👇`);

        for (const code in products) {
          const p = products[code];
          await require('./services').sendImageMessage(userPhone, p.image_url, p.caption);
          await require('./services').delay(800);
        }

        await sendTextMessage(userPhone, "Send the **Code** (like TS01) of the T-Shirt you like.");
      }
    }

    // Text Message Handler
    if (msgType === 'text') {
      const userText = messageObj.text.body.trim();
      const lowerText = userText.toLowerCase();

      customer = await Customer.findOne({ phone: userPhone });

      // AI Powered Reply
      const history = customer.session.conversationHistory || [];
      history.push({ role: "user", content: userText });

      const aiResponse = await getGroqReply(history, SYSTEM_PROMPT);

      // Save conversation
      history.push({ role: "assistant", content: aiResponse });
      await updateCustomer(userPhone, { 
        'session.conversationHistory': history.slice(-6)   // keep last 3 exchanges
      });

      await sendTextMessage(userPhone, aiResponse);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error:", error.message);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GlassChat Server running on http://localhost:${PORT}`);
});
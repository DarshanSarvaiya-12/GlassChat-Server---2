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

    await getOrCreateCustomer(userPhone);

    // Button Handler
    if (msgType === 'interactive') {
      const buttonId = messageObj.interactive?.button_reply?.id;
      if (buttonId?.startsWith('size_')) {
        const sizeMap = { size_s: 'S', size_m: 'M', size_l: 'L', size_xl: 'XL', size_xxl: 'XXL' };
        const size = sizeMap[buttonId];

        await updateCustomer(userPhone, {
          'session.selectedSize': size,
          'session.stage': 'browsing'
        });

        await sendTextMessage(userPhone, `Great! You selected *${size}* size 👕\n\nHere is our collection:`);

        for (const code in products) {
          const p = products[code];
          await require('./services').sendImageMessage(userPhone, p.image_url, p.caption);
          await require('./services').delay(700);
        }

        await sendTextMessage(userPhone, "Please send the **Code** (e.g. TS01) of the T-Shirt you want.");
      }
    }

    // Text Message Handler
    if (msgType === 'text') {
      const userText = messageObj.text.body.trim();
      let customer = await Customer.findOne({ phone: userPhone });

      const history = customer.session.conversationHistory || [];
      history.push({ role: "user", content: userText });

      const aiReply = await getGroqReply(history);

      // Save history
      history.push({ role: "assistant", content: aiReply });
      await updateCustomer(userPhone, { 
        'session.conversationHistory': history.slice(-8) 
      });

      await sendTextMessage(userPhone, aiReply);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Server Error:", error.message);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GlassChat Server is running on port ${PORT}`);
});
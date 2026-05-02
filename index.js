require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const products = require('./products');
const { connectDB, Customer } = require('./db');
const { 
  sendTextMessage, 
  sendSizeButtons, 
  getOrCreateCustomer, 
  updateCustomer,
  calculateTotals 
} = require('./services');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// Connect Database
connectDB();

// Health Check
app.get('/', (req, res) => {
  res.send('✅ GlassChat Server is Running!');
});

// Webhook Verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook Verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Main WhatsApp Webhook (POST)
app.post('/webhook', async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const userPhone = message.from;
    const messageType = message.type;

    let customer = await getOrCreateCustomer(userPhone);

    // Handle Interactive Buttons
    if (messageType === 'interactive') {
      const buttonId = message.interactive?.button_reply?.id;
      
      if (['size_s', 'size_m', 'size_l', 'size_xl', 'size_xxl'].includes(buttonId)) {
        const sizeMap = { size_s: 'S', size_m: 'M', size_l: 'L', size_xl: 'XL', size_xxl: 'XXL' };
        const selectedSize = sizeMap[buttonId];

        await updateCustomer(userPhone, {
          'session.selectedSize': selectedSize,
          'session.stage': 'browsing'
        });

        // Send all product images
        await sendTextMessage(userPhone, `Great! You selected Size *${selectedSize}* 👍\n\nHere is our collection 👇`);
        
        for (const code in products) {
          const p = products[code];
          await require('./services').sendImageMessage(userPhone, p.image_url, p.caption);
          await require('./services').delay(700);
        }
      }
    }

    // TODO: We will add full text message + AI logic in next step after structure is ready

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Error:', error.message);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GlassChat Server running on port ${PORT}`);
});

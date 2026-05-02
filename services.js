const axios = require('axios');
const products = require('./products');
const { Customer } = require('./db');

// ====================== WHATSAPP FUNCTIONS ======================

async function sendTextMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      },
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
    );
  } catch (error) {
    console.error('Send Text Error:', error.message);
  }
}

async function sendImageMessage(to, imageUrl, caption) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'image',
        image: { link: imageUrl, caption: caption }
      },
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
    );
  } catch (error) {
    console.error('Send Image Error:', error.message);
  }
}

async function sendSizeButtons(to) {
  // First row: S, M, L
  await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: "Please select your Size:" },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'size_s', title: 'S' } },
            { type: 'reply', reply: { id: 'size_m', title: 'M' } },
            { type: 'reply', reply: { id: 'size_l', title: 'L' } }
          ]
        }
      }
    },
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
  );

  await delay(600);

  // Second row: XL, XXL
  await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: "More sizes:" },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'size_xl', title: 'XL' } },
            { type: 'reply', reply: { id: 'size_xxl', title: 'XXL' } }
          ]
        }
      }
    },
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
  );
}

// ====================== HELPER FUNCTIONS ======================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOrCreateCustomer(phone) {
  let customer = await Customer.findOne({ phone });
  if (!customer) {
    customer = new Customer({ phone });
    await customer.save();
  } else {
    await Customer.updateOne({ phone }, { $inc: { totalVisits: 1 } });
  }
  return customer;
}

async function updateCustomer(phone, data) {
  await Customer.updateOne({ phone }, { $set: data });
}

// Calculate Totals with discount
function calculateTotals(cart) {
  let orderTotal = cart.reduce((sum, item) => sum + (item.totalPrice || item.pricePerItem), 0);
  let discount = 0;
  if (cart.length === 2) discount = orderTotal * 0.10;
  if (cart.length >= 3) discount = orderTotal * 0.20;

  const discountedTotal = orderTotal - discount;
  const shipping = discountedTotal >= 999 ? 0 : 99;
  const grandTotal = discountedTotal + shipping;

  return { orderTotal, discount, discountedTotal, shipping, grandTotal };
}

// ====================== EXPORT ALL ======================

module.exports = {
  sendTextMessage,
  sendImageMessage,
  sendSizeButtons,
  getOrCreateCustomer,
  updateCustomer,
  calculateTotals,
  delay
};

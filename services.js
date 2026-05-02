const axios = require('axios');
const products = require('./products');
const { Customer } = require('./db');

const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

// ====================== SEND FUNCTIONS ======================
async function sendTextMessage(to, text) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
  } catch (e) {
    console.error('Send Text Error:', e.message);
  }
}

async function sendImageMessage(to, imageUrl, caption) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'image',
      image: { link: imageUrl, caption: caption }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
  } catch (e) {
    console.error('Send Image Error:', e.message);
  }
}

async function sendSizeButtons(to) {
  try {
    // First row - S M L
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: "Please select your Size 👇" },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'size_s', title: 'S' } },
            { type: 'reply', reply: { id: 'size_m', title: 'M' } },
            { type: 'reply', reply: { id: 'size_l', title: 'L' } }
          ]
        }
      }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });

    await delay(600);

    // Second row - XL XXL
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: "More Sizes:" },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'size_xl', title: 'XL' } },
            { type: 'reply', reply: { id: 'size_xxl', title: 'XXL' } }
          ]
        }
      }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
  } catch (e) {
    console.error('Size Buttons Error:', e.message);
  }
}

// ====================== HELPERS ======================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOrCreateCustomer(phone) {
  let customer = await Customer.findOne({ phone });
  if (!customer) {
    customer = new Customer({ phone });
    await customer.save();
  } else {
    await Customer.updateOne({ phone }, { $inc: { totalVisits: 1 }, lastMessageAt: new Date() });
  }
  return customer;
}

async function updateCustomer(phone, data) {
  await Customer.updateOne({ phone }, { $set: data });
}

// Calculate Order Totals
function calculateTotals(cart) {
  let orderTotal = 0;
  cart.forEach(item => {
    orderTotal += (item.totalPrice || item.pricePerItem * (item.quantity || 1));
  });

  let discount = 0;
  if (cart.length === 2) discount = orderTotal * 0.10;
  if (cart.length >= 3) discount = orderTotal * 0.20;

  const discountedTotal = orderTotal - discount;
  const shipping = discountedTotal >= 999 ? 0 : 99;
  const grandTotal = discountedTotal + shipping;

  return { orderTotal, discount, discountedTotal, shipping, grandTotal };
}

// Strong System Prompt for AI
const SYSTEM_PROMPT = `You are Niya, a friendly and professional sales assistant at Ashirwad Shop.

- Speak in simple short sentences.
- Ask only ONE question at a time.
- Be polite and helpful.
- Focus on completing the sale step by step.
- Use emojis naturally.

Current Flow:
1. Welcome + Ask Size
2. Show products after size selection
3. Customer sends code → Ask quantity
4. Ask if they want more items
5. Show bill + payment options
6. Take address after payment
7. Get final confirmation`;

module.exports = {
  sendTextMessage,
  sendImageMessage,
  sendSizeButtons,
  getOrCreateCustomer,
  updateCustomer,
  calculateTotals,
  getGroqReply: async (history) => {
    try {
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history
        ],
        max_tokens: 500,
        temperature: 0.65
      }, {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
      });
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Groq Error:', error.message);
      return "Sorry, can you please repeat your message?";
    }
  },
  delay,
  SYSTEM_PROMPT
};
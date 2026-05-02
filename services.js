const axios = require('axios');
const products = require('./products');
const { Customer } = require('./db');

const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

// ====================== BASIC SEND FUNCTIONS ======================
async function sendTextMessage(to, text) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    }, { headers: { Authorization: `Bearer ${TOKEN}` } });
  } catch (e) {
    console.error('Text send error:', e.message);
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
    console.error('Image send error:', e.message);
  }
}

async function sendSizeButtons(to) {
  // Implementation same as before (S,M,L then XL,XXL)
  // ... (keep the same code I gave in previous services.js for sendSizeButtons)
}

// ====================== CUSTOMER HELPERS ======================
async function getOrCreateCustomer(phone) {
  let customer = await Customer.findOne({ phone });
  if (!customer) {
    customer = new Customer({ phone, totalVisits: 1 });
    await customer.save();
  } else {
    await Customer.updateOne({ phone }, { $inc: { totalVisits: 1 }, lastMessageAt: new Date() });
  }
  return customer;
}

async function updateCustomer(phone, updateData) {
  await Customer.updateOne({ phone }, { $set: updateData });
}

// ====================== AI + BUSINESS LOGIC ======================
async function getGroqReply(history, systemPrompt) {
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history
      ],
      max_tokens: 600,
      temperature: 0.6
    }, {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Groq Error:', error.message);
    return "Sorry, I'm having trouble right now. Can you please repeat?";
  }
}

// Strong System Prompt (This is the heart of AI Assistant)
const SYSTEM_PROMPT = `You are Niya, a friendly and professional sales assistant at Ashirwad Shop.
You sell high quality cotton T-Shirts.

Rules:
- Always be polite, short and clear.
- Use simple English.
- Ask only one question at a time.
- Never reveal you are AI.
- Focus on completing the sale step by step.
- Use emojis naturally but not too many.`;

module.exports = {
  sendTextMessage,
  sendImageMessage,
  sendSizeButtons,
  getOrCreateCustomer,
  updateCustomer,
  getGroqReply,
  SYSTEM_PROMPT,
  calculateTotals: (cart) => {
    let total = cart.reduce((sum, item) => sum + (item.totalPrice || item.pricePerItem * item.quantity), 0);
    let discount = 0;
    if (cart.length === 2) discount = total * 0.10;
    if (cart.length >= 3) discount = total * 0.20;
    const afterDiscount = total - discount;
    const shipping = afterDiscount >= 999 ? 0 : 99;
    return { total, discount, afterDiscount, shipping, grandTotal: afterDiscount + shipping };
  }
};
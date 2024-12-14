const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config(); // Load environment variables from .env
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');  // Import Supabase client

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;  // Get Supabase URL from .env
const supabaseKey = process.env.SUPABASE_KEY;  // Get Supabase key from .env
const supabase = createClient(supabaseUrl, supabaseKey);  // Create Supabase client

// LINE API Configuration
const LINE_API_URL = 'https://api.line.me/v2/bot/message/reply';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN; // Use the token from .env

const app = express();
app.use(bodyParser.json());

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    // ตรวจสอบว่าเป็น event ของ postback เมื่อผู้ใช้กด Rich Menu
    if (event.type === 'postback') {
      const lineUserId = event.source.userId;
      const replyToken = event.replyToken;  // replyToken ที่ใช้ในการส่งข้อความกลับไปยังผู้ใช้
      console.log(`User ID: ${lineUserId}`);

      try {
        // ตรวจสอบข้อมูล user ใน Supabase
        const { data: user, error } = await supabase
          .from('items')  // ตาราง items ใน Supabase
          .select('userId, name, description, active')  // เลือกข้อมูลที่ต้องการ
          .eq('userId', lineUserId)  // ตรวจสอบว่า userId ตรงกับในฐานข้อมูล
          .eq('active', true)  // ตรวจสอบว่า active = true
          .single();  // คาดว่าจะได้ผลลัพธ์แค่ 1 แถว

        if (error || !user) {
          console.log(`User ${lineUserId} not found`);
          await sendLineMessage(replyToken, 'You are not registered. Please register first.');
          return res.status(400).send('User not found');
        }

        // หากเจอผู้ใช้ ส่งข้อความต้อนรับ
        console.log(`User ${lineUserId} found`);
        const welcomeMessage = user.name
          ? `Hello, ${user.name}, welcome back!`  // หากมีชื่อผู้ใช้
          : 'Hello, welcome back!';

        // ส่งข้อความกลับไปยังผู้ใช้
        await sendLineMessage(replyToken, welcomeMessage);

        return res.status(200).send('OK');
      } catch (err) {
        console.error('Error checking user in Supabase:', err);
        return res.status(500).send('Internal Server Error');
      }
    }
  }

  res.status(200).send('OK');
});

// Function to send a message to LINE (reply message)
async function sendLineMessage(replyToken, message) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
  };

  const data = {
    replyToken: replyToken,  // ใช้ replyToken ที่ได้รับจาก postback event
    messages: [
      {
        type: 'text',
        text: message,  // ข้อความที่ต้องการส่ง
      },
    ],
  };

  console.log('Sending message:', message);  // แสดงข้อความที่ส่ง

  try {
    const response = await axios.post(LINE_API_URL, data, { headers });
    console.log('Message sent successfully:', response.data); // แสดงผลลัพธ์การส่งข้อความ
  } catch (error) {
    console.error('Error sending message to LINE:', error.response || error);  // เพิ่มการตรวจสอบ error
  }
}

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

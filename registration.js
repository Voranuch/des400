const express = require('express');
const app = express();
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

// Initial Supabase setup
const supabase = createClient(
  'https://leogemntailcnoftfwhk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb2dlbW50YWlsY25vZnRmd2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0Nzk5OTIsImV4cCI6MjA0NTA1NTk5Mn0.-d-5CDH_pJvQD0yxaDBfzPTL5_OfOPF2BCBSuBZlNUw'
);

// Initial Line bot setup
const config = {
  channelAccessToken:
    'P+E8eZRcSNbBoEPGYjBmJExtFjWT3j4o5rF1/7SbnorFSc60fJzKYl9IKmn96qgQ7ry0PFWlaqkZl5O7Zoc9/VGIlC5BcCik0ITxv3SJFuMHSWbk6m+CUwKMPFaJgvTMUrS4s/Ijt7M/OWELImmSawdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'd07b7aebd4b6aae0d3c9f5040f792a5f',
};

const client = new line.Client(config);

// Middleware to parse JSON requests
app.use(express.json());

// Temporary in-memory storage (You can replace this with a more permanent storage like a database)
const userSession = {};

// Webhook handler function (receive webhook from Line)
async function webhookHandler(req, res) {
  const events = req.body.events;

  if (!events) {
    return res.status(400).send('Invalid request');
  }

  for (let event of events) {
    const userId = event.source.userId;
    const message = event.message.text; // The message the user sent

    // Check if the user is in the middle of an ongoing session
    if (userSession[userId]) {
      if (userSession[userId].step === 'regist') {
        // Store the name
        userSession[userId].name = message.trim();
        userSession[userId].step = 'stuid'; // Ask for student ID next
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'Please enter your student id',
        });
      } else if (userSession[userId].step === 'stuid') {
        // Store the student ID and insert the data
        const stuid = parseInt(message.trim());
        if (!isNaN(stuid)) {
          const { data, error } = await supabase
            .from('items')
            .insert([
              {
                name: userSession[userId].name,
                stuid: stuid,
                userid: userId, // Store the user's ID
              },
            ])
            .single();

          if (error) {
            console.log('Error inserting data:', error);
            return res.status(500).send('Error inserting data.');
          }

          // Respond with confirmation
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `ข้อมูลของคุณได้ถูกบันทึกแล้ว: ${userSession[userId].name} และ ${stuid}`,
          });

          // Clear session after successful insertion
          delete userSession[userId];
        } else {
          // Ask for a valid student ID
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'กรุณากรอก stuid ที่ถูกต้อง',
          });
        }
      }
    } else {
      // Initial step: Ask for name
      if (message.toLowerCase() === 'regist') {
        userSession[userId] = { step: 'regist' }; // Start the session
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'Please enter your name',
        });
      } else {
        // Invalid input, ask for name again
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'กรุณาพิมพ์ "regist" เพื่อเริ่มต้น',
        });
      }
    }
  }

  res.status(200).send('OK');
}

// Set webhook route
app.post('/webhook', webhookHandler);

// Set port to 3000 by default or use the PORT environment variable if available
const port = process.env.PORT || 3000;

// Start Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

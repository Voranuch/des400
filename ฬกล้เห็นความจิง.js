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
  channelAccessToken: 'WlofTzTu12bMnEfYvxA7ALuCiNgYljHSygI5XgBcWtu2uhwkbJ1PX1bHp7RLvn7353Y2PTupKFETNSOinLVH71ipyYpguLo7GdtIbPY1/RsmaEFsS85uFBnmn2lFKFwHxv7X+iEocDsKB3SWcABY4AdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'd07b7aebd4b6aae0d3c9f5040f792a5f',
};

const client = new line.Client(config);

// Middleware to parse JSON requests
app.use(express.json());

// Temporary in-memory storage for registration flow
const userSession = {};

async function webhookHandler(req, res) {
  const events = req.body.events;

  if (!events) {
    return res.status(400).send('Invalid request');
  }

  for (let event of events) {
    if (event.type !== 'message' || !event.message.text) {
      continue;
    }

    const userId = event.source.userId;
    const message = event.message.text.trim();

    if (message === 'Check-in') {
      // Check-in process
      const { data: userData, error: userError } = await supabase
        .from('items')
        .select('userid, name, checkin')
        .eq('userid', userId)


      if (userError || !userData) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'User not found. Please register first.',
        });
        continue;
      }

      if (userData.checkin) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `Hello, ${userData.name}. You are already checked in!`,
        });
      } else {
        const { error: checkinError } = await supabase
          .from('items')
          .update({ checkin: true })
          .eq('userid', userId);

        if (checkinError) {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Failed to check-in. Please try again.',
          });
        } else {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `You have successfully checked in!`,
          });
        }
      }
    } else if (message === 'Registration') {
      // Registration initiation
      if (!userSession[userId]) {
        userSession[userId] = { step: 'Registration' }; // Start the registration session
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'Please enter your name',
        });
      }
    } else if (userSession[userId]) {
      // Continue registration process
      if (userSession[userId].step === 'Registration') {
        userSession[userId].name = message.trim(); // Save the name
        userSession[userId].step = 'stuid';
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'Please enter your student ID.',
        });
      } else if (userSession[userId].step === 'stuid') {
        const stuid = parseInt(message.trim());
        if (!isNaN(stuid)) {
          const { data, error } = await supabase
            .from('items')
            .insert([
              {
                name: userSession[userId].name,
                stuid: stuid,
                userid: userId,
                checkin: false, // Default check-in status
              },
            ]);

          if (error) {
            console.error('Insert Error:', error);
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'Failed to register. Please try again.',
            });
          } else {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `Registration complete! Name: ${userSession[userId].name}, Student ID: ${stuid}`,
            });
            delete userSession[userId]; // Clear session after successful registration
          }
        } else {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Invalid student ID. Please enter a numeric value.',
          });
        }
      }
    } else {
      // Unrecognized message
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'Unrecognized command. Please type "Check-in" or "Registration".',
      });
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

const client = new line.Client(config);

// Middleware to parse JSON requests
app.use(express.json());

// Temporary in-memory storage (You can replace this with a more permanent storage like a database)
const userSession = {};

async function webhookHandler(req, res) {
  const events = req.body.events;

  if (!events) {
    return res.status(400).send('Invalid request');
  }

  for (let event of events) {
    const userId = event.source.userId;
    const message = event.message.text; // The message the user sent

    // First, check if the user is already registered
    const { data: existingUser, error: fetchError } = await supabase
      .from('items')
      .select('userid')
      .like('userid', userId); // Check if the userid exists in the 'items' table

    console.log("UserId received:", userId);  // แสดงค่า userId ที่ได้รับจาก Line
    console.log("Fetched user data:", existingUser);  // แสดงข้อมูลที่ดึงมาจาก Supabase

    if (fetchError) {
      console.log('Error fetching user data:', fetchError);
      return res.status(500).send('Error checking existing data.');
    }

    // If user already exists in the 'items' table (even in multiple entries), stop the registration process
    if (existingUser && existingUser.length > 0) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'คุณเคยลงทะเบียนไปแล้ว',
      });
      return res.status(200).send('OK'); // Exit early if user already exists
    }

    // Handle postback events (from Rich Menu actions)
    if (event.type === 'postback') {
      const postbackData = event.postback.data;

      // Action A: Already exists and does check-in (from previous logic, not modified here)
      if (postbackData === 'action=A') {
        const { data: userData, error: userError } = await supabase
          .from('items')
          .select('userid, name, checkin')
          .eq('userid', userId)
          .single();

        if (userError || !userData) {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'User not found.',
          });
          return res.status(400).send('User not found');
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
              text: 'Failed to check-in.',
            });
            return res.status(500).send('Failed to check-in.');
          }

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `Hello, ${userData.name}. You have successfully checked in!`,
          });
        }
      }

      // Action B: Registration Process
      else if (postbackData === 'action=B') {
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

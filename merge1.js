const app = express();
app.use(bodyParser.json());

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  const events = req.body.events;
  console.log('Received Events:', JSON.stringify(events, null, 2)); // ตรวจสอบ event ที่ได้รับ

  for (const event of events) {
    console.log('Event Type:', event.type); // แสดงประเภทของ event

    if (event.type === 'message') {
      const lineUserId = event.source.userId;
      const replyToken = event.replyToken;

      try {
        // ตรวจสอบข้อมูล user ใน Supabase
        const { data: users, error } = await supabase
          .from('items')
          .select('userid, name, description, active, checkin')
          .eq('userid', lineUserId)  // ตรวจสอบว่า userId ตรงกับในฐานข้อมูล
          .eq('active', true);  // ตรวจสอบว่า active = true

        if (error || !users || users.length === 0) {
          await sendLineMessage(replyToken, 'You are not registered. Please register first.');
          return res.status(400).send('User not found');
        }

        // กรณีที่เป็นข้อความ check-in
        if (event.message.text === 'check-in') {
          const user = users[0];
          const welcomeMessage = user.name
            ? `Hello, ${user.name}! You are already checked-in!`
            : 'You are already checked-in!';

          await sendLineMessage(replyToken, welcomeMessage);

          if (!user.checkin) {
            // อัปเดตคอลัมน์ checkin ให้เป็น true
            const { data, error: updateError } = await supabase
              .from('items')
              .update({ checkin: true })
              .eq('userid', lineUserId);

            if (updateError) {
              console.log('Error updating checkin:', updateError);
              return res.status(500).send('Error updating checkin status');
            }
            console.log(`User ${lineUserId} check-in status updated to true`);
          }
        }

        // กรณีที่เป็นข้อความ registration
        if (event.message.text === 'registration') {
          await sendLineMessage(replyToken, 'Please proceed to register.');
        }

        return res.status(200).send('OK');
      } catch (err) {
        console.error('Error checking user in Supabase:', err);
        return res.status(500).send('Internal Server Error');
      }
    }

    // กรณีที่เป็น postback
    if (event.type === 'postback') {
      const lineUserId = event.source.userId;
      const replyToken = event.replyToken;
      const postbackData = event.postback.data; // ค่าที่ส่งมาจาก postback

      console.log('Postback Data:', postbackData);

      try {
        // ตรวจสอบข้อมูล user ใน Supabase
        const { data: users, error } = await supabase
          .from('items')
          .select('userid, name, description, active, checkin')
          .eq('userid', lineUserId)  // ตรวจสอบว่า userId ตรงกับในฐานข้อมูล
          .eq('active', true);  // ตรวจสอบว่า active = true

        if (error || !users || users.length === 0) {
          await sendLineMessage(replyToken, 'You are not registered. Please register first.');
          return res.status(400).send('User not found');
        }

        const user = users[0];

        if (postbackData === 'action=A') {
          // Action A: check-in
          const welcomeMessage = user.name
            ? `Hello, ${user.name}! You are already checked-in!`
            : 'You are already checked-in!';
          await sendLineMessage(replyToken, welcomeMessage);

          if (!user.checkin) {
            const { data, error: updateError } = await supabase
              .from('items')
              .update({ checkin: true })
              .eq('userid', lineUserId);

            if (updateError) {
              console.log('Error updating checkin:', updateError);
              return res.status(500).send('Error updating checkin status');
            }

            console.log(`User ${lineUserId} check-in status updated to true`);
          }
        } else if (postbackData === 'action=B') {
          // Action B: registration
          await sendLineMessage(replyToken, 'Please proceed to register.');
        }

        return res.status(200).send('OK');
      } catch (err) {
        console.error('Error processing postback:', err);
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

  try {
    const response = await axios.post(LINE_API_URL, data, { headers });
    console.log('Message sent successfully:', response.data); // แสดงผลลัพธ์การส่งข้อความ
  } catch (error) {
    console.error('Error sending message to LINE:', error.response || error);
  }
}

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

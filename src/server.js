const express = require('express');
const app = express();

// endpoint / ให้ ping ได้
app.get('/', (req, res) => res.send('Bot is running!'));

// เริ่ม server ให้ listen port
app.listen(process.env.PORT || 3000, () => console.log('Server running'));

// export app เผื่อจะ import ใช้ต่อ (optional)
module.exports = app;

// api/index.js
const express = require('express');
const app = express();

// ตัวอย่าง route
app.get('/', (req, res) => {
    res.send('✅ Hello from Vercel!');
});

app.get('/test', (req, res) => {
    res.json({ message: "It works!" });
});

// ส่งออก app ให้ Vercel ใช้งาน
module.exports = app;
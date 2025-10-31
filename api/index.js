// api/index.js
const express = require('express');
const app = express();

// ตัวอย่าง route
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/test', (req, res) => {
    res.send('✅ Hello from test!');
});

// ส่งออก app ให้ Vercel ใช้งาน
module.exports = app;
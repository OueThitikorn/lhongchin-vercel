// api/index.js
const express = require('express');
const router = express.Router();

// ตัวอย่าง route
router.get('/', (req, res) => {
    res.render('index');
});

router.get('/test', (req, res) => {
    res.send('✅ Hello from test!');
});

// ส่งออก app ให้ Vercel ใช้งาน
module.exports = app;
const express = require('express');
const app = express();
const path = require('path');

// ตั้งค่า view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // โฟลเดอร์ views ต้องมีไฟล์ index.ejs

app.get('/', (req, res) => {
    res.render('index'); // จะหาไฟล์ views/index.ejs
});


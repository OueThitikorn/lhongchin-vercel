const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const path = require('path');

const ifNotLoggedIn = (req, res, next) => {
  if (!req.session?.isLoggedIn) {
    return res.redirect('/auth/login');
  }
  next();
};


const storage = multer.diskStorage({
  destination: (req, file, cd) => {
    cd(null, 'public/uploads/');
  },
  filename: (req, file, cd) => {
    cd(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// ------------------------------------------------------------------------------------------------


router.get('/', async (req, res) => {
  try {
    const [tours] = await db.query(`
            SELECT 
                t.tour_id,
                t.image, 
                t.tour_name,
                t.price,
                t.description,
                t.country,
                t.start_date,
                t.end_date,
                t.seats_booked,
                t.seat, 
                CONCAT(g.first_name, ' ', g.last_name) AS guide_name,
                DATEDIFF(t.end_date, t.start_date) + 1 AS duration
            FROM tours t
            LEFT JOIN guides g ON t.guide_id = g.guide_id
        `);

    res.render('index', {
      tours: tours,
      isLoggedIn: req.session?.isLoggedIn || false
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});

// ------------------------------------------------------------------------------------------------


router.get('/contact', async (req, res) => {
  try {
    res.render('contact', {
      isLoggedIn: req.session?.isLoggedIn || false
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
});


// ------------------------------------------------------------------------------------------------


router.get('/tourprogram', ifNotLoggedIn, async (req, res) => {
  try {
    const [tours] = await db.query(`
            SELECT 
                t.tour_id,
                t.image, 
                t.tour_name,
                t.price,
                t.description,
                t.country,
                t.start_date,
                t.end_date,
                t.seats_booked,
                t.seat, 
                CONCAT(g.first_name, ' ', g.last_name) AS guide_name,
                DATEDIFF(t.end_date, t.start_date) + 1 AS duration
            FROM tours t
            LEFT JOIN guides g ON t.guide_id = g.guide_id
        `);

    const toursWithDuration = tours.map(tour => {
      let duration = tour.duration;
      if (!duration && tour.start_date && tour.end_date) {
        const start = new Date(tour.start_date);
        const end = new Date(tour.end_date);
        duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      }
      return { ...tour, duration: duration || 0 };
    });

    res.render('tourprogram', {
      tours: toursWithDuration,
      isLoggedIn: req.session?.isLoggedIn || false
    });

  } catch (err) {
    console.error('Error', err);
    res.status(500).send('เกิดข้อผิดพลาด: ' + err.message);
  }
});


router.get('/tourprogram/bookTour/:tour_id', ifNotLoggedIn, async (req, res) => {
  try {
    const [resultTour] = await db.query("SELECT * FROM tours WHERE tour_id = ?", [req.params.tour_id]);
    const [resultUser] = await db.query("SELECT * FROM users WHERE user_id = ?", [req.session.user_id]);

    res.render('bookTour', {
      tour: resultTour[0],
      user: resultUser[0],
      isLoggedIn: req.session?.isLoggedIn || false
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาด' + err.message);
  }
});

// Create booktour
router.post('/tourprogram/bookTour/:tour_id', async (req, res) => {
  const tour_id = req.params.tour_id;
  const { user_name, user_phone, user_email, seats_booked } = req.body;
  const seats = parseInt(seats_booked, 10);

  try {
    // ตรวจสอบผู้ใช้
    const [users] = await db.query('SELECT user_id FROM users WHERE email = ?', [user_email]);
    if (!users || users.length === 0) {
      return res.status(400).send("ไม่พบข้อมูลผู้ใช้งาน");
    }
    const user_id = users[0].user_id;

    // ดึงข้อมูลทัวร์
    const [tours] = await db.query('SELECT price, tour_name, seats_booked, seat FROM tours WHERE tour_id = ?', [tour_id]);
    if (!tours || tours.length === 0) {
      return res.status(400).send("ไม่พบข้อมูลทัวร์");
    }
    const tour = tours[0];

    // ตรวจสอบจำนวนที่นั่ง
    if (tour.seats_booked + seats > tour.seat) {
      return res.status(400).send("จำนวนที่นั่งไม่พอสำหรับการจองนี้");
    }

    const total_price = tour.price * seats;

    // วันที่จองแบบสั้น ไทย
    const now = new Date();
    const booking_date = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

    // บันทึกการจอง
    await db.query(`
      INSERT INTO bookings 
        (booking_date, booking_status, checkin_status, total_people, total_price, user_id, tour_id)
      VALUES (?, 'ยังไม่ชำระเงิน', 'รอเช็คอิน', ?, ?, ?, ?)
    `, [booking_date, seats, total_price, user_id, tour_id]);

    // อัปเดตจำนวนที่นั่งในทัวร์
    await db.query('UPDATE tours SET seats_booked = seats_booked + ? WHERE tour_id = ?', [seats, tour_id]);

    res.redirect('/tourprogram');
  } catch (err) {
    console.error(err);
    res.status(500).send("ไม่สามารถบันทึกการจองได้");
  }
});




// ------------------------------------------------------------------------------------------------


router.get('/reserve', ifNotLoggedIn, async (req, res) => {
  try {
    const user_id = req.session.user_id;

    if (!user_id) {
      return res.redirect('/login');
    }

    const sql = `
      SELECT 
        b.booking_id,
        b.booking_date,
        b.booking_status,
        b.checkin_status,
        b.total_people,
        b.total_price,
        t.tour_name,
        t.start_date,
        t.end_date,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name
      FROM bookings b
      JOIN tours t ON b.tour_id = t.tour_id
      JOIN users u ON b.user_id = u.user_id
      WHERE b.user_id = ?
      ORDER BY b.booking_date DESC
    `;

    const [bookings] = await db.execute(sql, [user_id]);

    res.render('reserve', {
      bookings,
      isLoggedIn: req.session?.isLoggedIn || false
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดขณะโหลดข้อมูลการจอง');
  }
});


router.get('/reserve/delete/:booking_id', ifNotLoggedIn, async (req, res) => {
  const booking_id = req.params.booking_id;

  try {
    const [bookingRows] = await db.query("SELECT tour_id, total_people FROM bookings WHERE booking_id = ?", [booking_id]);

    if (!bookingRows.length) {
      return res.status(404).send("ไม่พบการจองนี้");
    }

    const booking = bookingRows[0];

    await db.query("UPDATE tours SET seats_booked = seats_booked - ? WHERE tour_id = ?", [
      booking.total_people,
      booking.tour_id
    ]);

    await db.query("DELETE FROM bookings WHERE booking_id = ?", [booking_id]);

    res.redirect('/reserve');

  } catch (err) {
    console.error("Delete Booking Error:", err.message, err.stack);
    res.status(500).send("ไม่สามารถลบการจองได้");
  }
});


// ------------------------------------------------------------------------------------------------


router.get('/payment/:booking_id', ifNotLoggedIn, async (req, res) => {
  const { booking_id } = req.params;

  // ตรวจสอบว่า booking_id เป็นตัวเลข
  if (isNaN(booking_id)) {
    return res.status(400).send('รหัสการจองไม่ถูกต้อง');
  }

  try {
    const sql = `
      SELECT 
        b.booking_id, 
        b.booking_date, 
        b.total_price, 
        b.total_people, 
        b.booking_status,
        b.slip_path,
        t.tour_name,
        t.start_date,
        t.end_date,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name
      FROM bookings b
      JOIN tours t ON b.tour_id = t.tour_id
      JOIN users u ON b.user_id = u.user_id
      WHERE b.booking_id = ?
    `;

    const [rows] = await db.execute(sql, [booking_id]);

    if (!rows || rows.length === 0) {
      return res.status(404).send('ไม่พบการจองนี้');
    }

    const booking = rows[0];

    res.render('payment', {
      booking,
      isLoggedIn: req.session?.isLoggedIn || false,
      name: req.session?.name || booking.user_name,
      role: req.session?.role || ''
    });

  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).send('เกิดข้อผิดพลาดขณะโหลดข้อมูลการจอง');
  }
});

router.post('/payment/:booking_id', upload.single('slip'), async (req, res) => {
  const booking_id = req.params.booking_id;
  const slip = req.file ? req.file.filename : null;

  if (!slip) {
    return res.status(400).send('กรุณาอัปโหลดสลิปการชำระเงิน');
  }

  const now = new Date();
  const payment_date = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const payment_time = now.toLocaleTimeString('sv-SE', {
    timeZone: 'Asia/Bangkok',
    hour12: false
  });

  const sql = `
    UPDATE bookings 
    SET slip_path = ?, booking_status = 'รอยืนยันการชำระเงิน', payment_date = ?, payment_time = ? 
    WHERE booking_id = ?
  `;

  try {
    await db.query(sql, [slip, payment_date, payment_time, booking_id]);
    res.redirect('/reserve');
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในการอัปโหลดสลิป");
  }
});

module.exports = router;

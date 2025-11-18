const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const bcrypt = require('bcrypt');
const { time } = require('console');

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

// เช็คว่า login admin รึยัง
const ifNotAdmin = (req, res, next) => {
    if (!req.session?.isLoggedIn) {
        return res.redirect('/auth/login');
    }

    if (req.session.role !== 'ผู้ดูแลระบบ') {
        return res.render('errorPrivate');
    }
    next();
};

// เช็คว่า login  admin กับ พนักงาน รึยัง
const ifNotEmployeeOrAdmin = (req, res, next) => {
    if (!req.session?.isLoggedIn) {
        return res.redirect('/auth/login');
    }
    if (req.session.role !== 'พนักงาน' && req.session.role !== 'ผู้ดูแลระบบ') {
        return res.render('errorPrivate');
    }
    next();
};

// ------------------------------------------------------------------------------------------------



router.get('/', ifNotEmployeeOrAdmin, async (req, res) => {
    try {
        res.render('adminSystem/admin', {
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาด');
    }
});

// ------------------------------------------------------------------------------------------------



// Manage Tour
router.get('/manageTour', ifNotEmployeeOrAdmin, async (req, res) => {
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

        res.render('adminSystem/manageTour', {
            tours: toursWithDuration,
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error('Error in /manageTour:', err);
        res.status(500).send('เกิดข้อผิดพลาด: ' + err.message);
    }
});

// Create Tour Page
router.get('/manageTour/create', ifNotEmployeeOrAdmin, async (req, res) => {
    try {
        const [guides] = await db.query("SELECT guide_id, first_name, last_name FROM guides");
        res.render('adminSystem/createTour', {
            isLoggedIn: req.session?.isLoggedIn || false,
            guides
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาด');
    }
});

// Create Tour
router.post('/manageTour/create', upload.single('image'), async (req, res) => {
    const { tour_name, price, description, country, start_date, end_date, seat, guide } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = `
        INSERT INTO tours 
        (tour_name, price, description, country, start_date, end_date, seat, image, guide_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        await db.query(sql, [tour_name, price, description, country, start_date, end_date, seat, image, guide]);
        res.redirect('/admin/manageTour');
    } catch (err) {
        console.error(err);
        res.status(500).send("เกิดข้อผิดพลาดในการสร้างทัวร์");
    }
});

// Edit Tour Page
router.get('/manageTour/edit/:tour_id', ifNotEmployeeOrAdmin, async (req, res) => {
    try {
        const [tourResult] = await db.query("SELECT * FROM tours WHERE tour_id = ?", [req.params.tour_id]);
        if (!tourResult.length) return res.status(404).send("Tour not found");

        const [guides] = await db.query("SELECT guide_id, first_name, last_name FROM guides");

        res.render('adminSystem/editTour', {
            tour: tourResult[0],
            guides,
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาด');
    }
});

// Edit Tour
router.post('/manageTour/edit/:tour_id', upload.single('image'), async (req, res) => {
    const { tour_name, price, description, country, start_date, end_date, seat, guide } = req.body;
    const image = req.file ? req.file.filename : req.body.oldImage;

    const sql = `
        UPDATE tours 
        SET tour_name = ?, price = ?, description = ?, country = ?, 
            start_date = ?, end_date = ?, seat = ?, image = ?, guide_id = ?
        WHERE tour_id = ?
    `;
    try {
        await db.query(sql, [tour_name, price, description, country, start_date, end_date, seat, image, guide, req.params.tour_id]);
        res.redirect('/admin/manageTour');
    } catch (err) {
        console.error(err);
        res.status(500).send("เกิดข้อผิดพลาดในการแก้ไขทัวร์");
    }
});


// Delete tour
router.get('/manageTour/delete/:tour_id', ifNotEmployeeOrAdmin, async (req, res) => {
    try {
        await db.query("DELETE FROM tours WHERE tour_id = ?", [req.params.tour_id]);
        res.redirect('/admin/manageTour');
    } catch (err) {
        console.error(err);
        res.status(500).send("Delete failed");
    }
});

// ------------------------------------------------------------------------------------------------



router.get('/manageUser', ifNotAdmin, async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM users");
        res.render('adminSystem/manageUser', {
            users: results,
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาด');
    }
});

// Edit page user
router.get('/manageUser/edit/:user_id', ifNotAdmin, async (req, res) => {
    try {
        const [result] = await db.query("SELECT * FROM users WHERE user_id = ?", [req.params.user_id]);
        if (!result.length) return res.status(404).send("User not found");

        res.render('adminSystem/editUser', {
            user: result[0],
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาด');
    }
});

// Edit user
router.post('/manageUser/edit/:user_id', upload.single('image'), async (req, res) => {
    const { firstname, lastname, email, phone, role, password } = req.body;

    try {
        // สร้าง SQL และพารามิเตอร์พื้นฐาน
        let sql = `
      UPDATE users 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?
    `;
        const params = [firstname, lastname, email, phone, role];

        // ถ้ามีการกรอกรหัสผ่านใหม่
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            sql += `, password = ?`;
            params.push(hashedPassword);
        }

        sql += ` WHERE user_id = ?`;
        params.push(req.params.user_id);

        await db.query(sql, params);

        res.redirect('/admin/manageUser');
    } catch (err) {
        console.error(err);
        res.status(500).send("Update failed");
    }
});


// Delete user
router.get('/manageUser/delete/:user_id', ifNotAdmin, async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE user_id = ?", [req.params.user_id]);
        res.redirect('/admin/manageUser');
    } catch (err) {
        console.error(err);
        res.status(500).send("Delete failed");
    }
});

// ------------------------------------------------------------------------------------------------
// manageGuide


router.get('/manageGuide', ifNotAdmin, async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM guides");
        res.render('adminSystem/manageGuide', {
            guide: results,
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาด');
    }
});

// Edit manageGuide
router.get('/manageGuide/edit/:guide_id', ifNotAdmin, async (req, res) => {
    try {
        const [result] = await db.query("SELECT * FROM guides WHERE guide_id = ?", [req.params.guide_id]);
        if (!result.length) return res.status(404).send("guide not found");

        res.render('adminSystem/manageGuide', {
            guide: result[0],
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาด');
    }
});

// Create new guide
router.post('/manageGuide/create', upload.single('image'), async (req, res) => {
    const { firstname, lastname, email, phone, gender } = req.body;

    try {
        const sql = `
            INSERT INTO guides (first_name, last_name, email, phone, gender)
            VALUES (?, ?, ?, ?, ?)
        `;
        const params = [firstname, lastname, email, phone, gender];

        await db.query(sql, params);

        res.redirect('/admin/manageGuide');
    } catch (err) {
        console.error(err);
        res.status(500).send("Create failed");
    }
});


// Edit manageGuide
router.post('/manageGuide/edit/:guide_id', upload.single('image'), async (req, res) => {
    const { firstname, lastname, email, phone, gender } = req.body;

    try {
        // สร้าง SQL และพารามิเตอร์พื้นฐาน
        let sql = `
      UPDATE guides 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, gender = ?
    `;
        const params = [firstname, lastname, email, phone, gender];

        sql += ` WHERE guide_id = ?`;
        params.push(req.params.guide_id);

        await db.query(sql, params);

        res.redirect('/admin/manageGuide');
    } catch (err) {
        console.error(err);
        res.status(500).send("Update failed");
    }
});


// Delete manageGuide
router.get('/manageGuide/delete/:guide_id', ifNotAdmin, async (req, res) => {
    try {
        await db.query("DELETE FROM guides WHERE guide_id = ?", [req.params.guide_id]);
        res.redirect('/admin/manageGuide');
    } catch (err) {
        console.error(err);
        res.status(500).send("Delete failed");
    }
});
// ------------------------------------------------------------------------------------------------

router.get('/manageReserve', ifNotEmployeeOrAdmin, async (req, res) => {
    try {
        const sql = `
      SELECT 
        b.booking_id,
        b.booking_date,
        b.payment_date,
        b.checkin_date,
        b.payment_time,
        b.booking_status,
        b.checkin_status,
        b.total_people,
        b.total_price,
        t.tour_name,
        t.start_date,
        t.end_date,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.email,
        u.phone
    FROM bookings b
    JOIN tours t ON b.tour_id = t.tour_id
    JOIN users u ON b.user_id = u.user_id
    ORDER BY b.booking_date DESC;
    `;

        const [results] = await db.execute(sql);

        res.render('adminSystem/manageReserve', {
            bookings: results,
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลการจอง');
    }
});


router.get('/manageReserve/delete/:booking_id', ifNotAdmin, async (req, res) => {
    const booking_id = req.params.booking_id;

    try {
        // ดึงข้อมูล booking ก่อน
        const [bookingRows] = await db.query(
            "SELECT tour_id, total_people FROM bookings WHERE booking_id = ?",
            [booking_id]
        );

        if (!bookingRows.length) {
            return res.status(404).send("ไม่พบการจองนี้");
        }

        const booking = bookingRows[0];

        // ลดจำนวนที่นั่งใน tourprogram
        await db.query(
            "UPDATE tours SET seats_booked = seats_booked - ? WHERE tour_id = ?",
            [booking.total_people, booking.tour_id]
        );

        // ลบ booking
        await db.query(
            "DELETE FROM bookings WHERE booking_id = ?",
            [booking_id]
        );

        // redirect กลับหน้า manageReserve
        res.redirect('/admin/manageReserve');

    } catch (err) {
        console.error("Delete Booking Error:", err.message, err.stack);
        res.status(500).send("ไม่สามารถลบการจองได้");
    }
});


// ------------------------------------------------------------------------------------------------

router.get('/paymentVerify', ifNotEmployeeOrAdmin, async (req, res) => {
    try {
        const sql = `
      SELECT 
        b.booking_id,
        b.booking_date,
        b.booking_status,
        b.checkin_status,
        b.total_people,
        b.total_price,
        b.slip_path,
        t.tour_name,
        t.start_date,
        t.end_date,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.email,
        u.phone
    FROM bookings b
    JOIN tours t ON b.tour_id = t.tour_id
    JOIN users u ON b.user_id = u.user_id
    WHERE b.booking_status = 'รอยืนยันการชำระเงิน'
    ORDER BY b.booking_date DESC;
    `;

        const [results] = await db.execute(sql);

        res.render('adminSystem/paymentVerify', {
            booking: results,
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error('Error', err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลการจอง');
    }
});


router.post('/paymentVerify/update/:booking_id', async (req, res) => {
    const booking_id = req.params.booking_id;
    const { status } = req.body;

    // ตรวจสอบค่าที่ส่งมาว่าถูกต้อง
    const validStatus = ['ชำระเงินแล้ว', 'ชำระเงินไม่สำเร็จ', 'ยังไม่ชำระเงิน'];
    if (!validStatus.includes(status)) {
        return res.status(400).send("Invalid status");
    }

    try {
        const slipPath = status === 'ชำระเงินแล้ว' ? undefined : null;

        await db.query(
            "UPDATE bookings SET booking_status = ?, slip_path = COALESCE(?, slip_path) WHERE booking_id = ?",
            [status, slipPath, booking_id]
        );

        res.redirect('/admin/paymentVerify');
    } catch (err) {
        console.error(err);
        res.status(500).send("เกิดข้อผิดพลาด");
    }
});




// ------------------------------------------------------------------------------------------------

router.get('/checkIn', ifNotEmployeeOrAdmin, async (req, res) => {
    try {
        const sql = `
      SELECT 
        b.booking_id,
        b.booking_date,
        b.payment_date,
        b.payment_time,
        b.booking_status,
        b.checkin_status,
        b.total_people,
        b.total_price,
        b.slip_path,
        t.tour_name,
        t.start_date,
        t.end_date,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.email,
        u.phone
    FROM bookings b
    JOIN tours t ON b.tour_id = t.tour_id
    JOIN users u ON b.user_id = u.user_id
    WHERE b.booking_status = 'ชำระเงินแล้ว'
    ORDER BY b.booking_date DESC;
    `;

        const [results] = await db.execute(sql);

        res.render('adminSystem/checkIn', {
            booking: results,
            isLoggedIn: req.session?.isLoggedIn || false
        });

    } catch (err) {
        console.error('Error', err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลการจอง');
    }
});


router.post('/checkIn/confirm/:booking_id', async (req, res) => {
    const booking_id = req.params.booking_id;
    const checkin_date = new Date();

    if (!booking_id) {
        return res.status(400).send("กรุณาระบุ Booking ID");
    }

    try {
        const [result] = await db.query(
            "UPDATE bookings SET checkin_status = 'เช็คอินแล้ว', checkin_date = ? WHERE booking_id = ?",
            [checkin_date, booking_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).send("ไม่พบการจองนี้");
        }

        res.redirect('/admin/checkIn');
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์", details: err.message });
    }
});





module.exports = router;

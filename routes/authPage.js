const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { body, validationResult } = require('express-validator');

// -----------------------------------------------------------------------------------------------
// 🔒 Middleware ตรวจสอบสถานะการล็อกอิน

// ถ้าล็อกอินแล้ว → ห้ามเข้า login/register
const ifLoggedIn = (req, res, next) => {
    if (req.session.isLoggedIn) {
        if (req.session.role === 'สมาชิก') {
            return res.redirect('/');
        } else if (req.session.role === 'ผู้ดูแลระบบ' || req.session.role === 'พนักงาน') {
            return res.redirect('/admin');
        }
    }
    next();
};

// ถ้ายังไม่ได้ล็อกอิน → ห้ามเข้าเพจที่ต้องล็อกอิน
const ifNotLoggedIn = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/auth/login');
    }
    next();
};

// -----------------------------------------------------------------------------------------------
// 🔑 Login / Register Page

router.get('/login', ifLoggedIn, (req, res) => {
    res.render('authPage/login');
});

router.get('/register', ifLoggedIn, (req, res) => {
    res.render('authPage/register');
});

router.get('/', ifNotLoggedIn, (req, res) => {
    db.execute("SELECT CONCAT(first_name, ' ', last_name) as name FROM users WHERE user_id = ?", [req.session.user_id])
        .then(([rows]) => {
            if (!rows.length) {
                return res.send('ไม่พบข้อมูลผู้ใช้');
            }

            res.render('index', { name: rows[0].name });
        })
        .catch(err => {
            console.error(err);
            res.sendStatus(500);
        });
});

// -----------------------------------------------------------------------------------------------
// 🧾 Register

router.post('/register', ifLoggedIn, [
    body('user_email', 'ที่อยู่อีเมลไม่ถูกต้อง!')
        .isEmail()
        .custom((value) => {
            return db.execute('SELECT email FROM users WHERE email = ?', [value])
                .then(([rows]) => {
                    if (rows.length > 0) {
                        return Promise.reject('อีเมลนี้ถูกใช้แล้ว!');
                    }
                    return true;
                });
        }),
    body('user_fname', 'กรุณากรอกชื่อ').trim().not().isEmpty(),
    body('user_lname', 'กรุณากรอกนามสกุล').trim().not().isEmpty(),
    body('user_phone', 'กรุณากรอกเบอร์โทรศัพท์ของคุณให้ครบ 10 หลัก').trim().isLength({ min: 10 }),
    body('user_pass', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร').trim().isLength({ min: 6 }),
    body('user_cpass').custom((value, { req }) => {
        if (value !== req.body.user_pass) {
            throw new Error('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
        }
        return true;
    })
], async (req, res) => {
    const validation_Result = validationResult(req);
    const { user_fname, user_lname, user_phone, user_dob, user_gender, user_email, user_pass } = req.body;

    if (validation_Result.isEmpty()) {
        try {
            const hash_pass = await bcrypt.hash(user_pass, 12);
            await db.execute(
                'INSERT INTO users (first_name, last_name, phone, dob, gender, email, password, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [user_fname, user_lname, user_phone, user_dob, user_gender, user_email, hash_pass, 'สมาชิก']
            );

            res.render('authPage/register', {
                success_mag: 'บัญชีของคุณถูกสร้างขึ้นเรียบร้อยแล้ว! ตอนนี้คุณสามารถ <a href="/auth/login" class="alert-link" style="font-weight: normal;">เข้าสู่ระบบ</a>',
                register_error: [],
                old_data: {}
            });
        } catch (err) {
            console.error(err);
            res.status(500).send('เกิดข้อผิดพลาดในการสมัครสมาชิก');
        }
    } else {
        const allErrors = validation_Result.errors.map(err => err.msg);
        res.render('authPage/register', {
            register_error: allErrors,
            old_data: req.body
        });
    }
});

// -----------------------------------------------------------------------------------------------
// 🔓 Login

router.post('/login', ifLoggedIn, [
    body('user_email').custom((value) => {
        return db.execute('SELECT email FROM users WHERE email = ?', [value])
            .then(([rows]) => {
                if (rows.length === 1) return true;
                return Promise.reject('ที่อยู่อีเมลไม่ถูกต้อง');
            });
    }),
    body('user_pass', 'กรุณากรอกรหัสผ่าน').trim().not().isEmpty()
], async (req, res) => {
    const validation_Result = validationResult(req);
    const { user_email, user_pass } = req.body;

    if (!validation_Result.isEmpty()) {
        const allErrors = validation_Result.errors.map(err => err.msg);
        return res.render('authPage/login', { login_errors: allErrors });
    }

    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [user_email]);
        if (rows.length === 0) {
            return res.render('authPage/login', { login_errors: ['ไม่พบบัญชีผู้ใช้นี้ในระบบ'] });
        }

        const user = rows[0];
        const match = await bcrypt.compare(user_pass, user.password);

        if (!match) {
            return res.render('authPage/login', { login_errors: ['รหัสผ่านไม่ถูกต้อง'] });
        }

        // ✅ สร้าง session
        req.session.isLoggedIn = true;
        req.session.user_id = user.user_id;
        req.session.role = user.role;

        if (user.role === 'สมาชิก') {
            return res.redirect('/');
        } else if (user.role === 'ผู้ดูแลระบบ' || user.role === 'พนักงาน') {
            return res.redirect('/admin');
        }

    } catch (err) {
        console.error(err);
        res.status(500).send('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    }
});

// -----------------------------------------------------------------------------------------------
// 🚪 Logout

router.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

// -----------------------------------------------------------------------------------------------

module.exports = router;

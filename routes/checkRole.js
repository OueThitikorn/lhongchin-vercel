const db = require('../db');

const checkRole = (...allowedRoles) => {
    return async (req, res, next) => {
        if (!req.session?.isLoggedIn || !req.session?.user_id) {
            return res.redirect('/auth/login');
        }

        try {
            const [userRows] = await db.execute(
                'SELECT role FROM users WHERE user_id = ?',
                [req.session.user_id]
            );

            if (!userRows.length) {
                return res.redirect('/auth/login');
            }

            const userRole = userRows[0].role;
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).render('error', { message: 'คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้' });
            }

            next();
        } catch (err) {
            console.error(err);
            res.status(500).send('เกิดข้อผิดพลาด');
        }
    };
};

module.exports = checkRole;

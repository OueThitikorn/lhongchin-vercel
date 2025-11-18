const db = require('../db');

const getUserData = async (req, res, next) => {
    try {
        res.locals.name = '';
        res.locals.role = '';
        res.locals.isLoggedIn = req.session?.isLoggedIn || false;

        if (req.session?.user_id) {
            const [userRows] = await db.execute(
                'SELECT CONCAT(first_name, " ", last_name) AS name, role FROM users WHERE user_id = ?',
                [req.session.user_id]
            );

            if (userRows.length) {
                res.locals.name = userRows[0].name;

                // แปลง role เป็นภาษาไทย
                if (userRows[0].role === 'ผู้ดูแลระบบ') res.locals.role = 'ผู้ดูแลระบบ';
                else if (userRows[0].role === 'พนักงาน') res.locals.role = 'พนักงาน';
                else res.locals.role = 'สมาชิก';
            }
        }

        next();
    } catch (err) {
        console.error(err);
        next(err);
    }
};

module.exports = getUserData;

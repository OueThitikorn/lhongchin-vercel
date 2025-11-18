const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cookieSession = require('cookie-session');

const app = express();

const indexRouter = require('./routes/index');
const getUserData  = require('./routes/getUserData');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/authPage');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieSession({
    name: 'Session',
    keys: ['key1', 'key2'],
    maxAge: 3600 * 1000
}))

app.use(getUserData);

app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/auth', authRouter);


app.use(function (req, res, next) {
  return res.render('error');
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

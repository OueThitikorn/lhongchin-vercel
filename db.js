const mysql = require('mysql2');

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'tour_lhongchin_db'
}).promise();

module.exports = db;

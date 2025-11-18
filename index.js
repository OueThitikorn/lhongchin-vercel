const express = require('express')
const app = express()
const PORT = 4000

app.listen(PORT, () => {
    console.log(`API Listening...`)
})

app.get('/', (req, res) => {
    res.send('This is my API')
})

app.get('/about', (req, res) => {
    res.send('This is my about')
})

module.exports = app
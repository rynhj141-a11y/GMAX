const express = require('express');
const app = express();
const PORT = 3000;

// This tells our app to allow us to read JSON data
app.use(express.json());

// A basic "Health Check" route
app.get('/', (req, res) => {
    res.send('Gym Management System is Running!');
});

app.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}`);
});
const express = require('express');
const multer = require('multer');
const path = require('path');
const qrcode = require('qrcode');
const db = require('./database'); // Imports our SQLite setup

const app = express();
const PORT = 3000;

// --- MIDDLEWARE ---
app.use(express.json()); // Lets us read JSON data
app.use(express.static('.')); // Serves your index.html
app.use('/uploads', express.static('uploads')); // Makes member photos visible to the browser

// --- STORAGE SETUP (Multer) ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        // Renames file to "timestamp-originalName.jpg" to avoid duplicates
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- ROUTES ---

// 1. Health Check
app.get('/', (req, res) => {
    res.send('GMAX Gym System is Online!');
});

// 2. Add New Member (Includes Photo & QR Generation)
app.post('/add-member', upload.single('photo'), (req, res) => {
    const { name, expiry_date } = req.body;
    const photo_path = req.file ? req.file.path : null;
    
    // Generate a unique ID for the QR code
    const uuid = "GYM-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    // Save to Database
    const sql = `INSERT INTO members (name, expiry_date, uuid, photo_path) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [name, expiry_date, uuid, photo_path], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        // Generate the physical QR Code image
        const qrPath = `./qrcodes/${uuid}.png`;
        qrcode.toFile(qrPath, uuid, (qrErr) => {
            if (qrErr) console.error("QR Generation Error:", qrErr);
            
            console.log(`Successfully registered: ${name}`);
            res.json({ 
                message: "Member Registered Successfully!", 
                memberId: this.lastID,
                uuid: uuid,
                photo: photo_path
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`
    ✅ Server is running!
    🚀 Access Dashboard: http://localhost:${PORT}/index.html
    📂 Photos stored in: /uploads
    `);
});
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
app.post('/verify-member', (req, res) => {
    const { uuid } = req.body; // The scanner will send the UUID it read

    const sql = `SELECT * FROM members WHERE uuid = ?`;

    db.get(sql, [uuid], (err, member) => {
        if (err || !member) {
            return res.status(404).json({ status: "Denied", message: "Member not found" });
        }

        const today = new Date();
        const expiry = new Date(member.expiry_date);

        if (today > expiry) {
            return res.json({ 
                status: "Denied", 
                message: "Membership Expired!",
                name: member.name,
                photo: member.photo_path 
            });
        }

        res.json({ 
            status: "Success", 
            message: "Welcome back!", 
            name: member.name,
            photo: member.photo_path 
        });
    });
});
// 3. Get all members for the Admin List
app.get('/members', (req, res) => {
    const sql = `SELECT * FROM members ORDER BY id DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json(rows);
    });
});
// 4. DELETE a member
app.delete('/members/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM members WHERE id = ?`;

    db.run(sql, id, function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Member deleted successfully" });
    });
});

// 5. UPDATE a member (Extend membership)
app.put('/members/:id', (req, res) => {
    const { id } = req.params;
    const { new_expiry } = req.body;
    const sql = `UPDATE members SET expiry_date = ? WHERE id = ?`;

    db.run(sql, [new_expiry, id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Membership extended!" });
    });
});
// 6. GET a single member's details
app.get('/members/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM members WHERE id = ?`, [id], (err, member) => {
        if (err || !member) return res.status(404).json({ error: "Member not found" });
        res.json(member);
    });
});

app.listen(PORT, () => {
    console.log(`
    ✅ Server is running!
    🚀 Access Dashboard: http://localhost:${PORT}/index.html
    📂 Photos stored in: /uploads
    `);
});
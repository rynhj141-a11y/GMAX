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
    // 1. Get phone from the form (req.body)
    const { name, phone, plan_id } = req.body; 
    const photo_path = req.file ? req.file.path : null;
    const uuid = "GYM-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    db.get(`SELECT * FROM membership_plans WHERE id = ?`, [plan_id], (err, plan) => {
        if (err || !plan) return res.status(400).json({ error: "Invalid Plan" });

        let regDate = new Date();
        let expiry = new Date();
        expiry.setMonth(expiry.getMonth() + plan.duration_months);

        const regDateStr = regDate.toISOString().split('T')[0];
        const expiryDateStr = expiry.toISOString().split('T')[0];

        // 2. Add 'phone' to the SQL command
        const sql = `INSERT INTO members (name, phone, plan_id, registration_date, expiry_date, uuid, photo_path) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        // 3. Pass the phone variable into the array here
        db.run(sql, [name, phone, plan_id, regDateStr, expiryDateStr, uuid, photo_path], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            
            const qrPath = `./qrcodes/${uuid}.png`;
            qrcode.toFile(qrPath, uuid, () => {
                res.json({ 
                    message: "Member Saved to Database!", 
                    name: name, 
                    phone: phone // Confirmation
                });
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

   app.get('/revenue-report', (req, res) => {
    const { start_date, end_date } = req.query;

    // This query gets the Sum and Count
    const summarySql = `
        SELECT SUM(p.price) as total_revenue, COUNT(m.id) as total_signups
        FROM members m
        JOIN membership_plans p ON m.plan_id = p.id
        WHERE m.registration_date BETWEEN ? AND ?`;

    // This query gets the individual member details for the receipt
    const listSql = `
        SELECT m.name, m.phone, p.plan_name, p.price
        FROM members m
        JOIN membership_plans p ON m.plan_id = p.id
        WHERE m.registration_date BETWEEN ? AND ?`;

    db.get(summarySql, [start_date, end_date], (err, summary) => {
        if (err) return res.status(400).json({ error: err.message });
        
        db.all(listSql, [start_date, end_date], (err, transactions) => {
            if (err) return res.status(400).json({ error: err.message });
            
            res.json({
                total_revenue: summary.total_revenue,
                total_signups: summary.total_signups,
                transactions: transactions // This contains names and phone numbers
            });
        });
    });
});
// 7. Get all membership plans
app.get('/plans', (req, res) => {
    db.all(`SELECT * FROM membership_plans`, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});
app.get('/admin-stats', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const sql = `
        SELECT 
            COUNT(*) as total_members,
            SUM(CASE WHEN expiry_date >= ? THEN 1 ELSE 0 END) as active_members,
            SUM(CASE WHEN registration_date = ? THEN 1 ELSE 0 END) as new_today
        FROM members
    `;

    db.get(sql, [today, today], (err, row) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(row);
    });
});

app.listen(PORT, () => {
    console.log(`
    ✅ Server is running!
    🚀 Access Dashboard: http://localhost:${PORT}/index.html
    📂 Photos stored in: /uploads
    `);
});
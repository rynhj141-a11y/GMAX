const multer = require('multer');
const path = require('path');

// 1. Setup where to save photos
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        // Saves file as "1712345678-photo.jpg"
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 2. Updated Route: Now expects a 'photo' and 'name'/'expiry_date'
app.post('/add-member', upload.single('photo'), (req, res) => {
    const { name, expiry_date } = req.body;
    const photo_path = req.file ? req.file.path : null; // Get the path of the uploaded image
    const uuid = "GYM-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    const sql = `INSERT INTO members (name, expiry_date, uuid, photo_path) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [name, expiry_date, uuid, photo_path], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        
        // Generate the QR code as before...
        const qrPath = `./qrcodes/${uuid}.png`;
        qrcode.toFile(qrPath, uuid, (qrErr) => {
            res.json({ 
                message: "Member added with photo!", 
                memberId: this.lastID,
                photo: photo_path
            });
        });
    });
});
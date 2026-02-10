const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./gym.db');

db.serialize(() => {
    // 1. Create Plans Table
    db.run(`CREATE TABLE IF NOT EXISTS membership_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_name TEXT,
        price REAL,
        duration_months INTEGER
    )`);

    // 2. Create Members Table with EVERY column we need
    db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT, 
        plan_id INTEGER,
        registration_date DATE,
        expiry_date DATE,
        uuid TEXT UNIQUE,
        photo_path TEXT,
        FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
    )`);

    // 3. AUTO-SEED: Add plans only if the table is empty
    db.get("SELECT COUNT(*) as count FROM membership_plans", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding initial membership plans...");
            db.run(`INSERT INTO membership_plans (plan_name, price, duration_months) VALUES 
                ('Bodybuilding', 40.00, 1),
                ('Gymnastics', 55.00, 1),
                ('Cardio & HIIT', 30.00, 1)`);
        }
    });
});

module.exports = db;
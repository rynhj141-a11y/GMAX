const sqlite3 = require('sqlite3').verbose();

// This creates a file named 'gym.db' in your folder
const db = new sqlite3.Database('./gym.db');

db.serialize(() => {
    // Create the members table
    db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        expiry_date DATE,
        number, 
        uuid TEXT UNIQUE
    )`);
});

console.log("Database initialized!");

module.exports = db;
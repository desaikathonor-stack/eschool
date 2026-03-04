const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const emailjs = require('@emailjs/nodejs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. DATABASE SETUP
const db = new sqlite3.Database('./eschool.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, password TEXT, name TEXT, role TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT, text TEXT, completed BOOLEAN, reminder TEXT, reminderSent BOOLEAN)");
    db.run("CREATE TABLE IF NOT EXISTS assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, dueDate TEXT, fileName TEXT, submissions TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS quizzes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, module TEXT, timeLimit TEXT, questions TEXT, showResultImmediately BOOLEAN)");
    db.run("CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER, student_email TEXT, score TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS whiteboards (email TEXT PRIMARY KEY, slides_data TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS saved_whiteboards (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, title TEXT, slides_data TEXT, created_at TEXT)");
});

// 3. BACKGROUND SCHEDULER
cron.schedule('* * * * *', async () => {
    console.log('[WORKER] Scanning for pending reminders...');
    const now = new Date().toISOString();

    db.all("SELECT * FROM todos WHERE reminderSent = 0 AND reminder IS NOT NULL AND reminder <= ?", [now], async (err, rows) => {
        if (err) return console.error(err);

        if (rows.length > 0) {
            const serviceID = process.env.VITE_EMAILJS_SERVICE_ID;
            const templateID = process.env.VITE_EMAILJS_TEMPLATE_ID;
            const publicKey = process.env.VITE_EMAILJS_PUBLIC_KEY;

            rows.forEach(todo => {
                if (serviceID && templateID && publicKey) {
                    emailjs.send(serviceID, templateID, {
                        to_email: todo.user_email,
                        task_name: todo.text,
                        message: `This is your automated reminder to complete: ${todo.text}`
                    }, {
                        publicKey: publicKey
                    })
                        .then((response) => {
                            console.log(`[WORKER] EmailJS reminder sent for: ${todo.text}`, response.status);
                            db.run("UPDATE todos SET reminderSent = 1 WHERE id = ?", [todo.id]);
                        })
                        .catch((error) => {
                            console.error("[WORKER] EmailJS error:", error);
                            db.run("UPDATE todos SET reminderSent = 1 WHERE id = ?", [todo.id]); // Prevent loop
                        });
                } else {
                    console.error("[WORKER] EmailJS keys missing from .env");
                    db.run("UPDATE todos SET reminderSent = 1 WHERE id = ?", [todo.id]);
                }
            });
        }
    });
});

// 4. API ENDPOINTS

// --- USERS ---
app.post('/api/login', (req, res) => {
    const { email, password, name, role } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) {
            db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)", [email, password, name, role], () => {
                res.json({ success: true, user: { email, name, role } });
            });
        } else {
            res.json({ success: true, user });
        }
    });
});

// --- TODOS ---
app.get('/api/todos/:email', (req, res) => {
    db.all("SELECT * FROM todos WHERE user_email = ? ORDER BY id DESC", [req.params.email], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/todos', (req, res) => {
    const { user_email, text, reminder } = req.body;
    db.run("INSERT INTO todos (user_email, text, completed, reminder, reminderSent) VALUES (?, ?, 0, ?, 0)", [user_email, text, reminder], function (err) {
        res.json({ id: this.lastID, text, user_email, reminder, completed: 0, reminderSent: 0 });
    });
});

app.delete('/api/todos/:id', (req, res) => {
    db.run("DELETE FROM todos WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

app.patch('/api/todos/:id', (req, res) => {
    const { completed } = req.body;
    db.run("UPDATE todos SET completed = ? WHERE id = ?", [completed ? 1 : 0, req.params.id], () => res.json({ success: true }));
});

// --- ASSIGNMENTS ---
app.get('/api/assignments', (req, res) => {
    db.all("SELECT * FROM assignments ORDER BY id DESC", (err, rows) => {
        const formatted = rows.map(r => ({ ...r, submissions: JSON.parse(r.submissions || '[]') }));
        res.json(formatted);
    });
});

app.post('/api/assignments', (req, res) => {
    const { title, description, dueDate, fileName } = req.body;
    db.run("INSERT INTO assignments (title, description, dueDate, fileName, submissions) VALUES (?, ?, ?, ?, '[]')", [title, description, dueDate, fileName], function (err) {
        res.json({ id: this.lastID, title, description, dueDate, fileName, submissions: [] });
    });
});

app.patch('/api/assignments/:id/submit', (req, res) => {
    const { submission } = req.body;
    db.get("SELECT submissions FROM assignments WHERE id = ?", [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ error: "Assignment not found" });
        let subs = JSON.parse(row.submissions || '[]');
        subs = subs.filter(s => s.studentEmail !== submission.studentEmail);
        subs.push(submission);
        db.run("UPDATE assignments SET submissions = ? WHERE id = ?", [JSON.stringify(subs), req.params.id], () => {
            res.json({ success: true });
        });
    });
});

app.delete('/api/assignments/:id', (req, res) => {
    db.run("DELETE FROM assignments WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

// --- QUIZZES ---
app.get('/api/quizzes', (req, res) => {
    db.all("SELECT * FROM quizzes", (err, rows) => {
        const formatted = rows.map(r => ({ ...r, questions: JSON.parse(r.questions || '[]') }));
        res.json(formatted);
    });
});

app.post('/api/quizzes', (req, res) => {
    const { title, module, timeLimit, questions, showResultImmediately } = req.body;
    db.run("INSERT INTO quizzes (title, module, timeLimit, questions, showResultImmediately) VALUES (?, ?, ?, ?, ?)", [title, module, timeLimit, JSON.stringify(questions), showResultImmediately], function (err) {
        res.json({ id: this.lastID, title, module, timeLimit, questions, showResultImmediately });
    });
});

app.delete('/api/quizzes/:id', (req, res) => {
    db.run("DELETE FROM quizzes WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

// --- ATTEMPTS ---
app.get('/api/attempts/:email', (req, res) => {
    db.all("SELECT * FROM attempts WHERE student_email = ?", [req.params.email], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/attempts', (req, res) => {
    const { quiz_id, student_email, score, showResultImmediately, quiz_title } = req.body;
    db.run("INSERT INTO attempts (quiz_id, student_email, score) VALUES (?, ?, ?)", [quiz_id, student_email, score], async function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // If teacher doesn't want results immediately in UI, we MUST email them (per requirement)
        // Actually, we can email them regardless if we want to be proactive, but requirement says "then the score should be sent to their mails"
        if (!showResultImmediately) {
            const serviceID = process.env.VITE_EMAILJS_SERVICE_ID;
            const templateID = process.env.VITE_EMAILJS_TEMPLATE_ID;
            const publicKey = process.env.VITE_EMAILJS_PUBLIC_KEY;

            if (serviceID && templateID && publicKey) {
                try {
                    await emailjs.send(serviceID, templateID, {
                        to_email: student_email,
                        task_name: `Quiz Results: ${quiz_title}`,
                        message: `Congratulations! You have completed the quiz "${quiz_title}". Your achieved score is ${score}.`
                    }, { publicKey: publicKey });
                    console.log(`[QUIZ] Results emailed to ${student_email}`);
                } catch (error) {
                    console.error("[QUIZ] Email error:", error);
                }
            }
        }
        res.json({ success: true, id: this.lastID });
    });
});

// For Teachers: See all results across all quizzes
app.get('/api/admin/attempts', (req, res) => {
    db.all(`
        SELECT attempts.*, quizzes.title as quiz_title, quizzes.module 
        FROM attempts 
        JOIN quizzes ON attempts.quiz_id = quizzes.id 
        ORDER BY attempts.id DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- WHITEBOARDS ---
// Auto-save state (most recent)
app.get('/api/whiteboards/:email', (req, res) => {
    db.get("SELECT slides_data FROM whiteboards WHERE email = ?", [req.params.email], (err, row) => {
        if (!row) {
            res.json({ slides_data: "[]" });
        } else {
            res.json({ slides_data: row.slides_data });
        }
    });
});

app.post('/api/whiteboards', (req, res) => {
    const { email, slides_data } = req.body;
    db.run(
        "INSERT INTO whiteboards (email, slides_data) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET slides_data = excluded.slides_data",
        [email, slides_data],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Saved Whiteboards Collection
app.get('/api/saved-whiteboards/:email', (req, res) => {
    db.all("SELECT id, title, created_at FROM saved_whiteboards WHERE email = ? ORDER BY id DESC", [req.params.email], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/saved-whiteboards/board/:id', (req, res) => {
    db.get("SELECT * FROM saved_whiteboards WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Not found" });
        res.json(row);
    });
});

app.post('/api/saved-whiteboards', (req, res) => {
    const { email, title, slides_data } = req.body;
    const created_at = new Date().toISOString();
    db.run(
        "INSERT INTO saved_whiteboards (email, title, slides_data, created_at) VALUES (?, ?, ?, ?)",
        [email, title, slides_data, created_at],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.delete('/api/saved-whiteboards/:id', (req, res) => {
    db.run("DELETE FROM saved_whiteboards WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`[SERVER] Running at http://localhost:${PORT}`);
    console.log(`[SERVER] Scheduler is active and checking for reminders...`);
});

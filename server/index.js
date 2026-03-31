const { sendReminderEmail } = require('./emailService');
const path = require('path');
const fs = require('fs');
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const emailjs = require('@emailjs/nodejs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;

const PASSWORD_PREFIX = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;
const uploadRoot = path.join(__dirname, 'uploads');
const quizPaperUploadDir = path.join(uploadRoot, 'question-papers');
const assignmentPaperUploadDir = path.join(uploadRoot, 'assignment-papers');
const assignmentKeyUploadDir = path.join(uploadRoot, 'assignment-keys');
const assignmentSubmissionUploadDir = path.join(uploadRoot, 'assignment-submissions');

fs.mkdirSync(quizPaperUploadDir, { recursive: true });
fs.mkdirSync(assignmentPaperUploadDir, { recursive: true });
fs.mkdirSync(assignmentKeyUploadDir, { recursive: true });
fs.mkdirSync(assignmentSubmissionUploadDir, { recursive: true });

const quizPaperStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, quizPaperUploadDir),
    filename: (_req, file, cb) => {
        const safeOriginal = String(file.originalname || 'question-paper.pdf').replace(/\s+/g, '-');
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        cb(null, `${unique}-${safeOriginal}`);
    }
});

const quizPaperUpload = multer({
    storage: quizPaperStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const isPdf = file.mimetype === 'application/pdf' || String(file.originalname || '').toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            return cb(new Error('Only PDF files are allowed for question papers.'));
        }
        return cb(null, true);
    }
});

function sanitizeUploadName(name, fallback = 'file') {
    const safe = String(name || fallback).replace(/\s+/g, '-');
    return safe.replace(/[^a-zA-Z0-9._-]/g, '');
}

function assignmentDestinationForField(fieldName) {
    if (fieldName === 'questionPaper') return assignmentPaperUploadDir;
    if (fieldName === 'answerKey') return assignmentKeyUploadDir;
    return assignmentSubmissionUploadDir;
}

function isPdfOrDocxFile(file) {
    const name = String(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const extMatch = name.endsWith('.pdf') || name.endsWith('.docx');
    const mimeMatch = mime.includes('pdf') || mime.includes('wordprocessingml.document') || mime.includes('msword');
    return extMatch || mimeMatch;
}

const assignmentStorage = multer.diskStorage({
    destination: (_req, file, cb) => cb(null, assignmentDestinationForField(file.fieldname)),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        cb(null, `${unique}-${sanitizeUploadName(file.originalname, 'assignment-file')}`);
    }
});

const assignmentUpload = multer({
    storage: assignmentStorage,
    limits: { fileSize: 40 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!isPdfOrDocxFile(file)) {
            return cb(new Error('Only PDF or DOCX files are allowed for assignments.'));
        }
        return cb(null, true);
    }
});

function toBool(value) {
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function scoreByKeywordCoverage(answer, key) {
    const ansTokens = normalizeText(answer).split(' ').filter(Boolean);
    const keyTokens = normalizeText(key).split(' ').filter(Boolean);
    if (!keyTokens.length) return 0;

    const ansSet = new Set(ansTokens);
    let hits = 0;
    for (const token of keyTokens) {
        if (ansSet.has(token)) hits += 1;
    }

    return (hits / keyTokens.length) * 100;
}

function scoreByJaccard(answer, key) {
    const ansSet = new Set(normalizeText(answer).split(' ').filter(Boolean));
    const keySet = new Set(normalizeText(key).split(' ').filter(Boolean));
    if (!keySet.size) return 0;

    let intersection = 0;
    keySet.forEach(token => {
        if (ansSet.has(token)) intersection += 1;
    });

    const union = new Set([...ansSet, ...keySet]).size;
    if (!union) return 0;
    return (intersection / union) * 100;
}

function resolveTargetMatch(difficulty, explicitTarget) {
    const target = Number(explicitTarget);
    if (Number.isFinite(target) && target > 0) {
        return clamp(target, 1, 100);
    }

    if (difficulty === 'hard') return 75;
    if (difficulty === 'medium') return 80;
    return 85;
}

const EXTERNAL_AI_BASE_URL = (process.env.EXTERNAL_AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const EXTERNAL_AI_API_KEY = process.env.EXTERNAL_AI_API_KEY || '';
const IS_GOOGLE_GENERATIVE_API = /generativelanguage\.googleapis\.com/i.test(EXTERNAL_AI_BASE_URL);
const EXTERNAL_AI_MODEL_1 = process.env.EXTERNAL_AI_MODEL_1 || (IS_GOOGLE_GENERATIVE_API ? 'gemini-2.0-flash' : 'gpt-4o-mini');
const EXTERNAL_AI_MODEL_2 = process.env.EXTERNAL_AI_MODEL_2 || (IS_GOOGLE_GENERATIVE_API ? 'gemini-1.5-flash-latest' : 'gpt-4.1-mini');

const GEMINI_MODEL_FALLBACKS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest'
];

function ensureExternalAIConfigured() {
    return Boolean(EXTERNAL_AI_API_KEY);
}

function getModelCandidates(primaryModel) {
    const candidateSet = new Set();
    const normalizedPrimary = String(primaryModel || '').trim();
    if (normalizedPrimary) {
        candidateSet.add(normalizedPrimary);

        // Gemini model aliases can differ by "-latest" suffix between API releases.
        if (normalizedPrimary.startsWith('gemini-')) {
            if (normalizedPrimary.endsWith('-latest')) {
                candidateSet.add(normalizedPrimary.replace(/-latest$/, ''));
            } else {
                candidateSet.add(`${normalizedPrimary}-latest`);
            }
        }
    }

    if (IS_GOOGLE_GENERATIVE_API) {
        GEMINI_MODEL_FALLBACKS.forEach(model => candidateSet.add(model));
    }

    return Array.from(candidateSet).filter(Boolean);
}

function parseAiScoreContent(rawText) {
    const fallback = { score: 0, feedback: '' };
    if (!rawText) return fallback;

    const text = String(rawText).trim();
    const withoutFences = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();

    try {
        const parsed = JSON.parse(withoutFences);
        const score = clamp(Number(parsed.score), 0, 100);
        return {
            score: Number.isFinite(score) ? score : 0,
            feedback: String(parsed.feedback || '').slice(0, 600)
        };
    } catch (_error) {
        const objectMatch = withoutFences.match(/\{[\s\S]*\}/);
        if (objectMatch) {
            try {
                const parsed = JSON.parse(objectMatch[0]);
                const score = clamp(Number(parsed.score), 0, 100);
                return {
                    score: Number.isFinite(score) ? score : 0,
                    feedback: String(parsed.feedback || '').slice(0, 600)
                };
            } catch (_nestedError) {
                const scoreMatch = withoutFences.match(/"?score"?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
                const feedbackMatch = withoutFences.match(/"?feedback"?\s*[:=]\s*"?([\s\S]{1,300})"?/i);
                const score = clamp(Number(scoreMatch?.[1] || 0), 0, 100);
                return {
                    score: Number.isFinite(score) ? score : 0,
                    feedback: String(feedbackMatch?.[1] || '').slice(0, 600)
                };
            }
        }

        const scoreMatch = withoutFences.match(/([0-9]+(?:\.[0-9]+)?)\s*%?/);
        const score = clamp(Number(scoreMatch?.[1] || 0), 0, 100);
        return {
            score: Number.isFinite(score) ? score : 0,
            feedback: withoutFences.slice(0, 600)
        };
    }
}

async function scoreWithExternalAI({ model, studentAnswer, answerKey, contextLabel }) {
    if (!ensureExternalAIConfigured()) {
        throw new Error('External AI is not configured. Set EXTERNAL_AI_API_KEY in server environment.');
    }

    const modelCandidates = getModelCandidates(model);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
        let lastError = null;

        for (const candidateModel of modelCandidates) {
            const url = `${EXTERNAL_AI_BASE_URL}/models/${candidateModel}:generateContent?key=${EXTERNAL_AI_API_KEY}`;
            console.log('[AI DEBUG] Request URL:', url.replace(EXTERNAL_AI_API_KEY, '***KEY***'));
            console.log('[AI DEBUG] Base URL:', EXTERNAL_AI_BASE_URL);
            console.log('[AI DEBUG] Model:', candidateModel);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: {
                            text: 'You are a strict academic evaluator. Return JSON only with keys: score (0-100 number), feedback (short string).'
                        }
                    },
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    text: [
                                        `Context: ${contextLabel}`,
                                        'Evaluate the student answer against the answer key.',
                                        'Scoring rules: semantic correctness, coverage of key points, accuracy, and clarity.',
                                        'Return only JSON object: {"score": <0-100>, "feedback": "..."}.',
                                        `Answer Key:\n${String(answerKey || '').slice(0, 8000)}`,
                                        `Student Answer:\n${String(studentAnswer || '').slice(0, 8000)}`
                                    ].join('\n\n')
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        topK: 40,
                        topP: 0.95
                    }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                const modelNotFound = response.status === 404 && /NOT_FOUND|not found|ListModels/i.test(errorText);
                const requestError = new Error(`External AI request failed (${response.status}): ${errorText.slice(0, 300)}`);
                requestError.modelNotFound = modelNotFound;
                requestError.model = candidateModel;
                lastError = requestError;

                if (modelNotFound) {
                    console.warn(`[AI] Model ${candidateModel} not available. Trying next fallback model.`);
                    continue;
                }

                throw requestError;
            }

            const payload = await response.json();
            const rawContent = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = parseAiScoreContent(rawContent);
            return {
                score: Number(parsed.score.toFixed(2)),
                feedback: parsed.feedback
            };
        }

        if (lastError) {
            throw new Error(
                `External AI evaluation failed after trying models: ${modelCandidates.join(', ')}. Last error: ${lastError.message}`
            );
        }

        throw new Error('External AI evaluation failed: no model candidates available.');
    } finally {
        clearTimeout(timeout);
    }
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadRoot));

// 1. DATABASE SETUP
const db = new sqlite3.Database('./eschool.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, password TEXT, name TEXT, role TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT, text TEXT, completed BOOLEAN, reminder TEXT, reminderSent BOOLEAN)");
    db.run("CREATE TABLE IF NOT EXISTS assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, dueDate TEXT, fileName TEXT, submissions TEXT, difficulty TEXT, answerKeyText TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS quizzes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, module TEXT, timeLimit TEXT, questions TEXT, showResultImmediately BOOLEAN)");
    db.run("CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER, student_email TEXT, score TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS whiteboards (email TEXT PRIMARY KEY, slides_data TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS saved_whiteboards (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, title TEXT, slides_data TEXT, created_at TEXT)");
    db.run("CREATE INDEX IF NOT EXISTS idx_todos_user_email ON todos(user_email)");
    db.run("CREATE INDEX IF NOT EXISTS idx_todos_reminder_pending ON todos(reminderSent, reminder)");

    db.all("PRAGMA table_info(quizzes)", (pragmaErr, columns = []) => {
        if (pragmaErr) {
            console.error('[DB] Failed reading quizzes schema:', pragmaErr);
            return;
        }

        const columnNames = new Set(columns.map(col => col.name));
        if (!columnNames.has('questionPaperPath')) {
            db.run("ALTER TABLE quizzes ADD COLUMN questionPaperPath TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding questionPaperPath:', alterErr);
            });
        }
        if (!columnNames.has('questionPaperName')) {
            db.run("ALTER TABLE quizzes ADD COLUMN questionPaperName TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding questionPaperName:', alterErr);
            });
        }
        if (!columnNames.has('quizType')) {
            db.run("ALTER TABLE quizzes ADD COLUMN quizType TEXT DEFAULT 'objective'", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding quizType:', alterErr);
            });
        }
    });

    db.all("PRAGMA table_info(attempts)", (pragmaErr, columns = []) => {
        if (pragmaErr) {
            console.error('[DB] Failed reading attempts schema:', pragmaErr);
            return;
        }

        const columnNames = new Set(columns.map(col => col.name));
        if (!columnNames.has('responses')) {
            db.run("ALTER TABLE attempts ADD COLUMN responses TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding responses:', alterErr);
            });
        }
        if (!columnNames.has('evaluationStatus')) {
            db.run("ALTER TABLE attempts ADD COLUMN evaluationStatus TEXT DEFAULT 'completed'", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding evaluationStatus:', alterErr);
            });
        }
        if (!columnNames.has('aiScoreModel1')) {
            db.run("ALTER TABLE attempts ADD COLUMN aiScoreModel1 REAL", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding aiScoreModel1:', alterErr);
            });
        }
        if (!columnNames.has('aiScoreModel2')) {
            db.run("ALTER TABLE attempts ADD COLUMN aiScoreModel2 REAL", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding aiScoreModel2:', alterErr);
            });
        }
        if (!columnNames.has('finalScore')) {
            db.run("ALTER TABLE attempts ADD COLUMN finalScore REAL", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding finalScore:', alterErr);
            });
        }
    });

    db.all("PRAGMA table_info(assignments)", (pragmaErr, columns = []) => {
        if (pragmaErr) {
            console.error('[DB] Failed reading assignments schema:', pragmaErr);
            return;
        }

        const columnNames = new Set(columns.map(col => col.name));
        if (!columnNames.has('description')) {
            db.run("ALTER TABLE assignments ADD COLUMN description TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding description:', alterErr);
            });
        }
        if (!columnNames.has('dueDate')) {
            db.run("ALTER TABLE assignments ADD COLUMN dueDate TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding dueDate:', alterErr);
            });
        }
        if (!columnNames.has('fileName')) {
            db.run("ALTER TABLE assignments ADD COLUMN fileName TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding fileName:', alterErr);
            });
        }
        if (!columnNames.has('submissions')) {
            db.run("ALTER TABLE assignments ADD COLUMN submissions TEXT DEFAULT '[]'", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding submissions:', alterErr);
            });
        }
        if (!columnNames.has('difficulty')) {
            db.run("ALTER TABLE assignments ADD COLUMN difficulty TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding difficulty:', alterErr);
            });
        }
        if (!columnNames.has('answerKeyText')) {
            db.run("ALTER TABLE assignments ADD COLUMN answerKeyText TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding answerKeyText:', alterErr);
            });
        }
        if (!columnNames.has('questionPaperPath')) {
            db.run("ALTER TABLE assignments ADD COLUMN questionPaperPath TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding questionPaperPath:', alterErr);
            });
        }
        if (!columnNames.has('questionPaperName')) {
            db.run("ALTER TABLE assignments ADD COLUMN questionPaperName TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding questionPaperName:', alterErr);
            });
        }
        if (!columnNames.has('answerKeyPath')) {
            db.run("ALTER TABLE assignments ADD COLUMN answerKeyPath TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding answerKeyPath:', alterErr);
            });
        }
        if (!columnNames.has('answerKeyName')) {
            db.run("ALTER TABLE assignments ADD COLUMN answerKeyName TEXT", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding answerKeyName:', alterErr);
            });
        }
        if (!columnNames.has('targetMatch')) {
            db.run("ALTER TABLE assignments ADD COLUMN targetMatch REAL", (alterErr) => {
                if (alterErr) console.error('[DB] Failed adding targetMatch:', alterErr);
            });
        }
    });
});

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(`${PASSWORD_PREFIX}$${salt}$${derivedKey.toString('hex')}`);
        });
    });
}

function verifyHashedPassword(password, storedPassword) {
    if (!storedPassword || !storedPassword.startsWith(`${PASSWORD_PREFIX}$`)) {
        return false;
    }

    const [prefix, salt, hashHex] = storedPassword.split('$');
    if (prefix !== PASSWORD_PREFIX || !salt || !hashHex) {
        return false;
    }

    const storedBuffer = Buffer.from(hashHex, 'hex');
    const derivedBuffer = crypto.scryptSync(password, salt, storedBuffer.length);
    return crypto.timingSafeEqual(storedBuffer, derivedBuffer);
}

function runSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function getSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

cron.schedule('* * * * *', async () => {
    const now = new Date().toISOString();
    console.log('[CRON] Tick at:', now);

    db.all(
        "SELECT * FROM todos WHERE reminderSent = 0 AND reminder IS NOT NULL AND reminder <= ?",
        [now],
        async (err, rows) => {
            if (err) return console.error('[CRON] DB error:', err);
            console.log('[CRON] Pending reminders found:', rows.length);

            for (const todo of rows) {
                console.log('[CRON] Processing todo:', todo.id, todo.text, todo.reminder);
                try {
                    await sendReminderEmail(
                        todo.user_email,
                        todo.text,
                        new Date(todo.reminder).toLocaleString()
                    );
                    console.log(`[CRON] Email sent to ${todo.user_email} for: ${todo.text}`);
                } catch (emailErr) {
                    console.error(`[CRON] Email failed for todo ${todo.id}:`, emailErr.message);
                }
                db.run("UPDATE todos SET reminderSent = 1 WHERE id = ?", [todo.id]);
            }
        }
    );
});

// 4. API ENDPOINTS

// --- USERS ---
async function handleAuth(req, res) {
    try {
        const { email, password, name, role, action } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required.' });
        }

        const user = await getSql("SELECT * FROM users WHERE email = ?", [normalizedEmail]);
        const isSignup = action === 'signup';

        if (isSignup) {
            if (user) {
                return res.status(409).json({ success: false, error: 'User already exists. Please log in.' });
            }

            const hashedPassword = await hashPassword(password);
            const safeName = String(name || '').trim() || normalizedEmail.split('@')[0];
            const safeRole = role === 'teacher' ? 'teacher' : 'student';

            await runSql(
                "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
                [normalizedEmail, hashedPassword, safeName, safeRole]
            );

            return res.json({ success: true, user: { email: normalizedEmail, name: safeName, role: safeRole } });
        }

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found. Please sign up first.' });
        }

        const isValidHashed = verifyHashedPassword(password, user.password);
        const isValidLegacy = user.password === password;
        if (!isValidHashed && !isValidLegacy) {
            return res.status(401).json({ success: false, error: 'Incorrect password.' });
        }

        if (isValidLegacy) {
            const upgradedHash = await hashPassword(password);
            await runSql("UPDATE users SET password = ? WHERE email = ?", [upgradedHash, normalizedEmail]);
        }

        return res.json({
            success: true,
            user: {
                email: user.email,
                name: user.name,
                role: user.role === 'teacher' ? 'teacher' : 'student'
            }
        });
    } catch (error) {
        console.error('[AUTH] Error:', error);
        return res.status(500).json({ success: false, error: 'Authentication failed.' });
    }
}

app.post('/api/login', handleAuth);
app.post('/api/auth', handleAuth);

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

app.patch('/api/todos/:id/reminder-sent', (req, res) => {
    db.run("UPDATE todos SET reminderSent = 1 WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

// --- ASSIGNMENTS ---
app.get('/api/assignments', (req, res) => {
    db.all("SELECT * FROM assignments ORDER BY id DESC", (err, rows) => {
        const formatted = rows.map(r => ({
            ...r,
            dueDate: r.dueDate || null,
            difficulty: r.difficulty || null,
            targetMatch: Number.isFinite(r.targetMatch) ? r.targetMatch : (r.targetMatch ? Number(r.targetMatch) : null),
            questionPaperName: r.questionPaperName || r.fileName || null,
            questionPaperUrl: r.questionPaperPath ? `/uploads/assignment-papers/${r.questionPaperPath}` : null,
            answerKeyName: r.answerKeyName || null,
            answerKeyUrl: r.answerKeyPath ? `/uploads/assignment-keys/${r.answerKeyPath}` : null,
            submissions: JSON.parse(r.submissions || '[]')
        }));
        res.json(formatted);
    });
});

app.post('/api/assignments', assignmentUpload.fields([{ name: 'questionPaper', maxCount: 1 }, { name: 'answerKey', maxCount: 1 }]), (req, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const dueDate = String(req.body.dueDate || '').trim() || null;
    const difficulty = String(req.body.difficulty || '').trim() || null;
    const answerKeyText = String(req.body.answerKeyText || '').trim();
    const targetMatch = resolveTargetMatch(difficulty, req.body.targetMatch);

    if (!title) {
        return res.status(400).json({ error: 'Assignment title is required.' });
    }

    const questionPaper = req.files?.questionPaper?.[0] || null;
    const answerKey = req.files?.answerKey?.[0] || null;

    db.run(
        "INSERT INTO assignments (title, description, dueDate, fileName, difficulty, answerKeyText, submissions, questionPaperPath, questionPaperName, answerKeyPath, answerKeyName, targetMatch) VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)",
        [
            title,
            description || null,
            dueDate,
            questionPaper?.originalname || null,
            difficulty,
            answerKeyText || null,
            questionPaper?.filename || null,
            questionPaper?.originalname || null,
            answerKey?.filename || null,
            answerKey?.originalname || null,
            targetMatch
        ],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                id: this.lastID,
                title,
                description: description || null,
                dueDate,
                difficulty,
                answerKeyText: answerKeyText || null,
                targetMatch,
                questionPaperName: questionPaper?.originalname || null,
                questionPaperUrl: questionPaper?.filename ? `/uploads/assignment-papers/${questionPaper.filename}` : null,
                answerKeyName: answerKey?.originalname || null,
                answerKeyUrl: answerKey?.filename ? `/uploads/assignment-keys/${answerKey.filename}` : null,
                submissions: []
            });
        }
    );
});

app.patch('/api/assignments/:id/settings', assignmentUpload.single('answerKey'), (req, res) => {
    const difficulty = String(req.body.difficulty || '').trim() || null;
    const targetMatch = resolveTargetMatch(difficulty || 'easy', req.body.targetMatch);
    const answerKeyText = String(req.body.answerKeyText || '').trim() || null;
    const answerKey = req.file || null;

    db.run(
        "UPDATE assignments SET difficulty = ?, targetMatch = ?, answerKeyText = COALESCE(?, answerKeyText), answerKeyPath = COALESCE(?, answerKeyPath), answerKeyName = COALESCE(?, answerKeyName) WHERE id = ?",
        [difficulty, targetMatch, answerKeyText, answerKey?.filename || null, answerKey?.originalname || null, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.patch('/api/assignments/:id/submit', assignmentUpload.single('submissionFile'), (req, res) => {
    const studentEmail = String(req.body.studentEmail || req.body.student_email || '').trim().toLowerCase();
    const status = String(req.body.status || '').trim() || 'Submitted';
    const submissionText = String(req.body.submissionText || '').trim();

    if (!studentEmail) {
        return res.status(400).json({ error: 'Student email is required.' });
    }

    const uploadedFile = req.file || null;
    const submission = {
        studentEmail,
        fileName: uploadedFile?.originalname || null,
        filePath: uploadedFile?.filename || null,
        fileUrl: uploadedFile?.filename ? `/uploads/assignment-submissions/${uploadedFile.filename}` : null,
        submittedAt: new Date().toISOString(),
        status,
        submissionText,
        aiModel1Match: null,
        aiModel2Match: null,
        bestMatch: null,
        finalScorePct: null,
        evaluatedAt: null
    };

    db.get("SELECT submissions FROM assignments WHERE id = ?", [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ error: "Assignment not found" });
        let subs = JSON.parse(row.submissions || '[]');
        subs = subs.filter(s => s.studentEmail !== studentEmail);
        subs.push(submission);
        db.run("UPDATE assignments SET submissions = ? WHERE id = ?", [JSON.stringify(subs), req.params.id], () => {
            res.json({ success: true });
        });
    });
});

app.post('/api/assignments/:id/evaluate', async (req, res) => {
    try {
        if (!ensureExternalAIConfigured()) {
            return res.status(503).json({ error: 'External AI is not configured. Set EXTERNAL_AI_API_KEY on the server.' });
        }

        const assignment = await getSql("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found.' });
        }

        const answerKeyText = String(assignment.answerKeyText || '').trim();
        if (!answerKeyText) {
            return res.status(400).json({ error: 'Upload or set answer key before evaluation.' });
        }

        const difficulty = String(req.body?.difficulty || assignment.difficulty || 'easy').toLowerCase();
        const targetMatch = resolveTargetMatch(difficulty, req.body?.targetMatch ?? assignment.targetMatch);
        const submissions = JSON.parse(assignment.submissions || '[]');

        if (!submissions.length) {
            return res.status(400).json({ error: 'No submissions found to evaluate.' });
        }

        const evaluated = await Promise.all(submissions.map(async (submission) => {
            const text = String(submission.submissionText || '');
            const [model1Result, model2Result] = await Promise.all([
                scoreWithExternalAI({
                    model: EXTERNAL_AI_MODEL_1,
                    studentAnswer: text,
                    answerKey: answerKeyText,
                    contextLabel: `Assignment ${assignment.title || assignment.id} - Model 1`
                }),
                scoreWithExternalAI({
                    model: EXTERNAL_AI_MODEL_2,
                    studentAnswer: text,
                    answerKey: answerKeyText,
                    contextLabel: `Assignment ${assignment.title || assignment.id} - Model 2`
                })
            ]);

            const model1 = model1Result.score;
            const model2 = model2Result.score;
            const bestMatch = Math.max(model1, model2);
            const scorePct = clamp((bestMatch / targetMatch) * 100, 0, 100);

            return {
                ...submission,
                aiModel1Match: Number(model1.toFixed(2)),
                aiModel2Match: Number(model2.toFixed(2)),
                bestMatch: Number(bestMatch.toFixed(2)),
                finalScorePct: Number(scorePct.toFixed(2)),
                aiModel1Feedback: model1Result.feedback,
                aiModel2Feedback: model2Result.feedback,
                evaluatedAt: new Date().toISOString()
            };
        }));

        await runSql(
            "UPDATE assignments SET submissions = ?, difficulty = ?, targetMatch = ? WHERE id = ?",
            [JSON.stringify(evaluated), difficulty, targetMatch, req.params.id]
        );

        return res.json({
            success: true,
            difficulty,
            targetMatch,
            evaluatedCount: evaluated.length,
            submissions: evaluated
        });
    } catch (error) {
        console.error('[ASSIGNMENT] Evaluation error:', error);
        return res.status(500).json({ error: 'Failed to evaluate submissions.' });
    }
});

app.delete('/api/assignments/:id', (req, res) => {
    db.get("SELECT questionPaperPath, answerKeyPath, submissions FROM assignments WHERE id = ?", [req.params.id], (readErr, row) => {
        if (readErr) return res.status(500).json({ error: readErr.message });

        db.run("DELETE FROM assignments WHERE id = ?", [req.params.id], (deleteErr) => {
            if (deleteErr) return res.status(500).json({ error: deleteErr.message });

            if (row?.questionPaperPath) {
                fs.unlink(path.join(assignmentPaperUploadDir, row.questionPaperPath), () => { });
            }
            if (row?.answerKeyPath) {
                fs.unlink(path.join(assignmentKeyUploadDir, row.answerKeyPath), () => { });
            }

            const submissions = JSON.parse(row?.submissions || '[]');
            submissions.forEach((submission) => {
                if (submission.filePath) {
                    fs.unlink(path.join(assignmentSubmissionUploadDir, submission.filePath), () => { });
                }
            });

            return res.json({ success: true });
        });
    });
});

// --- QUIZZES ---
app.get('/api/quizzes', (req, res) => {
    db.all("SELECT * FROM quizzes", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = rows.map(r => ({
            ...r,
            questions: JSON.parse(r.questions || '[]'),
            showResultImmediately: r.showResultImmediately === 1 || r.showResultImmediately === true,
            quizType: r.quizType || 'objective',
            questionPaperName: r.questionPaperName || null,
            questionPaperUrl: r.questionPaperPath ? `/uploads/question-papers/${r.questionPaperPath}` : null
        }));
        res.json(formatted);
    });
});

app.post('/api/quizzes', quizPaperUpload.single('questionPaper'), (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const module = String(req.body.module || '').trim();
        const timeLimit = String(req.body.timeLimit || '').trim();
        const rawQuestions = req.body.questions;
        const questions = typeof rawQuestions === 'string' ? JSON.parse(rawQuestions) : rawQuestions;
        const quizType = String(req.body.quizType || 'objective') === 'subjective' ? 'subjective' : 'objective';
        const showResultImmediately = quizType === 'subjective' ? false : toBool(req.body.showResultImmediately);

        if (!title || !module || !timeLimit || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'Invalid quiz payload.' });
        }

        const questionPaperPath = req.file ? req.file.filename : null;
        const questionPaperName = req.file ? req.file.originalname : null;

        db.run(
            "INSERT INTO quizzes (title, module, timeLimit, questions, showResultImmediately, questionPaperPath, questionPaperName, quizType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [title, module, timeLimit, JSON.stringify(questions), showResultImmediately ? 1 : 0, questionPaperPath, questionPaperName, quizType],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                    id: this.lastID,
                    title,
                    module,
                    timeLimit,
                    questions,
                    showResultImmediately: !!showResultImmediately,
                    quizType,
                    questionPaperName,
                    questionPaperUrl: questionPaperPath ? `/uploads/question-papers/${questionPaperPath}` : null
                });
            }
        );
    } catch (error) {
        if (req.file?.path) {
            fs.unlink(req.file.path, () => { });
        }
        return res.status(400).json({ error: error.message || 'Failed to create quiz.' });
    }
});

app.delete('/api/quizzes/:id', (req, res) => {
    db.get("SELECT questionPaperPath FROM quizzes WHERE id = ?", [req.params.id], (readErr, row) => {
        if (readErr) return res.status(500).json({ error: readErr.message });

        db.run("DELETE FROM quizzes WHERE id = ?", [req.params.id], (deleteErr) => {
            if (deleteErr) return res.status(500).json({ error: deleteErr.message });

            if (row?.questionPaperPath) {
                const storedPath = path.join(quizPaperUploadDir, row.questionPaperPath);
                fs.unlink(storedPath, () => { });
            }

            return res.json({ success: true });
        });
    });
});

// --- ATTEMPTS ---
app.get('/api/attempts/:email', (req, res) => {
    db.all("SELECT * FROM attempts WHERE student_email = ?", [req.params.email], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/attempts', (req, res) => {
    const { quiz_id, student_email, score, showResultImmediately, quiz_title, quiz_type, responses } = req.body;
    const quizType = quiz_type === 'subjective' ? 'subjective' : 'objective';
    const evaluationStatus = quizType === 'subjective' ? 'pending' : 'completed';
    const storedScore = quizType === 'subjective' ? 'Pending' : score;

    db.run(
        "INSERT INTO attempts (quiz_id, student_email, score, responses, evaluationStatus, finalScore) VALUES (?, ?, ?, ?, ?, ?)",
        [quiz_id, student_email, storedScore, JSON.stringify(responses || {}), evaluationStatus, quizType === 'subjective' ? null : parseFloat(String(score || '').replace('%', '')) || null],
        async function (err) {
        if (err) return res.status(500).json({ error: err.message });

        if (!showResultImmediately && quizType !== 'subjective') {
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
        res.json({ success: true, id: this.lastID, evaluationStatus });
    });
});

app.post('/api/attempts/:id/evaluate-ai', async (req, res) => {
    try {
        if (!ensureExternalAIConfigured()) {
            return res.status(503).json({ error: 'External AI is not configured. Set EXTERNAL_AI_API_KEY on the server.' });
        }

        const attempt = await getSql("SELECT * FROM attempts WHERE id = ?", [req.params.id]);
        if (!attempt) {
            return res.status(404).json({ error: 'Attempt not found.' });
        }

        const quiz = await getSql("SELECT questions, quizType FROM quizzes WHERE id = ?", [attempt.quiz_id]);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found.' });
        }

        if ((quiz.quizType || 'objective') !== 'subjective') {
            return res.status(400).json({ error: 'AI evaluation is only for subjective quizzes.' });
        }

        const responses = JSON.parse(attempt.responses || '{}');
        const questions = JSON.parse(quiz.questions || '[]');
        const descriptive = questions.filter(question => question.type === 'descriptive');
        if (!descriptive.length) {
            return res.status(400).json({ error: 'No descriptive questions found to evaluate.' });
        }

        let model1Total = 0;
        let model2Total = 0;

        for (let index = 0; index < descriptive.length; index += 1) {
            const question = descriptive[index];
            const studentAnswer = responses[index] ?? responses[String(index)] ?? '';
            const answerKey = question.answerKey || '';
            const [model1Result, model2Result] = await Promise.all([
                scoreWithExternalAI({
                    model: EXTERNAL_AI_MODEL_1,
                    studentAnswer,
                    answerKey,
                    contextLabel: `Subjective quiz ${attempt.quiz_id} question ${index + 1} - Model 1`
                }),
                scoreWithExternalAI({
                    model: EXTERNAL_AI_MODEL_2,
                    studentAnswer,
                    answerKey,
                    contextLabel: `Subjective quiz ${attempt.quiz_id} question ${index + 1} - Model 2`
                })
            ]);

            model1Total += model1Result.score;
            model2Total += model2Result.score;
        }

        const model1Score = clamp(model1Total / descriptive.length, 0, 100);
        const model2Score = clamp(model2Total / descriptive.length, 0, 100);
        const recommendedScore = clamp((model1Score + model2Score) / 2, 0, 100);

        await runSql(
            "UPDATE attempts SET aiScoreModel1 = ?, aiScoreModel2 = ?, evaluationStatus = ? WHERE id = ?",
            [model1Score, model2Score, 'ai_evaluated', req.params.id]
        );

        return res.json({
            success: true,
            model1Score: Number(model1Score.toFixed(2)),
            model2Score: Number(model2Score.toFixed(2)),
            recommendedScore: Number(recommendedScore.toFixed(2))
        });
    } catch (error) {
        console.error('[EVAL] Error:', error);
        return res.status(500).json({ error: 'Failed to evaluate attempt.' });
    }
});

app.patch('/api/attempts/:id/finalize-score', async (req, res) => {
    try {
        const value = Number(req.body.finalScore);
        if (!Number.isFinite(value)) {
            return res.status(400).json({ error: 'Invalid final score.' });
        }

        const finalScore = clamp(value, 0, 100);
        await runSql(
            "UPDATE attempts SET finalScore = ?, score = ?, evaluationStatus = ? WHERE id = ?",
            [finalScore, `${Math.round(finalScore)}%`, 'completed', req.params.id]
        );

        return res.json({ success: true, finalScore });
    } catch (error) {
        console.error('[EVAL] Finalize error:', error);
        return res.status(500).json({ error: 'Failed to finalize score.' });
    }
});

// For Teachers: See all results across all quizzes
app.get('/api/admin/attempts', (req, res) => {
    db.all(`
        SELECT attempts.*, quizzes.title as quiz_title, quizzes.module, quizzes.quizType 
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

app.use((err, _req, res, next) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }

    if (err.message && (err.message.includes('PDF') || err.message.includes('DOCX') || err.message.includes('assignments'))) {
        return res.status(400).json({ error: err.message });
    }

    console.error('[SERVER] Unhandled error:', err);
    return res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
    console.log(`[SERVER] Running at http://localhost:${PORT}`);
    console.log(`[SERVER] Scheduler is active and checking for reminders...`);
});

import { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Globe, Mail } from 'lucide-react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function TeacherQuizSettings() {
    const [quizzes, setQuizzes] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newQuiz, setNewQuiz] = useState({ title: '', module: 'Module 1', timeLimit: '30 mins', questionsCount: 5, showResultImmediately: true, generalAnswerKeyFile: null });

    const [questionsData, setQuestionsData] = useState(
        Array.from({ length: 5 }, () => ({
            q: '',
            type: 'mcq',
            level: 'medium',
            options: ['', '', '', ''],
            correct: 0,
            answerKey: '',
            answerKeyFile: null
        }))
    );

    const [attempts, setAttempts] = useState([]);

    useEffect(() => {
        fetchQuizzes();
        fetchAttempts();
    }, []);

    const extractTextFromFile = async (file) => {
        if (!file) return '';
        try {
            if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                return result.value.trim();
            } else if (file.name.endsWith('.pdf')) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ') + ' ';
                }
                return text.trim();
            } else {
                const text = await file.text();
                return text.trim();
            }
        } catch (err) {
            console.error("Extraction error", err);
            return '';
        }
    };

    const handleGeneralFileChange = async (e) => {
        const file = e.target.files[0];
        setNewQuiz({ ...newQuiz, generalAnswerKeyFile: file });
        if (file) {
            const text = await extractTextFromFile(file);
            setQuestionsData(prev => prev.map(q =>
                q.type === 'descriptive' ? { ...q, answerKey: text } : q
            ));
        }
    };

    const handleQuestionFileUpload = async (index, file) => {
        updateQuestionField(index, 'answerKeyFile', file);
        if (file) {
            const text = await extractTextFromFile(file);
            updateQuestionField(index, 'answerKey', text);
        }
    };

    const fetchAttempts = () => {
        fetch('http://localhost:5000/api/admin/attempts')
            .then(res => res.json())
            .then(data => setAttempts(data || []))
            .catch(err => console.error("Fetch attempts error:", err));
    };

    const fetchQuizzes = () => {
        fetch('http://localhost:5000/api/quizzes')
            .then(res => res.json())
            .then(data => setQuizzes(data))
            .catch(err => console.error("Fetch quizzes error:", err));
    };

    const handleCountChange = (e) => {
        let count = parseInt(e.target.value) || 1;
        if (count > 50) count = 50;

        setNewQuiz({ ...newQuiz, questionsCount: count });

        setQuestionsData(prev => {
            const newData = [...prev];
            if (count > prev.length) {
                for (let i = prev.length; i < count; i++) {
                    newData.push({ q: '', type: 'mcq', level: 'medium', options: ['', '', '', ''], correct: 0, answerKey: '', answerKeyFile: null });
                }
            } else if (count < prev.length) {
                newData.length = count;
            }
            return newData;
        });
    };

    const updateQuestionPrompt = (index, value) => {
        const newData = [...questionsData];
        newData[index].q = value;
        setQuestionsData(newData);
    };

    const updateQuestionField = (index, field, value) => {
        const newData = [...questionsData];
        newData[index][field] = value;
        setQuestionsData(newData);
    };

    const updateQuestionOption = (qIndex, optIndex, value) => {
        const newData = [...questionsData];
        newData[qIndex].options[optIndex] = value;
        setQuestionsData(newData);
    };

    const updateCorrectOption = (qIndex, optIndex) => {
        const newData = [...questionsData];
        newData[qIndex].correct = optIndex;
        setQuestionsData(newData);
    };

    const handleCreate = (e) => {
        e.preventDefault();

        // Validation
        for (let i = 0; i < questionsData.length; i++) {
            const qData = questionsData[i];
            if (!qData.q.trim()) {
                alert(`Please enter a prompt for Question ${i + 1}.`);
                return;
            }
            if (qData.type === 'mcq' && qData.options.some(o => !o.trim())) {
                alert(`Please complete all options in Question ${i + 1} before publishing.`);
                return;
            }
            if (qData.type === 'descriptive' && !newQuiz.generalAnswerKeyFile && !qData.answerKey.trim() && !qData.answerKeyFile) {
                alert(`Please complete the descriptive answer key for Question ${i + 1} or upload a file.`);
                return;
            }
        }

        const created = {
            title: newQuiz.title,
            module: newQuiz.module,
            timeLimit: newQuiz.timeLimit,
            questions: questionsData,
            showResultImmediately: newQuiz.showResultImmediately
        };

        fetch('http://localhost:5000/api/quizzes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(created)
        })
            .then(res => res.json())
            .then(data => {
                setQuizzes([...quizzes, data]);
                setIsCreating(false);
                setNewQuiz({ title: '', module: 'Module 1', timeLimit: '30 mins', questionsCount: 5, showResultImmediately: true, generalAnswerKeyFile: null });
                setQuestionsData(Array.from({ length: 5 }, () => ({
                    q: '',
                    type: 'mcq',
                    level: 'medium',
                    options: ['', '', '', ''],
                    correct: 0,
                    answerKey: '',
                    answerKeyFile: null
                })));
            });
    };

    const unpublish = (id) => {
        fetch(`http://localhost:5000/api/quizzes/${id}`, { method: 'DELETE' })
            .then(() => setQuizzes(quizzes.filter(q => q.id !== id)));
    };

    const handleSendMail = (attempt) => {
        const mailtoLink = `mailto:${attempt.student_email}?subject=Your Quiz Result&body=Hello,\n\nYou have taken the quiz "${attempt.quiz_title}" and scored: ${attempt.score}.\n\nBest Regards,\nTeacher`;
        window.location.href = mailtoLink;
    };

    return (
        <div className="glass-panel" style={{ height: '100%', padding: '2.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Quiz Settings</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage and create assessments for your students based on modules.</p>
                </div>
                <button onClick={() => setIsCreating(!isCreating)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isCreating ? 'Cancel' : <><Plus size={20} /> Create New Quiz</>}
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleCreate} style={{ padding: '2rem', background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>Create a New Quiz</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Quiz Title</label>
                            <input type="text" required value={newQuiz.title} onChange={e => setNewQuiz({ ...newQuiz, title: e.target.value })} className="input-base" placeholder="e.g. Advanced React Ecosystem" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Target Module</label>
                                <select value={newQuiz.module} onChange={e => setNewQuiz({ ...newQuiz, module: e.target.value })} className="input-base" style={{ background: 'var(--bg-dark)' }}>
                                    <option>Module 1 (Intro)</option>
                                    <option>Module 2 (HTML)</option>
                                    <option>Module 3 (CSS)</option>
                                    <option>Module 4 (JavaScript)</option>
                                    <option>Module 5 (Adv. JS)</option>
                                    <option>Module 6 (React)</option>
                                    <option>Module 7 (Adv. React)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Time Limit</label>
                                <input type="text" required value={newQuiz.timeLimit} onChange={e => setNewQuiz({ ...newQuiz, timeLimit: e.target.value })} className="input-base" placeholder="e.g. 30 mins" />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Number of Questions (1-50)</label>
                                <input type="number" min="1" max="50" required value={newQuiz.questionsCount} onChange={handleCountChange} className="input-base" placeholder="10" />
                            </div>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    id="showResultOption"
                                    checked={newQuiz.showResultImmediately}
                                    onChange={e => setNewQuiz({ ...newQuiz, showResultImmediately: e.target.checked })}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="showResultOption" style={{ cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                    Show result to student immediately after completing.
                                </label>
                            </div>
                            <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px', minWidth: '300px' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload General Answer Key (Docx/PDF)</label>
                                <input type="file" accept=".pdf,.docx" onChange={handleGeneralFileChange} className="input-base" style={{ padding: '6px', fontSize: '0.85rem' }} />
                                <p style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>*Optional: Attach key as a whole document. This will format questions and auto-disable question-by-question keys.</p>
                            </div>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <h4 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Define {newQuiz.questionsCount} Questions:</h4>

                        {questionsData.map((qData, index) => (
                            <div key={index} style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h5 style={{ color: 'var(--primary)' }}>Question {index + 1}</h5>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <select value={qData.type} onChange={e => updateQuestionField(index, 'type', e.target.value)} className="input-base" style={{ padding: '4px 8px', width: 'auto' }}>
                                            <option value="mcq">Multiple Choice</option>
                                            <option value="descriptive">Descriptive</option>
                                        </select>
                                        <select value={qData.level} onChange={e => updateQuestionField(index, 'level', e.target.value)} className="input-base" style={{ padding: '4px 8px', width: 'auto' }}>
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                </div>
                                <input type="text" required value={qData.q} onChange={e => updateQuestionPrompt(index, e.target.value)} className="input-base" placeholder="Enter Question Prompt" style={{ marginBottom: '1rem' }} />

                                {qData.type === 'mcq' ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {qData.options.map((opt, optIdx) => (
                                            <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: qData.correct === optIdx ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-dark)', borderRadius: '8px', border: qData.correct === optIdx ? '1px solid #10b981' : '1px solid transparent', transition: 'all 0.2s' }}>
                                                <input type="radio" id={`correct-${index}-${optIdx}`} name={`correctOpt-${index}`} required checked={qData.correct === optIdx} onChange={() => updateCorrectOption(index, optIdx)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                    <label htmlFor={`correct-${index}-${optIdx}`} style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, marginBottom: '6px', color: qData.correct === optIdx ? '#10b981' : 'var(--text-muted)' }}>
                                                        {qData.correct === optIdx ? '✓ Correct Answer' : 'Mark as correct'}
                                                    </label>
                                                    <input type="text" required value={opt} onChange={e => updateQuestionOption(index, optIdx, e.target.value)} className="input-base" placeholder={`Option ${optIdx + 1}`} style={{ width: '100%', background: 'rgba(0,0,0,0.2)' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Descriptive Answer Key (used for % matching):</label>
                                        <textarea disabled={!!newQuiz.generalAnswerKeyFile} required={!newQuiz.generalAnswerKeyFile && !qData.answerKeyFile} value={qData.answerKey} onChange={e => updateQuestionField(index, 'answerKey', e.target.value)} className="input-base" placeholder={!!newQuiz.generalAnswerKeyFile ? "Disabled since a general answer key is uploaded." : "Enter keywords or the ideal answer used evaluating the student's submission."} style={{ resize: 'vertical', minHeight: '60px', opacity: !!newQuiz.generalAnswerKeyFile ? 0.5 : 1 }} />

                                        {!newQuiz.generalAnswerKeyFile && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Or add a file as Answer Key for this specific question:</label>
                                                <input type="file" onChange={e => handleQuestionFileUpload(index, e.target.files[0])} className="input-base" style={{ padding: '4px', fontSize: '0.8rem' }} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '2rem', width: '200px' }}>
                        <Save size={18} /> Publish Quiz
                    </button>
                </form>
            )}

            <div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Active Quizzes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                    {quizzes.map(quiz => (
                        <div key={quiz.id} style={{ padding: '1.5rem', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ padding: '4px 12px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>{quiz.module}</span>
                                <Globe size={18} color="rgba(255,255,255,0.4)" />
                            </div>
                            <h4 style={{ fontSize: '1.2rem' }}>{quiz.title}</h4>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{quiz.questions ? quiz.questions.length : 0} Questions prepared for students.</p>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <button onClick={() => unpublish(quiz.id)} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Trash2 size={16} /> Unpublish/Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    {quizzes.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active quizzes available.</p>}
                </div>
            </div>
            <div style={{ marginTop: '3rem' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Mail size={24} color="var(--primary)" /> Student Quiz Submissions
                </h3>
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <th style={{ padding: '15px' }}>Student Email</th>
                                <th style={{ padding: '15px' }}>Quiz Title</th>
                                <th style={{ padding: '15px' }}>Module</th>
                                <th style={{ padding: '15px' }}>Score</th>
                                <th style={{ padding: '15px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attempts.map((attempt, idx) => (
                                <tr key={idx} style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                    <td style={{ padding: '15px', fontWeight: 500 }}>{attempt.student_email}</td>
                                    <td style={{ padding: '15px' }}>{attempt.quiz_title}</td>
                                    <td style={{ padding: '15px', color: 'var(--primary)' }}>{attempt.module}</td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
                                            {attempt.score}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <button onClick={() => handleSendMail(attempt)} style={{ background: 'transparent', color: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Mail size={16} /> Email Marks
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {attempts.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No quiz submissions found yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

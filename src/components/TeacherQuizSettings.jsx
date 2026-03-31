import { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Globe, Mail, FileUp, FileText } from 'lucide-react';
import API_BASE_URL from '../utils/api';
import { extractTextFromFile } from '../utils/documentUtils';

export default function TeacherQuizSettings() {
    const [quizzes, setQuizzes] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [quizMode, setQuizMode] = useState('objective');
    const [newQuiz, setNewQuiz] = useState({ title: '', module: 'Module 1', timeLimit: '30 mins', questionsCount: 5, showResultImmediately: true, generalAnswerKeyFile: null });
    const [questionPaperFile, setQuestionPaperFile] = useState(null);

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
    const [evaluatingAttemptId, setEvaluatingAttemptId] = useState(null);
    const [evaluationByAttempt, setEvaluationByAttempt] = useState({});
    const [finalScoreByAttempt, setFinalScoreByAttempt] = useState({});

    useEffect(() => {
        fetchQuizzes();
        fetchAttempts();
    }, []);

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
        fetch(`${API_BASE_URL}/admin/attempts`)
            .then(res => res.json())
            .then(data => setAttempts(data || []))
            .catch(err => console.error("Fetch attempts error:", err));
    };

    const fetchQuizzes = () => {
        fetch(`${API_BASE_URL}/quizzes`)
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
                    newData.push({
                        q: '',
                        type: quizMode === 'subjective' ? 'descriptive' : 'mcq',
                        level: 'medium',
                        options: ['', '', '', ''],
                        correct: 0,
                        answerKey: '',
                        answerKeyFile: null
                    });
                }
            } else if (count < prev.length) {
                newData.length = count;
            }
            return newData;
        });
    };

    const handleModeChange = (mode) => {
        const normalizedMode = mode === 'subjective' ? 'subjective' : 'objective';
        setQuizMode(normalizedMode);
        setNewQuiz(prev => ({
            ...prev,
            showResultImmediately: normalizedMode === 'subjective' ? false : prev.showResultImmediately
        }));

        setQuestionsData(prev => prev.map(question => ({
            ...question,
            type: normalizedMode === 'subjective' ? 'descriptive' : 'mcq'
        })));
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

    const handleCreate = async (e) => {
        e.preventDefault();

        // Validation
        for (let i = 0; i < questionsData.length; i++) {
            const qData = questionsData[i];
            if (!qData.q.trim()) {
                alert(`Please enter a prompt for Question ${i + 1}.`);
                return;
            }

            if (quizMode === 'objective' && qData.options.some(o => !o.trim())) {
                alert(`Please complete all options in Question ${i + 1} before publishing.`);
                return;
            }

            if (quizMode === 'subjective' && !qData.answerKey.trim() && !qData.answerKeyFile && !newQuiz.generalAnswerKeyFile) {
                alert(`Please complete the descriptive answer key for Question ${i + 1} or upload a file.`);
                return;
            }
        }

        const normalizedQuestions = questionsData.map((question) => {
            if (quizMode === 'objective') {
                return {
                    ...question,
                    type: 'mcq',
                    answerKey: '',
                    answerKeyFile: null
                };
            }

            return {
                ...question,
                type: 'descriptive',
                correct: 0,
                options: ['', '', '', '']
            };
        });

        const created = {
            title: newQuiz.title,
            module: newQuiz.module,
            timeLimit: newQuiz.timeLimit,
            quizType: quizMode,
            questions: normalizedQuestions,
            showResultImmediately: quizMode === 'subjective' ? false : newQuiz.showResultImmediately
        };

        if (questionPaperFile && !questionPaperFile.name.toLowerCase().endsWith('.pdf')) {
            alert('Question paper must be a PDF file.');
            return;
        }

        if (questionPaperFile && questionPaperFile.size > 20 * 1024 * 1024) {
            alert('Question paper must be under 20MB.');
            return;
        }

        const formData = new FormData();
        formData.append('title', created.title);
        formData.append('module', created.module);
        formData.append('timeLimit', created.timeLimit);
        formData.append('quizType', created.quizType);
        formData.append('questions', JSON.stringify(created.questions));
        formData.append('showResultImmediately', String(created.showResultImmediately));
        if (questionPaperFile) {
            formData.append('questionPaper', questionPaperFile);
        }

        try {
            const res = await fetch(`${API_BASE_URL}/quizzes`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setQuizzes(prev => [data, ...prev]);
            setIsCreating(false);
            setQuizMode('objective');
            setQuestionPaperFile(null);
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
            alert('Quiz published successfully!');
        } catch (err) {
            console.error('Failed to publish quiz:', err);
            alert('Failed to publish quiz: ' + err.message);
        }
    };

    const unpublish = (id) => {
        fetch(`${API_BASE_URL}/quizzes/${id}`, { method: 'DELETE' })
            .then(() => setQuizzes(prev => prev.filter(q => q.id !== id)));
    };

    const handleSendMail = (attempt) => {
        const mailtoLink = `mailto:${attempt.student_email}?subject=Your Quiz Result&body=Hello,\n\nYou have taken the quiz "${attempt.quiz_title}" and scored: ${attempt.score}.\n\nBest Regards,\nTeacher`;
        window.location.href = mailtoLink;
    };

    const handleEvaluateAttempt = async (attemptId) => {
        try {
            setEvaluatingAttemptId(attemptId);
            const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/evaluate-ai`, { method: 'POST' });
            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || 'AI evaluation failed.');
            }

            setEvaluationByAttempt(prev => ({ ...prev, [attemptId]: data }));
            setFinalScoreByAttempt(prev => ({ ...prev, [attemptId]: String(Math.round(data.recommendedScore)) }));
            fetchAttempts();
        } catch (error) {
            alert(error.message || 'Failed to run AI evaluation.');
        } finally {
            setEvaluatingAttemptId(null);
        }
    };

    const handleFinalizeScore = async (attemptId) => {
        const value = Number(finalScoreByAttempt[attemptId]);
        if (!Number.isFinite(value)) {
            alert('Please enter a valid score between 0 and 100.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/finalize-score`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalScore: value })
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to finalize score.');
            }

            fetchAttempts();
            alert('Final score saved and visible to student.');
        } catch (error) {
            alert(error.message || 'Failed to save score.');
        }
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

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => handleModeChange('objective')}
                                style={{
                                    flex: 1,
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: quizMode === 'objective' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: quizMode === 'objective' ? 'rgba(99, 102, 241, 0.16)' : 'var(--bg-dark)',
                                    color: 'var(--text-main)'
                                }}
                            >
                                Objective Quiz
                            </button>
                            <button
                                type="button"
                                onClick={() => handleModeChange('subjective')}
                                style={{
                                    flex: 1,
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: quizMode === 'subjective' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: quizMode === 'subjective' ? 'rgba(99, 102, 241, 0.16)' : 'var(--bg-dark)',
                                    color: 'var(--text-main)'
                                }}
                            >
                                Subjective Quiz
                            </button>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload Question Paper (PDF, optional)</label>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input type="file" accept=".pdf,application/pdf" onChange={e => setQuestionPaperFile(e.target.files?.[0] || null)} style={{ display: 'none' }} id="quizQuestionPaperInput" />
                                <label htmlFor="quizQuestionPaperInput" className="input-base" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-dark)' }}>
                                    <FileUp size={18} color="var(--primary)" />
                                    {questionPaperFile ? questionPaperFile.name : 'Choose PDF question paper...'}
                                </label>
                                {questionPaperFile && (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            setQuestionPaperFile(null);
                                            const input = document.getElementById('quizQuestionPaperInput');
                                            if (input) input.value = '';
                                        }}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444', padding: '4px' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    id="showResultOption"
                                    checked={newQuiz.showResultImmediately}
                                    onChange={e => setNewQuiz({ ...newQuiz, showResultImmediately: e.target.checked })}
                                    disabled={quizMode === 'subjective'}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="showResultOption" style={{ cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                    {quizMode === 'subjective'
                                        ? 'Disabled for subjective quizzes. Teacher finalizes marks after AI evaluation.'
                                        : 'Show result to student immediately after completing.'}
                                </label>
                            </div>
                            <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px', minWidth: '300px', opacity: quizMode === 'subjective' ? 1 : 0.5 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload General Answer Key (Docx/PDF)</label>
                                <input type="file" accept=".pdf,.docx" onChange={handleGeneralFileChange} className="input-base" style={{ padding: '6px', fontSize: '0.85rem' }} disabled={quizMode !== 'subjective'} />
                                <p style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>*Optional: Attach a general key document. You can still edit per-question answer keys below.</p>
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
                                        <span className="input-base" style={{ padding: '6px 10px', width: 'auto', fontSize: '0.85rem', background: 'var(--bg-dark)' }}>
                                            {quizMode === 'objective' ? 'Objective (MCQ)' : 'Subjective (Descriptive)'}
                                        </span>
                                        <select value={qData.level} onChange={e => updateQuestionField(index, 'level', e.target.value)} className="input-base" style={{ padding: '4px 8px', width: 'auto' }}>
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                </div>
                                <input type="text" required value={qData.q} onChange={e => updateQuestionPrompt(index, e.target.value)} className="input-base" placeholder="Enter Question Prompt" style={{ marginBottom: '1rem' }} />

                                {quizMode === 'objective' ? (
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
                                        <textarea required={!qData.answerKeyFile && !newQuiz.generalAnswerKeyFile} value={qData.answerKey} onChange={e => updateQuestionField(index, 'answerKey', e.target.value)} className="input-base" placeholder="Enter keywords or the ideal answer used for evaluating the student's submission." style={{ resize: 'vertical', minHeight: '60px' }} />

                                        <div style={{ marginTop: '0.5rem' }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Or add a file as answer key for this specific question:</label>
                                            <input type="file" onChange={e => handleQuestionFileUpload(index, e.target.files[0])} className="input-base" style={{ padding: '4px', fontSize: '0.8rem' }} />
                                        </div>
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
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mode: {quiz.quizType === 'subjective' ? 'Subjective' : 'Objective'}</p>
                            {quiz.questionPaperName && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FileText size={14} color="var(--primary)" /> Question Paper: {quiz.questionPaperName}
                                </p>
                            )}

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
                                <th style={{ padding: '15px' }}>Eval Status</th>
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
                                    <td style={{ padding: '15px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{attempt.evaluationStatus || 'completed'}</td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {attempt.quizType === 'subjective' && attempt.evaluationStatus !== 'completed' && (
                                                <>
                                                    <button
                                                        onClick={() => handleEvaluateAttempt(attempt.id)}
                                                        disabled={evaluatingAttemptId === attempt.id}
                                                        style={{ background: 'transparent', color: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        {evaluatingAttemptId === attempt.id ? 'Evaluating...' : 'Run AI Evaluation (2 models)'}
                                                    </button>

                                                    {evaluationByAttempt[attempt.id] && (
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span>Model 1: {evaluationByAttempt[attempt.id].model1Score}%</span>
                                                            <span>Model 2: {evaluationByAttempt[attempt.id].model2Score}%</span>
                                                            <span>Recommended: {evaluationByAttempt[attempt.id].recommendedScore}%</span>
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            placeholder="Final %"
                                                            className="input-base"
                                                            style={{ padding: '6px 8px', width: '92px' }}
                                                            value={finalScoreByAttempt[attempt.id] || ''}
                                                            onChange={event => setFinalScoreByAttempt(prev => ({ ...prev, [attempt.id]: event.target.value }))}
                                                        />
                                                        <button onClick={() => handleFinalizeScore(attempt.id)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                                                            Finalize
                                                        </button>
                                                    </div>
                                                </>
                                            )}

                                            <button onClick={() => handleSendMail(attempt)} style={{ background: 'transparent', color: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Mail size={16} /> Email Marks
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {attempts.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No quiz submissions found yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

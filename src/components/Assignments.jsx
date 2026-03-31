import { useState, useEffect } from 'react';
import { Plus, Save, Upload, Download, FileText, CheckCircle, Clock, Users, X, AlertCircle, Trash2, TrendingUp } from 'lucide-react';
import API_BASE_URL from '../utils/api';
import { extractTextFromFile, isPdfOrDocx } from '../utils/documentUtils';

export default function Assignments({ role }) {
    const [assignments, setAssignments] = useState([]);
    const [isCreating, setIsCreating] = useState(false);

    // Create Assignment State (Teacher)
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [teacherFile, setTeacherFile] = useState(null);
    const [answerKeyFile, setAnswerKeyFile] = useState(null);
    const [savingSettingsId, setSavingSettingsId] = useState(null);
    const [evaluatingAssignmentId, setEvaluatingAssignmentId] = useState(null);

    const [difficultySettings, setDifficultySettings] = useState({});
    const [targetSettings, setTargetSettings] = useState({});
    const [answerKeyDraft, setAnswerKeyDraft] = useState({});
    const [answerKeyUpload, setAnswerKeyUpload] = useState({});

    // Student Upload State
    const [activeAssignmentId, setActiveAssignmentId] = useState(null);
    const [studentFile, setStudentFile] = useState(null);
    const [uploadError, setUploadError] = useState('');

    // Curve Grading state
    const [curveSettings, setCurveSettings] = useState({});

    const currentUserEmail = localStorage.getItem('eschool_current_user') || 'anonymous_student';
    const apiBaseOrigin = API_BASE_URL.replace('/api', '');

    const readJsonSafely = async (response) => {
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        try {
            return text ? JSON.parse(text) : {};
        } catch (_err) {
            const looksLikeHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || contentType.includes('text/html');
            if (looksLikeHtml) {
                return { error: 'Backend API returned HTML instead of JSON. Set VITE_API_BASE_URL to your backend URL and redeploy.' };
            }
            return { error: text || 'Unexpected server response.' };
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchAssignments = () => {
        fetch(`${API_BASE_URL}/assignments`)
            .then(readJsonSafely)
            .then(data => {
                if (!Array.isArray(data)) {
                    throw new Error(data?.error || 'Failed to load assignments.');
                }
                setAssignments(data);
                setDifficultySettings(prev => {
                    const next = { ...prev };
                    data.forEach((assignment) => {
                        if (!next[assignment.id]) {
                            next[assignment.id] = assignment.difficulty || 'easy';
                        }
                    });
                    return next;
                });
                setTargetSettings(prev => {
                    const next = { ...prev };
                    data.forEach((assignment) => {
                        if (!next[assignment.id] && assignment.targetMatch) {
                            next[assignment.id] = String(assignment.targetMatch);
                        }
                    });
                    return next;
                });
                setAnswerKeyDraft(prev => {
                    const next = { ...prev };
                    data.forEach((assignment) => {
                        if (!next[assignment.id] && assignment.answerKeyText) {
                            next[assignment.id] = assignment.answerKeyText;
                        }
                    });
                    return next;
                });
            })
            .catch(err => console.error("Fetch assignments error:", err));
    };

    // --- TEACHER ACTIONS ---
    const handleTeacherFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setTeacherFile(e.target.files[0]);
        }
    };

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return;

        let answerKeyText = '';
        if (answerKeyFile) {
            answerKeyText = await extractTextFromFile(answerKeyFile);
        }

        const formData = new FormData();
        formData.append('title', newTitle.trim());
        formData.append('description', newDesc.trim());
        formData.append('dueDate', newDueDate || '');
        formData.append('answerKeyText', answerKeyText || '');

        if (teacherFile) {
            formData.append('questionPaper', teacherFile);
        }
        if (answerKeyFile) {
            formData.append('answerKey', answerKeyFile);
        }

        fetch(`${API_BASE_URL}/assignments`, {
            method: 'POST',
            body: formData
        })
            .then(readJsonSafely)
            .then(data => {
                if (data.error) throw new Error(data.error);
                setAssignments(prev => [data, ...prev]);
                setIsCreating(false);
                setNewTitle('');
                setNewDesc('');
                setNewDueDate('');
                setTeacherFile(null);
                setAnswerKeyFile(null);
            })
            .catch(error => {
                alert(error.message || 'Failed to create assignment.');
            });
    };

    const deleteAssignment = (id) => {
        fetch(`${API_BASE_URL}/assignments/${id}`, { method: 'DELETE' })
            .then(() => setAssignments(prev => prev.filter(a => a.id !== id)));
    };

    // --- STUDENT ACTIONS ---
    const handleStudentFileChange = (e) => {
        setUploadError('');
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const isValidExt = isPdfOrDocx(file.name);
            const isUnder40MB = file.size <= 40 * 1024 * 1024;

            if (!isValidExt) {
                setUploadError('Invalid file type. Only .pdf and .docx are allowed.');
                setStudentFile(null);
                return;
            }
            if (!isUnder40MB) {
                setUploadError('File exceeds 40MB limit.');
                setStudentFile(null);
                return;
            }

            setStudentFile(file);
        }
    };

    const handeSubmitAssignment = async (assignmentId) => {
        if (!studentFile) {
            setUploadError('Please select a file to upload.');
            return;
        }

        const assignment = assignments.find(a => a.id === assignmentId);
        if (!assignment) return;

        const now = new Date();
        const due = assignment.dueDate ? new Date(assignment.dueDate) : null;
        const hasDueDate = due && !Number.isNaN(due.getTime());
        const isLate = hasDueDate ? now > due : false;
        const status = isLate ? 'Late Submitted' : 'Submitted in time';

        const extractedText = await extractTextFromFile(studentFile);

        const formData = new FormData();
        formData.append('studentEmail', currentUserEmail);
        formData.append('status', status);
        formData.append('submissionText', extractedText);
        formData.append('submissionFile', studentFile);

        fetch(`${API_BASE_URL}/assignments/${assignmentId}/submit`, {
            method: 'PATCH',
            body: formData
        })
            .then(readJsonSafely)
            .then(data => {
                if (data.error) throw new Error(data.error);
                fetchAssignments();
                setStudentFile(null);
                setActiveAssignmentId(null);
            })
            .catch(error => {
                setUploadError(error.message || 'Failed to submit assignment.');
            });
    };

    const saveAssignmentSettings = async (assignmentId) => {
        const answerKeyText = answerKeyDraft[assignmentId] || '';
        const difficulty = difficultySettings[assignmentId] || 'easy';
        const targetMatch = targetSettings[assignmentId] || '';
        const keyFile = answerKeyUpload[assignmentId] || null;

        const formData = new FormData();
        formData.append('difficulty', difficulty);
        formData.append('targetMatch', targetMatch);
        formData.append('answerKeyText', answerKeyText);
        if (keyFile) {
            formData.append('answerKey', keyFile);
        }

        try {
            setSavingSettingsId(assignmentId);
            const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/settings`, {
                method: 'PATCH',
                body: formData
            });
            const data = await readJsonSafely(response);
            if (!response.ok || data.error) {
                throw new Error(data.error || 'Failed to save settings.');
            }

            setAnswerKeyUpload(prev => ({ ...prev, [assignmentId]: null }));
            fetchAssignments();
        } catch (error) {
            alert(error.message || 'Failed to save assignment settings.');
        } finally {
            setSavingSettingsId(null);
        }
    };

    const runBulkEvaluation = async (assignmentId) => {
        const difficulty = difficultySettings[assignmentId] || 'easy';
        const targetMatch = targetSettings[assignmentId] || '';

        try {
            setEvaluatingAssignmentId(assignmentId);
            const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/evaluate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ difficulty, targetMatch })
            });
            const data = await readJsonSafely(response);
            if (!response.ok || data.error) {
                throw new Error(data.error || 'Evaluation failed.');
            }

            fetchAssignments();
            alert(`Evaluated ${data.evaluatedCount} submission(s) using external AI models. Best model was used per student.`);
        } catch (error) {
            alert(error.message || 'Failed to evaluate submissions.');
        } finally {
            setEvaluatingAssignmentId(null);
        }
    };

    const handleCurveSettingChange = (assignmentId, val) => {
        setCurveSettings(prev => ({ ...prev, [assignmentId]: val }));
    };

    const exportCurvedGradesCSV = (assignment) => {
        if (!assignment.submissions.length) {
            alert('No submissions available for export.');
            return;
        }
        const maxScore = parseFloat(curveSettings[assignment.id]);
        if (isNaN(maxScore) || maxScore <= 0) {
            alert("Please enter a valid max score for the top student.");
            return;
        }

        let mapped = assignment.submissions.map(sub => {
            const pct = Number(sub.bestMatch ?? sub.aiModel1Match ?? sub.aiModel2Match ?? 0);
            return { ...sub, rawMatchPct: pct };
        });

        // Identify highest raw score
        const topMatch = Math.max(...mapped.map(s => s.rawMatchPct), 0);

        // Build CSV text
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Student Email,Submission Time,Status,Raw Keyword Match %,Curved Final Score\n";

        mapped.forEach(sub => {
            let curved = topMatch > 0 ? (sub.rawMatchPct / topMatch) * maxScore : 0;
            // Cap it at maxScore just in case
            curved = Math.min(curved, maxScore);
            csvContent += `${sub.studentEmail},${new Date(sub.submittedAt).toLocaleString().replace(/,/g, '')},${sub.status},${sub.rawMatchPct.toFixed(2)}%,${curved.toFixed(2)}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Curved_Grades_${assignment.title.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link); // Required for FF
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="glass-panel" style={{ height: '100%', padding: '2.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Assignments Workspace</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{role === 'teacher' ? 'Distribute materials and collect submissions.' : 'View your assignments and upload your work.'}</p>
                </div>
                {role === 'teacher' && (
                    <button onClick={() => setIsCreating(!isCreating)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isCreating ? <><X size={20} /> Cancel</> : <><Plus size={20} /> Create Assignment</>}
                    </button>
                )}
            </div>

            {isCreating && role === 'teacher' && (
                <form onSubmit={handleCreateAssignment} style={{ padding: '2rem', background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>Draft New Assignment</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Assignment Title</label>
                            <input type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)} className="input-base" placeholder="e.g. Build a Web Server" />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Description</label>
                            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="input-base" placeholder="Optional instructions for students..." style={{ resize: 'vertical', minHeight: '80px' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload Question Paper (PDF/Docx)</label>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <input type="file" accept=".pdf,.docx" onChange={handleTeacherFileChange} style={{ display: 'none' }} id="teacherFileInput" />
                                    <label htmlFor="teacherFileInput" className="input-base" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-dark)' }}>
                                        <Upload size={18} color="var(--primary)" />
                                        {teacherFile ? teacherFile.name : 'Choose question paper...'}
                                    </label>
                                    {teacherFile && (
                                        <button type="button" onClick={(e) => { e.preventDefault(); setTeacherFile(null); document.getElementById('teacherFileInput').value = ''; }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444', padding: '4px' }}>
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload Answer Key (For Auto-Grading)</label>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <input type="file" accept=".pdf,.docx" onChange={e => setAnswerKeyFile(e.target.files[0])} style={{ display: 'none' }} id="answerKeyInput" />
                                    <label htmlFor="answerKeyInput" className="input-base" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                        <CheckCircle size={18} color="#10b981" />
                                        {answerKeyFile ? answerKeyFile.name : 'Provide Answer Key...'}
                                    </label>
                                    {answerKeyFile && (
                                        <button type="button" onClick={(e) => { e.preventDefault(); setAnswerKeyFile(null); document.getElementById('answerKeyInput').value = ''; }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444', padding: '4px' }}>
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '0.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Due Date & Time (Optional)</label>
                            <input type="datetime-local" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="input-base" style={{ background: 'var(--bg-dark)', colorScheme: 'dark' }} />
                        </div>

                        <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem', width: '200px' }}>
                            <Save size={18} /> Publish Assignment
                        </button>
                    </div>
                </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {assignments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <FileText size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                        <p>No assignments have been posted yet.</p>
                    </div>
                ) : (
                    assignments.map(assignment => {
                        const dueDateObj = assignment.dueDate ? new Date(assignment.dueDate) : null;
                        const hasDue = dueDateObj && !Number.isNaN(dueDateObj.getTime());
                        const formattedDate = hasDue ? dueDateObj.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'No due date';

                        // Student specific vars
                        const studentSubmission = role === 'student' ? assignment.submissions.find(s => s.studentEmail === currentUserEmail) : null;
                        const isPastDue = hasDue ? new Date() > dueDateObj : false;

                        return (
                            <div key={assignment.id} style={{ padding: '1.5rem', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {assignment.title}
                                            {role === 'teacher' && (
                                                <button onClick={() => deleteAssignment(assignment.id)} title="Delete entire assignment" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                                    <Trash2 size={14} /> Remove Setup
                                                </button>
                                            )}
                                        </h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>{assignment.description || 'No description provided.'}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: isPastDue ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: isPastDue ? '#ef4444' : '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                                        <Clock size={16} /> Due: {formattedDate}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {assignment.questionPaperUrl && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <a href={`${apiBaseOrigin}${assignment.questionPaperUrl}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.9rem', textDecoration: 'none' }}>
                                                <Download size={16} /> Download Question Paper: {assignment.questionPaperName || 'Attachment'}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* TEACHER VIEW: SHOW SUBMISSIONS */}
                                {role === 'teacher' && (
                                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                                            <Users size={18} /> Student Submissions ({assignment.submissions.length})
                                        </h4>

                                        <div style={{ marginBottom: '1rem', padding: '12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Difficulty (set manually)</label>
                                                    <select value={difficultySettings[assignment.id] || assignment.difficulty || 'easy'} onChange={event => setDifficultySettings(prev => ({ ...prev, [assignment.id]: event.target.value }))} className="input-base" style={{ background: 'var(--bg-dark)', padding: '8px' }}>
                                                        <option value="easy">Easy</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="hard">Hard</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Threshold % for max marks</label>
                                                    <input type="number" min="1" max="100" value={targetSettings[assignment.id] || assignment.targetMatch || ''} onChange={event => setTargetSettings(prev => ({ ...prev, [assignment.id]: event.target.value }))} className="input-base" placeholder="Auto by difficulty" style={{ background: 'var(--bg-dark)', padding: '8px' }} />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Answer Key File (optional)</label>
                                                    <input type="file" accept=".pdf,.docx" onChange={event => setAnswerKeyUpload(prev => ({ ...prev, [assignment.id]: event.target.files?.[0] || null }))} className="input-base" style={{ padding: '6px' }} />
                                                </div>
                                            </div>

                                            <textarea value={answerKeyDraft[assignment.id] ?? assignment.answerKeyText ?? ''} onChange={event => setAnswerKeyDraft(prev => ({ ...prev, [assignment.id]: event.target.value }))} className="input-base" placeholder="Paste or edit answer key text here (optional at creation, can be set now)." style={{ minHeight: '80px', resize: 'vertical', marginBottom: '8px' }} />

                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <button onClick={() => saveAssignmentSettings(assignment.id)} className="btn-primary" style={{ padding: '7px 12px', fontSize: '0.85rem' }} disabled={savingSettingsId === assignment.id}>
                                                    {savingSettingsId === assignment.id ? 'Saving...' : 'Save Evaluation Settings'}
                                                </button>
                                                <button onClick={() => runBulkEvaluation(assignment.id)} className="btn-primary" style={{ padding: '7px 12px', fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981' }} disabled={evaluatingAssignmentId === assignment.id}>
                                                    {evaluatingAssignmentId === assignment.id ? 'Evaluating...' : 'Evaluate All Submissions (2 AI models + best score)'}
                                                </button>
                                                {assignment.answerKeyUrl && (
                                                    <a href={`${apiBaseOrigin}${assignment.answerKeyUrl}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'none' }}>
                                                        Download Answer Key File
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {assignment.submissions.length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No submissions yet.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {assignment.answerKeyText && assignment.submissions.length > 0 && (
                                                    <div style={{ padding: '15px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '0.5rem' }}>
                                                        <h5 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                                                            <TrendingUp size={16} /> Relative Curve Grading
                                                        </h5>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <input type="number" value={curveSettings[assignment.id] || ''} onChange={(e) => handleCurveSettingChange(assignment.id, e.target.value)} placeholder="Marks for top student (e.g. 100)" className="input-base" style={{ padding: '8px 12px', background: 'var(--bg-dark)' }} />
                                                            </div>
                                                            <button onClick={() => exportCurvedGradesCSV(assignment)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Download size={14} /> Export Marks (CSV)
                                                            </button>
                                                        </div>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>The system uses external AI match scores, assigns top marks to highest match, and distributes relative proportional marks.</p>
                                                    </div>
                                                )}

                                                {assignment.submissions.map((sub, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{sub.studentEmail}</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                                                                {sub.fileUrl ? (
                                                                    <a href={`${apiBaseOrigin}${sub.fileUrl}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                                                        <Download size={14} /> {sub.fileName || 'Download Submission'}
                                                                    </a>
                                                                ) : (
                                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{sub.fileName || 'No file attached'}</span>
                                                                )}
                                                                {assignment.answerKeyText && sub.submissionText && (
                                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                                        Use "Evaluate All Submissions" for external AI scoring.
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {(sub.aiModel1Match !== null || sub.aiModel2Match !== null || sub.bestMatch !== null) && (
                                                                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                                    <span>AI-1: {sub.aiModel1Match ?? 'N/A'}%</span>
                                                                    <span>AI-2: {sub.aiModel2Match ?? 'N/A'}%</span>
                                                                    <span>Best: {sub.bestMatch ?? 'N/A'}%</span>
                                                                    <span style={{ color: '#10b981', fontWeight: 600 }}>Marks: {sub.finalScorePct ?? 'N/A'}%</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(sub.submittedAt).toLocaleString()}</span>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: sub.status === 'Submitted in time' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: sub.status === 'Submitted in time' ? '#10b981' : '#ef4444' }}>
                                                                {sub.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* STUDENT VIEW: UPLOAD SUBMISSION */}
                                {role === 'student' && (
                                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        {studentSubmission ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <div>
                                                        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                            <CheckCircle size={18} /> You've submitted this assignment.
                                                        </p>
                                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Attached: {studentSubmission.fileName}</p>
                                                    </div>
                                                    <button onClick={() => { setActiveAssignmentId(assignment.id); setStudentFile(null); }} title="Remove attached document and re-upload" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Trash2 size={16} /> Replace Work
                                                    </button>
                                                </div>
                                                <span style={{ padding: '6px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600, background: studentSubmission.status === 'Submitted in time' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: studentSubmission.status === 'Submitted in time' ? '#10b981' : '#ef4444' }}>
                                                    {studentSubmission.status}
                                                </span>
                                            </div>
                                        ) : (
                                            <div>
                                                {activeAssignmentId === assignment.id ? (
                                                    <div style={{ padding: '1.5rem', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                                        <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Upload your work</h4>
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Max file size: 40MB. Accepted formats: .docx, .pdf</p>

                                                        <input type="file" onChange={handleStudentFileChange} accept=".pdf,.docx" style={{ display: 'none' }} id={`studentUpload-${assignment.id}`} />
                                                        <label htmlFor={`studentUpload-${assignment.id}`} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                                                            <Upload size={18} /> {studentFile ? studentFile.name : 'Choose File...'}
                                                        </label>

                                                        {uploadError && (
                                                            <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fca5a5', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                                                <AlertCircle size={16} /> {uploadError}
                                                            </p>
                                                        )}

                                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                                            <button onClick={() => { setActiveAssignmentId(null); setStudentFile(null); setUploadError(''); }} style={{ color: 'var(--text-muted)', padding: '8px 16px' }}>Cancel</button>
                                                            <button onClick={() => handeSubmitAssignment(assignment.id)} className="btn-primary" disabled={!studentFile}>Confirm Submission</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setActiveAssignmentId(assignment.id)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Upload size={18} /> Submit Assignment
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Plus, Save, Upload, Download, FileText, CheckCircle, Clock, Users, X, AlertCircle, Trash2 } from 'lucide-react';

export default function Assignments({ role }) {
    const [assignments, setAssignments] = useState([]);
    const [isCreating, setIsCreating] = useState(false);

    // Create Assignment State (Teacher)
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [teacherFile, setTeacherFile] = useState(null);

    // Student Upload State
    const [activeAssignmentId, setActiveAssignmentId] = useState(null);
    const [studentFile, setStudentFile] = useState(null);
    const [uploadError, setUploadError] = useState('');

    const currentUserEmail = localStorage.getItem('eschool_current_user') || 'anonymous_student';

    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchAssignments = () => {
        fetch('http://localhost:5000/api/assignments')
            .then(res => res.json())
            .then(data => setAssignments(data))
            .catch(err => console.error("Fetch assignments error:", err));
    };

    // --- TEACHER ACTIONS ---
    const handleTeacherFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setTeacherFile(e.target.files[0]);
        }
    };

    const handleCreateAssignment = (e) => {
        e.preventDefault();
        if (!newTitle || !newDueDate) return;

        const newAssignment = {
            title: newTitle,
            description: newDesc,
            dueDate: newDueDate,
            fileName: teacherFile ? teacherFile.name : null
        };

        fetch('http://localhost:5000/api/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAssignment)
        })
            .then(res => res.json())
            .then(data => {
                setAssignments([data, ...assignments]);
                setIsCreating(false);
                setNewTitle('');
                setNewDesc('');
                setNewDueDate('');
                setTeacherFile(null);
            });
    };

    const deleteAssignment = (id) => {
        fetch(`http://localhost:5000/api/assignments/${id}`, { method: 'DELETE' })
            .then(() => setAssignments(assignments.filter(a => a.id !== id)));
    };

    // --- STUDENT ACTIONS ---
    const handleStudentFileChange = (e) => {
        setUploadError('');
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const ext = file.name.split('.').pop().toLowerCase();
            const isValidExt = ext === 'pdf' || ext === 'docx';
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

    const handeSubmitAssignment = (assignmentId) => {
        if (!studentFile) {
            setUploadError('Please select a file to upload.');
            return;
        }

        const assignment = assignments.find(a => a.id === assignmentId);
        if (!assignment) return;

        const now = new Date();
        const due = new Date(assignment.dueDate);
        const isLate = now > due;
        const status = isLate ? 'Late Submitted' : 'Submitted in time';

        const newSubmission = {
            studentEmail: currentUserEmail,
            fileName: studentFile.name,
            submittedAt: now.toISOString(),
            status: status
        };

        fetch(`http://localhost:5000/api/assignments/${assignmentId}/submit`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submission: newSubmission })
        })
            .then(() => {
                fetchAssignments();
                setStudentFile(null);
                setActiveAssignmentId(null);
            });
    };

    const downloadMock = (fileName) => {
        alert(`Downloading ${fileName}... (Simulated)`);
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
                            <textarea required value={newDesc} onChange={e => setNewDesc(e.target.value)} className="input-base" placeholder="Provide instructions for the students..." style={{ resize: 'vertical', minHeight: '80px' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload Attachment (Optional)</label>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <input type="file" onChange={handleTeacherFileChange} style={{ display: 'none' }} id="teacherFileInput" />
                                    <label htmlFor="teacherFileInput" className="input-base" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-dark)' }}>
                                        <Upload size={18} color="var(--primary)" />
                                        {teacherFile ? teacherFile.name : 'Choose file...'}
                                    </label>
                                    {teacherFile && (
                                        <button type="button" onClick={(e) => { e.preventDefault(); setTeacherFile(null); document.getElementById('teacherFileInput').value = ''; }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444', padding: '4px' }}>
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Due Date & Time</label>
                                <input type="datetime-local" required value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="input-base" style={{ background: 'var(--bg-dark)', colorScheme: 'dark' }} />
                            </div>
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
                        const dueDateObj = new Date(assignment.dueDate);
                        const formattedDate = dueDateObj.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

                        // Student specific vars
                        const studentSubmission = role === 'student' ? assignment.submissions.find(s => s.studentEmail === currentUserEmail) : null;
                        const isPastDue = new Date() > dueDateObj;

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
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>{assignment.description}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: isPastDue ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: isPastDue ? '#ef4444' : '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                                        <Clock size={16} /> Due: {formattedDate}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {assignment.fileName && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button onClick={() => downloadMock(assignment.fileName)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.9rem' }}>
                                                <Download size={16} /> Download Attachment: {assignment.fileName}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* TEACHER VIEW: SHOW SUBMISSIONS */}
                                {role === 'teacher' && (
                                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                                            <Users size={18} /> Student Submissions ({assignment.submissions.length})
                                        </h4>
                                        {assignment.submissions.length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No submissions yet.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {assignment.submissions.map((sub, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{sub.studentEmail}</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                                <button onClick={() => downloadMock(sub.fileName)} style={{ color: 'var(--primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Download size={14} /> {sub.fileName}
                                                                </button>
                                                            </div>
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

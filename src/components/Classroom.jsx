import React, { useState, useEffect } from 'react';
import './Classroom.css';

const Classroom = ({ currentUserEmail, userRole, userName }) => {
    const [classrooms, setClassrooms] = useState([]);
    const [activeClassroom, setActiveClassroom] = useState(null);
    const [newClassName, setNewClassName] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [view, setView] = useState('list'); // 'list' or 'details'
    const [tab, setTab] = useState('assignments'); // 'assignments', 'students', 'todos'

    // Form states
    const [studentEmail, setStudentEmail] = useState('');
    const [assignTitle, setAssignTitle] = useState('');
    const [assignDue, setAssignDue] = useState('');
    const [assignFile, setAssignFile] = useState(null);
    const [todoText, setTodoText] = useState('');
    const [todoDue, setTodoDue] = useState('');
    
    // Data states
    const [assignments, setAssignments] = useState([]);
    const [students, setStudents] = useState([]);
    const [todos, setTodos] = useState([]);
    const [submissions, setSubmissions] = useState({}); // {assignId: [list]}
    const [gradingMarks, setGradingMarks] = useState({}); // {subId: marks}
    const [assignmentStats, setAssignmentStats] = useState({}); // {assignId: stats}

    useEffect(() => {
        fetchClassrooms();
    }, [currentUserEmail]);

    useEffect(() => {
        if (activeClassroom) {
            fetchClassroomData();
        }
    }, [activeClassroom, tab]);

    // Auto-refresh submissions and stats for dynamic updates
    useEffect(() => {
        if (activeClassroom && tab === 'assignments' && userRole === 'teacher') {
            const refreshInterval = setInterval(() => {
                assignments.forEach(a => {
                    fetchSubmissions(a.id);
                    fetchAssignmentStats(a.id);
                });
            }, 3000); // Refresh every 3 seconds
            return () => clearInterval(refreshInterval);
        }
    }, [activeClassroom, tab, userRole, assignments]);

    const fetchClassrooms = () => {
        fetch(`http://localhost:5000/api/classrooms?email=${encodeURIComponent(currentUserEmail)}`)
            .then(res => res.json())
            .then(data => setClassrooms(data || []));
    };

    const fetchClassroomData = () => {
        if (tab === 'assignments') {
            fetch(`http://localhost:5000/api/classrooms/${activeClassroom.id}/assignments`)
                .then(res => res.json())
                .then(data => {
                    setAssignments(data || []);
                    data.forEach(a => {
                        fetchSubmissions(a.id);
                        if (userRole === 'teacher') {
                            fetchAssignmentStats(a.id);
                        }
                    });
                });
        } else if (tab === 'students') {
            fetch(`http://localhost:5000/api/classrooms/${activeClassroom.id}/students`)
                .then(res => res.json())
                .then(data => setStudents(data || []));
        } else if (tab === 'todos') {
            fetch(`http://localhost:5000/api/classrooms/${activeClassroom.id}/todos`)
                .then(res => res.json())
                .then(data => setTodos(data || []));
        }
    };

    const fetchSubmissions = (assignId) => {
        fetch(`http://localhost:5000/api/assignments/${assignId}/submissions`)
            .then(res => res.json())
            .then(data => {
                setSubmissions(prev => ({ ...prev, [assignId]: data || [] }));
            })
            .catch(err => console.error(`Error fetching submissions for assignment ${assignId}:`, err));
    };

    const fetchAssignmentStats = (assignId) => {
        fetch(`http://localhost:5000/api/assignments/${assignId}/statistics`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                console.log(`Stats loaded for assignment ${assignId}:`, data);
                setAssignmentStats(prev => ({ ...prev, [assignId]: data }));
            })
            .catch(err => {
                console.error(`Error fetching stats for assignment ${assignId}:`, err);
                // Set default stats so component knows data was attempted
                setAssignmentStats(prev => ({ ...prev, [assignId]: { count: 0, average: 0, highest: 0, lowest: 0, median: 0 } }));
            });
    };

    const createClassroom = () => {
        if (!newClassName) return;
        fetch('http://localhost:5000/api/classrooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newClassName, teacher_email: currentUserEmail })
        })
        .then(res => res.json())
        .then(data => {
            setClassrooms([...classrooms, data]);
            setNewClassName('');
            setShowCreateModal(false);
            setActiveClassroom(data);
            setView('details');
        });
    };

    const addStudent = () => {
        if (!studentEmail) return;
        fetch(`http://localhost:5000/api/classrooms/${activeClassroom.id}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_email: studentEmail, classroom_name: activeClassroom.name })
        })
        .then(() => {
            setStudents([...students, { student_email: studentEmail }]);
            setStudentEmail('');
            alert("Student added and notified via email!");
        });
    };

    const addAssignment = () => {
        if (!assignTitle || !assignDue || !assignFile) {
            alert("Please provide title, due date, and file.");
            return;
        }
        
        const formData = new FormData();
        formData.append('title', assignTitle);
        formData.append('dueDate', assignDue);
        formData.append('file', assignFile);
        formData.append('classroom_name', activeClassroom.name);

        fetch(`http://localhost:5000/api/classrooms/${activeClassroom.id}/assignments`, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(() => {
            fetchClassroomData(); 
            setAssignTitle(''); 
            setAssignDue(''); 
            setAssignFile(null);
            setView('details');
            alert("Assignment posted successfully!");
        })
        .catch(err => {
            console.error("Upload error:", err);
            alert("Failed to post assignment. Check console.");
        });
    };

    const submitWork = (assignId, file) => {
        if (userRole !== 'student') {
            alert("Only students can submit assignments!");
            return;
        }
        if (!file) {
            alert("Please select a file to submit!");
            return;
        }
        if (!currentUserEmail) {
            alert("No user email found. Please try logging in again.");
            return;
        }
        
        const formData = new FormData();
        formData.append('student_email', currentUserEmail);
        formData.append('file', file);

        fetch(`http://localhost:5000/api/assignments/${assignId}/submit`, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Work submitted successfully!");
                fetchClassroomData(); // Refresh to show in teacher's review
            } else {
                alert("Error submitting: " + (data.error || "Unknown error"));
            }
        })
        .catch(err => alert("Submission failed: " + err.message));
    };

    const postGrade = (subId, email, title, assignmentId) => {
        const marks = gradingMarks[subId];
        if (!marks) {
            alert("Please enter marks before posting.");
            return;
        }
        fetch(`http://localhost:5000/api/submissions/${subId}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marks, student_email: email, assignment_title: title })
        })
        .then(res => res.json())
        .then(data => {
            alert("Grade posted and student notified!");
            // Refresh submissions and stats to show updated marks
            fetchSubmissions(assignmentId);
            fetchAssignmentStats(assignmentId);
            // Clear input field
            setGradingMarks({...gradingMarks, [subId]: ''});
        })
        .catch(err => alert("Error posting grade: " + err.message));
    };

    const deleteClassroom = (classroomId) => {
        if (window.confirm("Are you sure you want to delete this classroom? This action cannot be undone.")) {
            fetch(`http://localhost:5000/api/classrooms/${classroomId}`, {
                method: 'DELETE'
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setClassrooms(classrooms.filter(c => c.id !== classroomId));
                    setView('list');
                    setActiveClassroom(null);
                    alert("Classroom deleted successfully!");
                } else {
                    alert("Failed to delete classroom: " + (data.error || "Unknown error"));
                }
            })
            .catch(err => alert("Error deleting classroom: " + err.message));
        }
    };

    const exportMarksAsCSV = (assignmentId, assignmentTitle) => {
        fetch(`http://localhost:5000/api/assignments/${assignmentId}/export-marks`)
            .then(res => {
                if (!res.ok) throw new Error('Export failed');
                return res.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${assignmentTitle}_Marks_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            })
            .catch(err => alert("Error exporting marks: " + err.message));
    };

    const addTodo = () => {
        if (!todoText) return;
        fetch(`http://localhost:5000/api/classrooms/${activeClassroom.id}/todos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: `${todoText} (Due: ${todoDue || 'N/A'})`, 
                classroom_name: activeClassroom.name 
            })
        })
        .then(res => res.json())
        .then(data => {
            setTodos([...todos, { id: data.id, text: `${todoText} (Due: ${todoDue || 'N/A'})`, completed_by: '[]' }]);
            setTodoText('');
            setTodoDue('');
        });
    };

    const toggleTodo = (id) => {
        fetch(`http://localhost:5000/api/todos/${id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_email: currentUserEmail })
        })
        .then(res => res.json())
        .then(data => {
            setTodos(todos.map(t => t.id === id ? { ...t, completed_by: JSON.stringify(data.completed_by) } : t));
        });
    };

    if (view === 'list') {
        return (
            <div className="classroom-list-container">
                <div className="classroom-header">
                    <h2>Your Classrooms</h2>
                </div>

                <div className="class-grid">
                    {userRole === 'teacher' && (
                        <div className="class-card create-new" onClick={() => setShowCreateModal(true)}>
                            <div className="plus-icon">+</div>
                            <h3>Create New Classroom</h3>
                            <p>Set up a new space for your students</p>
                        </div>
                    )}

                    {classrooms.length === 0 && userRole === 'student' ? (
                        <div className="no-class-card">
                            <p>You haven't been added to any classrooms yet.</p>
                        </div>
                    ) : (
                        classrooms.map(c => (
                            <div key={c.id} className="class-card" onClick={() => { setActiveClassroom(c); setView('details'); }}>
                                <div className="class-icon-circle">{c.name.charAt(0).toUpperCase()}</div>
                                <h3>{c.name}</h3>
                                <p>Admin: {c.teacher_email}</p>
                                <button className="secondary-btn">Open Classroom</button>
                            </div>
                        ))
                    )}
                </div>

                {showCreateModal && (
                    <div className="modal-overlay">
                        <div className="modal-content glass-panel">
                            <h3>Create New Classroom</h3>
                            <input 
                                autoFocus
                                placeholder="Enter Classroom Name (e.g. Physics 101)" 
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && createClassroom()}
                            />
                            <div className="modal-actions">
                                <button className="text-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button className="primary-btn" onClick={createClassroom}>Create Classroom</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="classroom-detail-container">
            <header className="detail-header-nav">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button className="back-link" onClick={() => setView('list')}>← Back to all classes</button>
                    {userRole === 'teacher' && (
                        <button 
                            className="delete-classroom-btn" 
                            onClick={() => deleteClassroom(activeClassroom.id)}
                            style={{
                                background: '#ff4444',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600'
                            }}
                        >
                            🗑️ Delete Classroom
                        </button>
                    )}
                </div>
                <div className="class-title-section">
                    <div className="class-avatar">{activeClassroom.name.charAt(0)}</div>
                    <div>
                        <h1>{activeClassroom.name}</h1>
                        <p className="teacher-badge">Lead Instructor: <span>{activeClassroom.teacher_email}</span></p>
                    </div>
                </div>
            </header>

            <div className="classroom-nav-tabs">
                <button className={tab === 'assignments' ? 'active' : ''} onClick={() => setTab('assignments')}>📚 Assignments</button>
                <button className={tab === 'todos' ? 'active' : ''} onClick={() => setTab('todos')}>✅ Class Tasks</button>
                <button className={tab === 'students' ? 'active' : ''} onClick={() => setTab('students')}>👥 Students</button>
            </div>

            <div className="tab-viewport">
                {tab === 'students' && (
                    <div className="students-pane">
                        <div className="pane-header">
                            <h3>Class Roster</h3>
                            {userRole === 'teacher' && (
                                <div className="quick-add">
                                    <input value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="Email address..." />
                                    <button className="primary-btn" onClick={addStudent}>+ Enroll Student</button>
                                </div>
                            )}
                        </div>
                        <div className="members-grid">
                            {students.length === 0 ? (
                                <div className="empty-state">No students enrolled yet.</div>
                            ) : (
                                students.map((s, i) => (
                                    <div key={i} className="member-card">
                                        <div className="member-initials">{s.student_email.charAt(0).toUpperCase()}</div>
                                        <div className="member-info">
                                            <p className="email">{s.student_email}</p>
                                            <span className="status-dot"></span> Online
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {tab === 'assignments' && (
                    <div className="assignments-pane">
                        <div className="pane-header">
                            <h3>Curriculum & Work</h3>
                            <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                                {userRole === 'teacher' && (
                                    <button 
                                        onClick={() => fetchClassroomData()}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'var(--primary)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                        title="Refresh submissions"
                                    >
                                        🔄 Refresh
                                    </button>
                                )}
                                {userRole === 'teacher' && (
                                    <button className="add-fab" onClick={() => setView('createAssign')}>+ New Assignment</button>
                                )}
                            </div>
                        </div>

                        <div className="assignments-stack">
                            {assignments.length === 0 ? (
                                <div className="empty-state">No assignments posted.</div>
                            ) : (
                                assignments.map(a => (
                                    <div key={a.id} className="assignment-item-v2">
                                        <div className="item-main">
                                            <div className="file-icon">📄</div>
                                            <div className="item-meta">
                                                <h4>{a.title}</h4>
                                                <span className="due-date">Due: {a.dueDate}</span>
                                            </div>
                                            <a href={`http://localhost:5000${a.filePath}`} download className="download-btn-v2">Get File</a>
                                        </div>
                                        
                                        <div className="item-actions">
                                            {userRole === 'student' ? (
                                                <div className="submit-section">
                                                    {submissions[a.id]?.find(s => s.student_email === currentUserEmail) ? (
                                                        <div className="submission-status-v2">
                                                            <span className="status-badge-v2">✓ Work Submitted</span>
                                                            {submissions[a.id]?.find(s => s.student_email === currentUserEmail).marks && (
                                                                <span className="grade-badge-v2">Mark: {submissions[a.id]?.find(s => s.student_email === currentUserEmail).marks}</span>
                                                            )}
                                                            <p style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px'}}>Record ID: {submissions[a.id]?.find(s => s.student_email === currentUserEmail).student_email}</p>
                                                        </div>
                                                    ) : (
                                                        <label className="file-upload-btn">
                                                            <span>Upload Solution</span>
                                                            <input type="file" onChange={e => submitWork(a.id, e.target.files[0])} />
                                                        </label>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="submissions-tracker">
                                                    <div className="sub-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                                        <span>{submissions[a.id]?.length || 0} Submissions</span>
                                                        <button 
                                                            onClick={() => exportMarksAsCSV(a.id, a.title)}
                                                            style={{
                                                                padding: '6px 12px',
                                                                background: 'var(--primary)',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                            title="Download marks as CSV"
                                                        >
                                                            📥 Export Marks
                                                        </button>
                                                    </div>
                                                    <div style={{
                                                        background: 'rgba(255,255,255,0.02)',
                                                        padding: '10px 12px',
                                                        borderRadius: '4px',
                                                        marginBottom: '10px',
                                                        fontSize: '12px',
                                                        color: 'var(--text-muted)',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
                                                            {assignmentStats[a.id] ? (
                                                                <>
                                                                    <span>📊 Avg: {assignmentStats[a.id]?.average?.toFixed(2) || 'N/A'}</span>
                                                                    <span>🥇 High: {assignmentStats[a.id]?.highest || 'N/A'}</span>
                                                                    <span>🥉 Low: {assignmentStats[a.id]?.lowest || 'N/A'}</span>
                                                                    <span>📈 Median: {assignmentStats[a.id]?.median || 'N/A'}</span>
                                                                </>
                                                            ) : (
                                                                <span style={{color: '#ffb347', fontStyle: 'italic'}}>📈 Loading class statistics...</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {submissions[a.id]?.map(s => (
                                                        <div key={s.id} className="sub-row">
                                                            <div style={{flex: 1}}>
                                                                <span style={{fontWeight: '600'}}>{s.student_email}</span>
                                                                {s.fileName && <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>📄 {s.fileName}</div>}
                                                                {s.marks && assignmentStats[a.id] && (
                                                                    <div style={{fontSize: '11px', marginTop: '4px', color: parseFloat(s.marks) >= assignmentStats[a.id].average ? 'green' : 'orange'}}>
                                                                        📍 Score: {s.marks} {parseFloat(s.marks) >= assignmentStats[a.id].highest ? '🥇 Highest' : parseFloat(s.marks) >= assignmentStats[a.id].average ? '✓ Above Avg' : '⚠️ Below Avg'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="sub-tools">
                                                                {s.filePath ? (
                                                                    <>
                                                                        <a href={`http://localhost:5000${encodeURI(s.filePath)}`} target="_blank" rel="noopener noreferrer" className="view-file-btn" title="Open in new tab">👁️ View</a>
                                                                        <a href={`http://localhost:5000${encodeURI(s.filePath)}`} download={s.fileName || 'file'} className="download-file-btn" title="Download file">⬇️ Download</a>
                                                                    </>
                                                                ) : (
                                                                    <span style={{color: 'var(--text-muted)', fontSize: '12px'}}>No file submitted</span>
                                                                )}
                                                                <input 
                                                                    placeholder="Grade" 
                                                                    className="grade-input"
                                                                    value={gradingMarks[s.id] !== undefined ? gradingMarks[s.id] : (s.marks || '')} 
                                                                    onChange={e => setGradingMarks({...gradingMarks, [s.id]: e.target.value})}
                                                                />
                                                                <button onClick={() => postGrade(s.id, s.student_email, a.title, a.id)} className="post-grade-btn">Post Grade</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {tab === 'todos' && (
                    <div className="todo-pane">
                        <div className="pane-header">
                            <h3>Class Engagement</h3>
                            {userRole === 'teacher' && (
                                <div className="quick-add">
                                    <input value={todoText} onChange={e => setTodoText(e.target.value)} placeholder="Announce a task..." />
                                    <input type="date" value={todoDue} onChange={e => setTodoDue(e.target.value)} />
                                    <button className="primary-btn" onClick={addTodo}>Post</button>
                                </div>
                            )}
                        </div>
                        <div className="tasks-container">
                            {todos.map(t => {
                                const completedList = JSON.parse(t.completed_by || "[]");
                                const isDone = completedList.includes(currentUserEmail);
                                return (
                                    <div key={t.id} className={`task-card ${isDone ? 'checked' : ''}`}>
                                        <div className="task-content">
                                            <div className="custom-checkbox" onClick={() => userRole === 'student' && toggleTodo(t.id)}>
                                                {isDone && '✓'}
                                            </div>
                                            <span>{t.text}</span>
                                        </div>
                                        <div className="task-progress-box">
                                            <div className="progress-label">{completedList.length} Finished</div>
                                            <div className="mini-progress"><div className="fill" style={{ width: `${(completedList.length / (students.length || 1)) * 100}%` }}></div></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Contextual modal for adding assignment by teacher */}
            {view === 'createAssign' && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel">
                        <h2>New Assignment</h2>
                        <div className="form-group">
                            <label>Title</label>
                            <input value={assignTitle} onChange={e => setAssignTitle(e.target.value)} placeholder="e.g. Weekly Lab Report" />
                        </div>
                        <div className="form-group">
                            <label>Due Date</label>
                            <input type="date" value={assignDue} onChange={e => setAssignDue(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Attachment</label>
                            <input type="file" onChange={e => setAssignFile(e.target.files[0])} />
                        </div>
                        <div className="modal-actions">
                            <button className="text-btn" onClick={() => setView('details')}>Cancel</button>
                            <button className="primary-btn" onClick={() => { addAssignment(); setView('details'); }}>Post to Class</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Classroom;

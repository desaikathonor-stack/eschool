import { useState, useEffect } from 'react';
import { Calendar, Bell, ExternalLink, PenTool, BookOpen, ChevronRight, Folder } from 'lucide-react';

export default function Home({ setActiveTab }) {
    const [todos, setTodos] = useState([]);
    const [savedBoards, setSavedBoards] = useState([]);
    const currentUserEmail = localStorage.getItem('eschool_current_user') || 'student@eschool.com';

    useEffect(() => {
        // Fetch Todos for overview
        fetch(`http://localhost:5000/api/todos/${currentUserEmail}`)
            .then(res => res.json())
            .then(data => setTodos(data.slice(0, 3)))
            .catch(err => console.error(err));

        // Fetch saved whiteboards for list view
        fetch(`http://localhost:5000/api/saved-whiteboards/${currentUserEmail}`)
            .then(res => res.json())
            .then(data => setSavedBoards(data.slice(0, 4))) // Only show 4 most recent
            .catch(err => console.error(err));
    }, [currentUserEmail]);

    const openBoard = (id) => {
        localStorage.setItem('eschool_pending_board_id', id);
        setActiveTab('whiteboard');
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', height: '100%' }}>
            {/* LEFT COL: Welcome & Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="glass-panel" style={{ padding: '2.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)' }}>
                    <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Welcome Back!</h1>
                    <p style={{ color: 'var(--text-main)', fontSize: '1.2rem', lineHeight: '1.6' }}>
                        Your personalized learning environment is ready. Stay productive and track your progress across modules.
                    </p>
                </div>

                <div className="glass-panel" style={{ flex: 1, padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem' }}>
                            <Calendar size={20} color="var(--primary)" /> Pending Tasks
                        </h3>
                        <button onClick={() => setActiveTab('todo')} style={{ fontSize: '0.85rem', color: 'var(--primary)', background: 'transparent' }}>View All</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {todos.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>All caught up! No pending tasks.</p>
                        ) : (
                            todos.map(t => (
                                <div key={t.id} style={{ padding: '12px 16px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ color: t.completed ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.text}</span>
                                    {t.reminder && <Bell size={14} color="var(--primary)" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT COL: Saved Whiteboards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="glass-panel" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem' }}>
                            <PenTool size={20} color="#10b981" /> Saved Whiteboards
                        </h3>
                        <button onClick={() => setActiveTab('whiteboard')} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Go to Canvas</button>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {savedBoards.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', borderRadius: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                                No saved whiteboards yet. Start drawing to save your first one!
                            </div>
                        ) : (
                            savedBoards.map(board => (
                                <div
                                    key={board.id}
                                    onClick={() => openBoard(board.id)}
                                    style={{
                                        padding: '16px',
                                        background: 'var(--bg-dark)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--glass-border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        // hover: { background: 'rgba(255,255,255,0.05)' } // This is not valid inline style
                                    }}
                                    className="list-item-hover"
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Folder size={18} color="var(--primary)" />
                                        <div>
                                            <div style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 500 }}>{board.title}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(board.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} color="var(--text-muted)" />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '2rem', background: 'rgba(59, 130, 246, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ padding: '12px', background: 'var(--primary)', borderRadius: '12px', color: 'white' }}>
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Continue Learning</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Resume your curriculum modules where you left off.</p>
                        </div>
                        <button onClick={() => setActiveTab('education')} style={{ marginLeft: 'auto', padding: '10px', borderRadius: '50%', background: 'var(--bg-panel)' }}>
                            <ExternalLink size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .list-item-hover:hover {
                    background: rgba(255,255,255,0.05) !important;
                    border-color: var(--primary) !important;
                    transform: translateX(4px);
                }
            `}</style>
        </div>
    );
}

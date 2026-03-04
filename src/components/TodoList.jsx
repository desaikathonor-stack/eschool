import { useState, useEffect, useRef } from 'react';
import { Plus, Check, Trash2, Calendar, Bell, Mail, Send, ExternalLink, CheckCircle2 } from 'lucide-react';

export default function TodoList() {
    const [todos, setTodos] = useState([]);
    const [newTodo, setNewTodo] = useState('');
    const [reminderTime, setReminderTime] = useState('');
    const [activeAlert, setActiveAlert] = useState(null);


    const todosRef = useRef(todos);
    const currentUserEmail = localStorage.getItem('eschool_current_user') || 'student@eschool.com';

    // 1. DATA SYNC: Fetch all todos from the server on load
    useEffect(() => {
        fetch(`http://localhost:5000/api/todos/${currentUserEmail}`)
            .then(res => res.json())
            .then(data => {
                setTodos(data);
                todosRef.current = data;
            })
            .catch(err => console.error("Sync error:", err));

        // Request Browser Permissions (For when APP IS OPEN redundant layer)
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, [currentUserEmail]);

    // Keep the ref updated for our interval timer
    useEffect(() => {
        todosRef.current = todos;
    }, [todos]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            todosRef.current.forEach(todo => {
                if (todo.reminder && !todo.completed && !todo.reminderSent) {
                    const rTime = new Date(todo.reminder);
                    // Check if it's time to trigger (with a 5 second tolerance for the interval sync)
                    if (now >= rTime) {
                        triggerLocalNotification(todo);
                    }
                }
            });
        }, 1000); // Check every second for better responsiveness

        return () => clearInterval(interval);
    }, []);

    const triggerLocalNotification = (todo) => {
        // 1. Desktop Browser Notification (Only if app is open)
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('📚 E-School Task Reminder', {
                    body: `Time to work on: ${todo.text}`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/2907/2907151.png'
                });
            } catch (e) {
                console.error("Desktop Notification error:", e);
            }
        }

        // 2. UI Feedback/Alert
        setActiveAlert({
            text: `Reminder for "${todo.text}"!`,
            email: currentUserEmail,
            time: new Date().toLocaleTimeString()
        });

        setTimeout(() => setActiveAlert(null), 8000);


        // 4. Sync local state to match server (mark as sent locally)
        setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, reminderSent: true } : t));
    };



    const addTodo = (e) => {
        e.preventDefault();
        if (!newTodo.trim()) return;

        const newTask = {
            user_email: currentUserEmail,
            text: newTodo,
            reminder: reminderTime || null
        };

        // SAVE TO THE SERVER (Permanent storage)
        fetch('http://localhost:5000/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        })
            .then(res => res.json())
            .then(savedTodo => {
                setTodos([savedTodo, ...todos]);
                setNewTodo('');
                setReminderTime('');
            });
    };

    const toggleTodo = (id) => {
        const t = todos.find(t => t.id === id);
        fetch(`http://localhost:5000/api/todos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !t.completed })
        })
            .then(() => {
                setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
            });
    };

    const deleteTodo = (id) => {
        fetch(`http://localhost:5000/api/todos/${id}`, { method: 'DELETE' })
            .then(() => {
                setTodos(todos.filter(t => t.id !== id));
            });
    };

    return (
        <div className="glass-panel" style={{ height: '100%', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Tasks Overview</h2>
                <p style={{ color: 'var(--text-muted)' }}>Stay on top of your adaptive learning goals.</p>
            </div>

            {activeAlert && (
                <div style={{ marginBottom: '2rem', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid var(--primary)', borderRadius: '12px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Bell size={24} color="var(--primary)" />
                            <span style={{ fontWeight: 600, fontSize: '1.2rem' }}>{activeAlert.text}</span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeAlert.time}</span>
                    </div>

                    <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <Mail size={22} color="var(--primary)" />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Recipient: {activeAlert.email}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={12} /> Automated Email Sent
                                </div>
                            </div>
                            <CheckCircle2 size={24} color="#10b981" />
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={addTodo} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    placeholder="Add a new learning task..."
                    className="input-base"
                    style={{ flex: 1, minWidth: '250px', padding: '16px', fontSize: '1.1rem' }}
                />
                <input
                    type="datetime-local"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="input-base"
                    style={{ background: 'var(--bg-dark)', colorScheme: 'dark', padding: '16px' }}
                    title="Set a reminder date & time"
                />
                <button type="submit" className="btn-primary" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={20} /> Add Task
                </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1 }}>
                {todos.map(todo => (
                    <div
                        key={todo.id}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1.25rem', background: 'var(--glass-bg)', borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            opacity: todo.completed ? 0.7 : 1, transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button
                                onClick={() => toggleTodo(todo.id)}
                                style={{
                                    width: '28px', height: '28px', borderRadius: '50%', border: `2px solid ${todo.completed ? 'var(--primary)' : 'var(--text-muted)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: todo.completed ? 'var(--primary)' : 'transparent', color: 'white'
                                }}
                            >
                                {todo.completed && <Check size={16} />}
                            </button>
                            <span style={{ fontSize: '1.1rem', color: todo.completed ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: todo.completed ? 'line-through' : 'none' }}>
                                {todo.text}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {todo.reminder && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: todo.reminderSent ? 'var(--text-muted)' : 'var(--primary)', fontSize: '0.85rem', background: 'rgba(99, 102, 241, 0.1)', padding: '6px 12px', borderRadius: '16px' }}>
                                    <Bell size={14} /> {new Date(todo.reminder).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                            )}
                            <button onClick={() => deleteTodo(todo.id)} title="Delete Task" style={{ color: '#ef4444', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                {todos.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>You're all caught up!</p>
                )}
            </div>
        </div>
    );
}

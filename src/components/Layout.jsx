import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Book, CheckSquare, Edit, Edit3, Settings, MonitorPlay, ClipboardList, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Layout({ children, role, activeTab, setActiveTab }) {
    const navigate = useNavigate();

    const handleLogout = () => navigate('/');

    const getTabs = () => {
        let base = [
            { id: 'home', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
            { id: 'notes', icon: <Edit size={20} />, label: 'Notes' },
            { id: 'todo', icon: <CheckSquare size={20} />, label: 'Todo' },
            { id: 'whiteboard', icon: <Edit3 size={20} />, label: 'Whiteboard' },
            { id: 'assignments', icon: <ClipboardList size={20} />, label: 'Assignments' }
        ];
        if (role === 'student') {
            base.push({ id: 'education', icon: <MonitorPlay size={20} />, label: 'Education' });
        } else {
            base.push({ id: 'quizSettings', icon: <Settings size={20} />, label: 'Quiz Settings' });
        }
        return base;
    };

    const tabs = getTabs();

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-dark)' }}>
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -250 }}
                animate={{ x: 0 }}
                className="glass-panel"
                style={{ width: '250px', borderLeft: 'none', borderTop: 'none', borderBottom: 'none', borderRadius: '0 16px 16px 0', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 50 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '3rem', padding: '0 12px' }}>
                    <Book size={28} color="var(--primary)" />
                    <h2 className="text-gradient" style={{ fontSize: '1.25rem', margin: 0 }}>E-School Pro</h2>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                borderRadius: '8px',
                                color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                                background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                                textAlign: 'left',
                                width: '100%',
                                transition: 'all 0.2s',
                                fontWeight: activeTab === tab.id ? 600 : 400
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ padding: '12px', marginBottom: '1rem' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Role</p>
                        <p style={{ fontWeight: 600, color: 'var(--secondary)' }}>{role === 'student' ? 'Student' : 'Teacher'}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            borderRadius: '8px',
                            color: 'var(--text-muted)',
                            width: '100%',
                            textAlign: 'left',
                        }}
                    >
                        <LogOut size={20} /> Logout
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main style={{ marginLeft: '250px', flex: 1, padding: '2rem', maxWidth: 'calc(100vw - 250px)' }}>
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{ height: '100%' }}
                >
                    {children}
                </motion.div>
            </main>
        </div>
    );
}

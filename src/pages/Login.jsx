import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, User, BookOpen, Mail, Lock, ArrowRight } from 'lucide-react';
import API_BASE_URL from '../utils/api';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [role, setRole] = useState('student'); // 'student' | 'teacher'
    const [step, setStep] = useState(1); // 1: role/action, 2: email+pass
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleNext = (e) => {
        e.preventDefault();
        setError('');
        if (step === 1) {
            setStep(2);
        } else {
            // SYNC with the Central Database
            fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, role })
            })
                .then(res => res.json())
                .then(data => {
                    localStorage.setItem('eschool_current_user', email);
                    if (role === 'student') navigate('/student');
                    else navigate('/teacher');
                });

        }
    };

    return (
        <div className="flex-center" style={{ minHeight: '100vh', padding: '1rem' }}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="glass-panel"
                style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', position: 'relative', overflow: 'hidden' }}
            >
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', background: 'var(--primary)', width: '100px', height: '100px', borderRadius: '50%', filter: 'blur(50px)', opacity: 0.5 }} />
                <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', background: 'var(--secondary)', width: '100px', height: '100px', borderRadius: '50%', filter: 'blur(50px)', opacity: 0.5 }} />

                <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                    <BookOpen size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
                    <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>E-School Pro</h1>
                    <p style={{ color: 'var(--text-muted)' }}>{isLogin ? 'Welcome back to your adaptive learning path.' : 'Start your adaptive learning journey.'}</p>
                </div>

                <form onSubmit={handleNext} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                            >
                                <div style={{ display: 'flex', background: 'var(--glass-border)', borderRadius: '8px', padding: '4px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setRole('student')}
                                        style={{ flex: 1, padding: '10px', borderRadius: '6px', background: role === 'student' ? 'var(--primary)' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <User size={18} /> Student
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('teacher')}
                                        style={{ flex: 1, padding: '10px', borderRadius: '6px', background: role === 'teacher' ? 'var(--primary)' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <GraduationCap size={18} /> Teacher
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                                    <button type="button" onClick={() => setIsLogin(true)} style={{ color: isLogin ? 'var(--primary)' : 'var(--text-muted)', fontWeight: isLogin ? 600 : 400, borderBottom: isLogin ? '2px solid var(--primary)' : '2px solid transparent', paddingBottom: '4px' }}>Login</button>
                                    <button type="button" onClick={() => setIsLogin(false)} style={{ color: !isLogin ? 'var(--primary)' : 'var(--text-muted)', fontWeight: !isLogin ? 600 : 400, borderBottom: !isLogin ? '2px solid var(--primary)' : '2px solid transparent', paddingBottom: '4px' }}>Sign Up</button>
                                </div>

                                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                                    Continue <ArrowRight size={18} />
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                            >
                                {error && (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.5)' }}>
                                        {error}
                                    </motion.div>
                                )}
                                <div style={{ position: 'relative' }}>
                                    <Mail size={18} style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} />
                                    <input type="email" placeholder="Email Address" required className="input-base" style={{ paddingLeft: '44px' }} value={email} onChange={(e) => setEmail(e.target.value)} />
                                </div>
                                {!isLogin && (
                                    <div style={{ position: 'relative' }}>
                                        <User size={18} style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} />
                                        <input type="text" placeholder="Full Name" required className="input-base" style={{ paddingLeft: '44px' }} value={name} onChange={(e) => setName(e.target.value)} />
                                    </div>
                                )}
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} />
                                    <input type="password" placeholder="Password" required className="input-base" style={{ paddingLeft: '44px' }} value={password} onChange={(e) => setPassword(e.target.value)} />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                    <button type="button" onClick={() => { setStep(1); setError(''); }} style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Back</button>
                                    <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        {isLogin ? 'Enter Dashboard' : 'Create Account'} <ArrowRight size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </motion.div>
        </div>
    );
}

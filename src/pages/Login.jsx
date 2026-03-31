import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GraduationCap, User, BookOpen, Mail, Lock, ArrowRight } from 'lucide-react';
import API_BASE_URL from '../utils/api';
import './Login.css';

const DUMMY_USERS_KEY = 'eschool_dummy_users';

function getDummyUsers() {
    const seeded = {
        'student@eschool.com': {
            email: 'student@eschool.com',
            password: 'demo123',
            name: 'Demo Student',
            role: 'student'
        },
        'teacher@eschool.com': {
            email: 'teacher@eschool.com',
            password: 'demo123',
            name: 'Demo Teacher',
            role: 'teacher'
        }
    };

    try {
        const stored = localStorage.getItem(DUMMY_USERS_KEY);
        if (!stored) {
            localStorage.setItem(DUMMY_USERS_KEY, JSON.stringify(seeded));
            return seeded;
        }

        return { ...seeded, ...JSON.parse(stored) };
    } catch {
        localStorage.setItem(DUMMY_USERS_KEY, JSON.stringify(seeded));
        return seeded;
    }
}

function setDummyUsers(users) {
    localStorage.setItem(DUMMY_USERS_KEY, JSON.stringify(users));
}

async function runDummyAuth({ email, password, name, role, action }) {
    const users = getDummyUsers();
    const user = users[email];

    if (action === 'signup') {
        if (user) {
            throw new Error('User already exists in local demo mode. Please log in.');
        }

        const createdUser = {
            email,
            password,
            name: name?.trim() || email.split('@')[0],
            role: role === 'teacher' ? 'teacher' : 'student'
        };
        users[email] = createdUser;
        setDummyUsers(users);
        return { success: true, user: createdUser, source: 'dummy' };
    }

    if (!user) {
        throw new Error('User not found in local demo mode. Please sign up first.');
    }
    if (user.password !== password) {
        throw new Error('Incorrect password for local demo mode.');
    }

    return { success: true, user, source: 'dummy' };
}

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [role, setRole] = useState('student'); // 'student' | 'teacher'
    const [step, setStep] = useState(1); // 1: role/action, 2: email+pass
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();

    const animation = useMemo(() => {
        if (reduceMotion) {
            return {
                page: { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } },
                step: { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
            };
        }

        return {
            page: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease: 'easeOut' } },
            step: { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 10 }, transition: { duration: 0.2 } }
        };
    }, [reduceMotion]);

    const handleNext = async (e) => {
        e.preventDefault();
        setError('');
        if (step === 1) {
            setStep(2);
        } else {
            const normalizedEmail = email.trim().toLowerCase();
            const payload = {
                email: normalizedEmail,
                password,
                name,
                role,
                action: isLogin ? 'login' : 'signup'
            };

            if (!normalizedEmail || !password || (!isLogin && !name.trim())) {
                setError('Please complete all required fields.');
                return;
            }

            setIsSubmitting(true);
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 7000);

                let data;
                try {
                    const res = await fetch(`${API_BASE_URL}/auth`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                    data = await res.json();
                    if (!res.ok || !data.success) {
                        throw new Error(data.error || 'Authentication failed.');
                    }
                } catch (apiError) {
                    data = await runDummyAuth(payload);
                    localStorage.setItem('eschool_auth_mode', 'dummy');
                } finally {
                    clearTimeout(timeout);
                }

                localStorage.setItem('eschool_current_user', data.user.email);
                localStorage.setItem('eschool_current_role', data.user.role);
                if (data.user.role === 'teacher') {
                    navigate('/teacher');
                } else {
                    navigate('/student');
                }
            } catch (err) {
                setError(err.message || 'Unable to continue. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <div className="auth-shell">
            <motion.div
                initial={animation.page.initial}
                animate={animation.page.animate}
                transition={animation.page.transition}
                className="auth-card"
            >
                <div className="auth-glow auth-glow-top" />
                <div className="auth-glow auth-glow-bottom" />

                <div className="auth-header">
                    <BookOpen size={42} color="#14b8a6" />
                    <h1>E-School Pro</h1>
                    <p>{isLogin ? 'Welcome back. Continue where you left off.' : 'Create your account and get started quickly.'}</p>
                </div>

                <form onSubmit={handleNext} className="auth-form">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={animation.step.initial}
                                animate={animation.step.animate}
                                exit={animation.step.exit}
                                transition={animation.step.transition}
                                className="auth-step"
                            >
                                <div className="auth-segment">
                                    <button
                                        type="button"
                                        onClick={() => setRole('student')}
                                        className={role === 'student' ? 'selected' : ''}
                                    >
                                        <User size={18} /> Student
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('teacher')}
                                        className={role === 'teacher' ? 'selected' : ''}
                                    >
                                        <GraduationCap size={18} /> Teacher
                                    </button>
                                </div>

                                <div className="auth-tabs">
                                    <button type="button" onClick={() => setIsLogin(true)} className={isLogin ? 'active' : ''}>Login</button>
                                    <button type="button" onClick={() => setIsLogin(false)} className={!isLogin ? 'active' : ''}>Sign Up</button>
                                </div>

                                <button type="submit" className="btn-primary auth-primary-btn" disabled={isSubmitting}>
                                    Continue <ArrowRight size={18} />
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={animation.step.initial}
                                animate={animation.step.animate}
                                exit={animation.step.exit}
                                transition={animation.step.transition}
                                className="auth-step auth-step-tight"
                            >
                                {error && (
                                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="auth-error">
                                        {error}
                                    </motion.div>
                                )}
                                <div className="auth-input-wrap">
                                    <Mail size={18} className="auth-input-icon" />
                                    <input type="email" placeholder="Email Address" required className="input-base auth-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                                </div>
                                {!isLogin && (
                                    <div className="auth-input-wrap">
                                        <User size={18} className="auth-input-icon" />
                                        <input type="text" placeholder="Full Name" required className="input-base auth-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                                    </div>
                                )}
                                <div className="auth-input-wrap">
                                    <Lock size={18} className="auth-input-icon" />
                                    <input type="password" placeholder="Password" required className="input-base auth-input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isLogin ? 'current-password' : 'new-password'} />
                                </div>

                                <div className="auth-footer">
                                    <button type="button" onClick={() => { setStep(1); setError(''); }} className="auth-back-btn" disabled={isSubmitting}>Back</button>
                                    <button type="submit" className="btn-primary auth-primary-btn" disabled={isSubmitting}>
                                        {isSubmitting ? 'Working...' : isLogin ? 'Enter Dashboard' : 'Create Account'} <ArrowRight size={18} />
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

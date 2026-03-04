import { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle, FileText, Award, ArrowRight, ArrowLeft, X } from 'lucide-react';

const MOCK_VIDEOS = [
    { id: 1, module: 'Module 1', title: 'Introduction to Web & HTML', duration: '10:00', youtubeId: '9J1nJOivdyw' },
    { id: 2, module: 'Module 2', title: 'CSS & Creating first web page', duration: '15:20', youtubeId: 'HcOc7P5BMi4' },
    { id: 3, module: 'Module 3', title: 'Advanced CSS & Styling', duration: '18:10', youtubeId: 'ESnrn1kAD4E' },
    { id: 4, module: 'Module 4', title: 'JavaScript Basics & The DOM', duration: '22:30', youtubeId: 'DWk2mndNTHY' },
    { id: 5, module: 'Module 5', title: 'Loops, External JS & Canvas', duration: '25:40', youtubeId: '7zcXPCt8Ck0' },
    { id: 6, module: 'Module 6', title: 'React Environment Setup & JSX', duration: '16:50', youtubeId: '_i-uLJAh79U' },
    { id: 7, module: 'Module 7', title: 'Advanced React: State, Props & Hooks', duration: '24:55', youtubeId: 'uADL3coqh_M' },
    { id: 8, module: 'Module 8', title: 'APIs, Data Fetching & Async', duration: '20:00', youtubeId: 'L2A8hMSeyDs' },
    { id: 9, module: 'Module 9', title: 'React Router & Navigation', duration: '19:40', youtubeId: 'kKVVan3EGoU' },
    { id: 10, module: 'Module 10', title: 'Deployment, Hosting & CI/CD', duration: '28:15', youtubeId: 'LOH1l-MP_9k' },
];

export default function Education() {
    const [activeTab, setActiveTab] = useState('videos');
    const [selectedVideo, setSelectedVideo] = useState(MOCK_VIDEOS[0]);
    const [quizzes, setQuizzes] = useState([]);
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [isReviewMode, setIsReviewMode] = useState(false);

    // Attempt State
    const [isStarting, setIsStarting] = useState(false);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState({});
    const [showResult, setShowResult] = useState(false);

    const currentUserEmail = localStorage.getItem('eschool_current_user') || 'anonymous_student';

    useEffect(() => {
        loadQuizzes();
    }, []);

    const loadQuizzes = () => {
        fetch('http://localhost:5000/api/quizzes')
            .then(res => res.json())
            .then(allQuizzes => {
                fetch(`http://localhost:5000/api/attempts/${currentUserEmail}`)
                    .then(res => res.json())
                    .then(attempts => {
                        const decorated = allQuizzes.map(q => {
                            const myAttempt = attempts.find(a => a.quiz_id === q.id);
                            if (myAttempt) {
                                return { ...q, status: 'completed', score: myAttempt.score };
                            }
                            return { ...q, status: 'pending' };
                        });
                        setQuizzes(decorated);
                    });
            });
    };

    const startQuiz = (quiz) => {
        setActiveQuiz(quiz);
        setIsStarting(true);
        setIsReviewMode(false);
        setCurrentIdx(0);
        setAnswers({});
        setShowResult(false);
    };

    const submitQuiz = () => {
        let score = 0;
        activeQuiz.questions.forEach((q, idx) => {
            if (answers[idx] === q.correct) score++;
        });
        const percentage = Math.round((score / activeQuiz.questions.length) * 100) + '%';

        fetch('http://localhost:5000/api/attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quiz_id: activeQuiz.id,
                quiz_title: activeQuiz.title,
                student_email: currentUserEmail,
                score: percentage,
                showResultImmediately: activeQuiz.showResultImmediately
            })
        }).then(() => {
            loadQuizzes();
            setShowResult(true);
        });
    };

    // --- RENDER LOGIC ---

    if (activeQuiz && isReviewMode) {
        return (
            <div className="glass-panel" style={{ height: '100%', padding: '2.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 className="text-gradient" style={{ fontSize: '1.8rem' }}>Review: {activeQuiz.title}</h2>
                    <button onClick={() => { setActiveQuiz(null); setIsReviewMode(false); }} className="btn-primary" style={{ background: 'var(--glass-bg)', color: 'var(--text-main)' }}>
                        <X size={20} /> Close Review
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {activeQuiz.questions.map((q, idx) => (
                        <div key={idx} style={{ padding: '1.5rem', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--text-main)' }}>Q{idx + 1}: {q.q}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {q.options.map((opt, optIdx) => (
                                    <div key={optIdx} style={{
                                        padding: '1rem', borderRadius: '8px',
                                        background: q.correct === optIdx ? 'rgba(16, 185, 129, 0.1)' : 'var(--glass-bg)',
                                        border: q.correct === optIdx ? '1px solid #10b981' : '1px solid var(--border-color)',
                                        opacity: q.correct === optIdx ? 1 : 0.6
                                    }}>
                                        <span style={{ fontWeight: 600, marginRight: '8px', color: q.correct === optIdx ? '#10b981' : 'var(--text-muted)' }}>
                                            {String.fromCharCode(65 + optIdx)}.
                                        </span>
                                        {opt}
                                        {q.correct === optIdx && <CheckCircle size={16} style={{ float: 'right', color: '#10b981' }} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (activeQuiz && isStarting) {
        if (showResult) {
            return (
                <div className="glass-panel" style={{ height: '100%', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <Award size={64} color="#10b981" style={{ marginBottom: '1rem' }} />
                    <h2 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Quiz Completed!</h2>

                    {activeQuiz.showResultImmediately === false ? (
                        <div style={{ marginBottom: '2rem' }}>
                            <p style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginBottom: '1rem' }}>
                                Your answers have been recorded successfully.
                            </p>
                            <p style={{ color: 'var(--primary)', fontSize: '1rem' }}>
                                Your teacher will review and email your results to you shortly.
                            </p>
                        </div>
                    ) : (
                        <>
                            <p style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                You scored:
                            </p>
                            <div style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '2rem' }}>
                                {quizzes.find(q => q.id === activeQuiz.id)?.score}
                            </div>
                        </>
                    )}

                    <button onClick={() => { setIsStarting(false); setActiveQuiz(null); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Return to Dashboard <ArrowRight size={18} />
                    </button>
                </div>
            );
        }

        const q = activeQuiz.questions[currentIdx];
        return (
            <div className="glass-panel" style={{ height: '100%', padding: '3rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div>
                        <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>Question {currentIdx + 1} of {activeQuiz.questions.length}</span>
                        <h2 className="text-main" style={{ fontSize: '2rem', marginTop: '0.5rem' }}>{q.q}</h2>
                    </div>
                    <div style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontWeight: 600 }}>
                        {activeQuiz.timeLimit} Remaining
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                    {q.options.map((opt, optIdx) => (
                        <button
                            key={optIdx}
                            onClick={() => setAnswers({ ...answers, [currentIdx]: optIdx })}
                            style={{
                                padding: '1.5rem', textAlign: 'left', fontSize: '1.1rem', borderRadius: '12px',
                                border: answers[currentIdx] === optIdx ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                                background: answers[currentIdx] === optIdx ? 'rgba(99, 102, 241, 0.1)' : 'var(--glass-bg)',
                                color: 'var(--text-main)', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ display: 'inline-block', width: '30px', height: '30px', textAlign: 'center', lineHeight: '28px', borderRadius: '50%', background: answers[currentIdx] === optIdx ? 'var(--primary)' : 'rgba(255,255,255,0.1)', marginRight: '1rem', color: 'white' }}>
                                {String.fromCharCode(65 + optIdx)}
                            </span>
                            {opt}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
                    <button
                        disabled={currentIdx === 0}
                        onClick={() => setCurrentIdx(currentIdx - 1)}
                        className="btn-primary"
                        style={{ background: 'var(--glass-bg)', color: 'var(--text-main)', opacity: currentIdx === 0 ? 0.5 : 1 }}
                    >
                        <ArrowLeft size={18} /> Previous
                    </button>

                    <button
                        onClick={() => { setIsStarting(false); setActiveQuiz(null); }}
                        style={{ color: '#ef4444', background: 'transparent', padding: '10px' }}
                    >
                        Quit Quiz
                    </button>

                    {currentIdx === activeQuiz.questions.length - 1 ? (
                        <button onClick={submitQuiz} className="btn-primary" style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Submit Exam <CheckCircle size={18} />
                        </button>
                    ) : (
                        <button onClick={() => setCurrentIdx(currentIdx + 1)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Next <ArrowRight size={18} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (activeQuiz) {
        return (
            <div className="glass-panel" style={{ height: '100%', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <Award size={64} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                <h2 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{activeQuiz.title}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginBottom: '2rem', maxWidth: '600px' }}>
                    This quiz contains {activeQuiz.questions ? activeQuiz.questions.length : 0} questions covering {activeQuiz.module}. You will have {activeQuiz.timeLimit} to complete it.
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => setActiveQuiz(null)} className="btn-primary" style={{ background: 'var(--glass-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Cancel</button>
                    <button disabled={!activeQuiz.questions || activeQuiz.questions.length === 0} onClick={() => setIsStarting(true)} className="btn-primary" style={{ opacity: (!activeQuiz.questions || activeQuiz.questions.length === 0) ? 0.5 : 1 }}>
                        {(!activeQuiz.questions || activeQuiz.questions.length === 0) ? 'No Questions Available' : 'Start Quiz Now'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <button
                    onClick={() => setActiveTab('videos')}
                    style={{ padding: '8px 16px', borderRadius: '8px', background: activeTab === 'videos' ? 'var(--primary)' : 'transparent', color: activeTab === 'videos' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <PlayCircle size={18} /> Video Lectures
                </button>
                <button
                    onClick={() => { setActiveTab('quizzes'); loadQuizzes(); }}
                    style={{ padding: '8px 16px', borderRadius: '8px', background: activeTab === 'quizzes' ? 'var(--primary)' : 'transparent', color: activeTab === 'quizzes' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <FileText size={18} /> Quizzes & Assessments
                </button>
            </div>

            {activeTab === 'videos' && (
                <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100% - 60px)' }}>
                    <div className="glass-panel" style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {selectedVideo.youtubeId ? (
                                <iframe
                                    width="100%"
                                    height="100%"
                                    src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}`}
                                    title={selectedVideo.title}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    style={{ border: 'none' }}
                                ></iframe>
                            ) : (
                                <>
                                    <PlayCircle size={64} color="rgba(255,255,255,0.5)" />
                                    <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.7)', padding: '8px 16px', borderRadius: '8px' }}>
                                        <span style={{ color: 'var(--primary)', fontWeight: 600, marginRight: '8px' }}>{selectedVideo.module}</span>
                                        <span style={{ color: 'white' }}>{selectedVideo.title}</span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{selectedVideo.title}</h3>
                            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                In this lecture, we cover the essential elements of {selectedVideo.title.split(' ')[0]}. Follow along to understand the exact structure outlined in the course modules.
                            </p>
                        </div>
                    </div>

                    <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1.25rem' }}>Course Content</h3>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1, padding: '1rem' }}>
                            {MOCK_VIDEOS.map(video => (
                                <div
                                    key={video.id}
                                    onClick={() => setSelectedVideo(video)}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '1rem', borderRadius: '8px', background: selectedVideo.id === video.id ? 'var(--glass-border)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '0.5rem' }}
                                >
                                    <PlayCircle size={20} color={selectedVideo.id === video.id ? 'var(--primary)' : 'var(--text-muted)'} style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '2px' }}>{video.module}</div>
                                        <div style={{ fontSize: '1rem', color: selectedVideo.id === video.id ? 'white' : 'var(--text-muted)', marginBottom: '4px' }}>{video.title}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{video.duration}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'quizzes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', alignContent: 'start' }}>
                    {quizzes.map(quiz => (
                        <div key={quiz.id} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 600, background: quiz.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)', color: quiz.status === 'completed' ? '#10b981' : 'var(--primary)' }}>
                                    {quiz.status === 'completed' ? 'Completed' : 'Pending Action'}
                                </div>
                                {quiz.status === 'completed' && <CheckCircle size={20} color="#10b981" />}
                            </div>

                            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', flex: 1 }}>{quiz.title}</h3>

                            <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                <span>{quiz.questions ? quiz.questions.length : 0} Questions</span>
                                <span>•</span>
                                <span>{quiz.timeLimit}</span>
                            </div>

                            {quiz.status === 'completed' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--glass-bg)', borderRadius: '8px' }}>
                                        {quiz.showResultImmediately === false ? (
                                            <span style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>Awaiting emailed results...</span>
                                        ) : (
                                            <>
                                                <span style={{ color: 'var(--text-muted)' }}>Score Achieved</span>
                                                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>{quiz.score}</span>
                                            </>
                                        )}
                                    </div>
                                    <button onClick={() => { setActiveQuiz(quiz); setIsReviewMode(true); }} className="btn-primary" style={{ width: '100%', background: 'var(--glass-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                                        Review Quiz Content
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => startQuiz(quiz)} className="btn-primary" style={{ width: '100%' }}>View Quiz Details</button>
                            )}
                        </div>
                    ))}
                    {quizzes.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active quizzes available.</p>}
                </div>
            )}
        </div>
    );
}

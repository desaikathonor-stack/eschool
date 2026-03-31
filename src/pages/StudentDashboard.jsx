import { lazy, Suspense, useState } from 'react';
import Layout from '../components/Layout';

const Notes = lazy(() => import('../components/Notes'));
const TodoList = lazy(() => import('../components/TodoList'));
const Whiteboard = lazy(() => import('../components/Whiteboard'));
const Education = lazy(() => import('../components/Education'));
const Assignments = lazy(() => import('../components/Assignments'));
const Home = lazy(() => import('../components/Home'));

function TabLoader() {
    return (
        <div className="glass-panel" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Loading...
        </div>
    );
}

export default function StudentDashboard() {
    const [activeTab, setActiveTab] = useState('home');

    return (
        <Layout role="student" activeTab={activeTab} setActiveTab={setActiveTab}>
            <Suspense fallback={<TabLoader />}>
                {activeTab === 'home' && <Home setActiveTab={setActiveTab} role="student" />}
                {activeTab === 'notes' && <Notes />}
                {activeTab === 'todo' && <TodoList />}
                {activeTab === 'whiteboard' && <Whiteboard />}
                {activeTab === 'education' && <Education />}
                {activeTab === 'assignments' && <Assignments role="student" />}
            </Suspense>
        </Layout>
    );
}

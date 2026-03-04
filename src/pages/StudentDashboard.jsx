import { useState } from 'react';
import Layout from '../components/Layout';
import Notes from '../components/Notes';
import TodoList from '../components/TodoList';
import Whiteboard from '../components/Whiteboard';
import Education from '../components/Education';
import Assignments from '../components/Assignments';
import Home from '../components/Home';

export default function StudentDashboard() {
    const [activeTab, setActiveTab] = useState('home');

    return (
        <Layout role="student" activeTab={activeTab} setActiveTab={setActiveTab}>
            {activeTab === 'home' && <Home setActiveTab={setActiveTab} />}
            {activeTab === 'notes' && <Notes />}
            {activeTab === 'todo' && <TodoList />}
            {activeTab === 'whiteboard' && <Whiteboard />}
            {activeTab === 'education' && <Education />}
            {activeTab === 'assignments' && <Assignments role="student" />}
        </Layout>
    );
}

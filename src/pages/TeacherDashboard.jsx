import { useState } from 'react';
import Layout from '../components/Layout';
import Notes from '../components/Notes';
import TodoList from '../components/TodoList';
import Whiteboard from '../components/Whiteboard';
import TeacherQuizSettings from '../components/TeacherQuizSettings';
import Assignments from '../components/Assignments';
import Home from '../components/Home';

export default function TeacherDashboard() {
    const [activeTab, setActiveTab] = useState('home');

    return (
        <Layout role="teacher" activeTab={activeTab} setActiveTab={setActiveTab}>
            {activeTab === 'home' && <Home setActiveTab={setActiveTab} />}
            {activeTab === 'notes' && <Notes />}
            {activeTab === 'todo' && <TodoList />}
            {activeTab === 'whiteboard' && <Whiteboard />}
            {activeTab === 'quizSettings' && <TeacherQuizSettings />}
            {activeTab === 'assignments' && <Assignments role="teacher" />}
        </Layout>
    );
}

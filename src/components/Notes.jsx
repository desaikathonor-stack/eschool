import { useState } from 'react';
import { Save, Plus } from 'lucide-react';

export default function Notes() {
    const [notes, setNotes] = useState([
        { id: 1, title: 'Web Architecture', content: 'Web server handles HTTP requests and serves static content. Application server hosts business logic and returns dynamic content.' }
    ]);
    const [activeNote, setActiveNote] = useState(notes[0]);

    const saveNote = () => {
        setNotes(notes.map(n => n.id === activeNote.id ? activeNote : n));
    };

    const addNote = () => {
        const newNote = { id: Date.now(), title: 'New Note', content: '' };
        setNotes([newNote, ...notes]);
        setActiveNote(newNote);
    };

    return (
        <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
            <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>My Notes</h2>
                    <button onClick={addNote} style={{ background: 'var(--glass-bg)', padding: '8px', borderRadius: '8px', color: 'var(--primary)' }}><Plus size={20} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {notes.map(note => (
                        <div
                            key={note.id}
                            onClick={() => setActiveNote(note)}
                            style={{ padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem', background: activeNote.id === note.id ? 'var(--primary)' : 'var(--glass-bg)', color: activeNote.id === note.id ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <h3 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.25rem' }}>{note.title}</h3>
                            <p style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.content || 'Empty note...'}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <input
                        value={activeNote?.title || ''}
                        onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })}
                        style={{ fontSize: '1.5rem', fontWeight: 600, background: 'transparent', border: 'none', color: 'var(--text-main)', width: '100%' }}
                        placeholder="Note Title"
                    />
                    <button onClick={saveNote} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}><Save size={18} /> Save</button>
                </div>
                <textarea
                    value={activeNote?.content || ''}
                    onChange={(e) => setActiveNote({ ...activeNote, content: e.target.value })}
                    placeholder="Start typing your notes here..."
                    style={{ flex: 1, padding: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1rem', resize: 'none', lineHeight: '1.6' }}
                />
            </div>
        </div>
    );
}

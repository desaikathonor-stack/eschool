import { useRef, useState, useEffect } from 'react';
import { Pen, Eraser, Trash2, Download, Move, ChevronLeft, ChevronRight, Plus, Save, FolderOpen, X, ZoomIn, ZoomOut } from 'lucide-react';
import { jsPDF } from 'jspdf';
import API_BASE_URL from '../utils/api';

export default function Whiteboard() {
    const canvasContainerRef = useRef(null);
    const canvasRef = useRef(null);
    const contextRef = useRef(null);

    // Tools & State
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#f8fafc');
    const [lineWidth, setLineWidth] = useState(4);
    const [tool, setTool] = useState('pen'); // 'pen', 'eraser', 'pan'

    // Auth
    const currentUserEmail = localStorage.getItem('eschool_current_user') || 'student@eschool.com';

    // Infinite Canvas & Zoom State
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });

    // Slides & Gallery State
    const [slides, setSlides] = useState([{ lines: [] }]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showGallery, setShowGallery] = useState(false);
    const [savedBoards, setSavedBoards] = useState([]);
    const [boardTitle, setBoardTitle] = useState('Untitled Whiteboard');
    const [currentBoardId, setCurrentBoardId] = useState(null);

    // Current Drawing Line
    const currentLineRef = useRef(null);
    const redrawScheduledRef = useRef(false);
    const autoSaveTimerRef = useRef(null);

    const scheduleRedraw = () => {
        if (redrawScheduledRef.current) return;
        redrawScheduledRef.current = true;
        requestAnimationFrame(() => {
            redrawScheduledRef.current = false;
            redraw();
        });
    };

    // --- 1. Load Last Auto-Save or Pending Board ---
    useEffect(() => {
        const pendingId = localStorage.getItem('eschool_pending_board_id');

        if (pendingId) {
            // Load specific board from gallery
            fetch(`${API_BASE_URL.replace('/api', '')}/api/saved-whiteboards/board/${pendingId}`)
                .then(res => res.json())
                .then(data => {
                    try {
                        setSlides(JSON.parse(data.slides_data));
                        setBoardTitle(data.title);
                        setCurrentBoardId(data.id);
                        localStorage.removeItem('eschool_pending_board_id'); // Clear it
                    } catch (e) { console.error("Load pending error:", e); }
                });
        } else {
            // Default: Load last auto-save
            fetch(`${API_BASE_URL.replace('/api', '')}/api/whiteboards/${currentUserEmail}`)
                .then(res => res.json())
                .then(data => {
                    try {
                        const parsed = JSON.parse(data.slides_data);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setSlides(parsed);
                        }
                    } catch (e) { }
                })
                .catch(err => console.error("Failed to load whiteboard auto-save:", err));
        }
    }, [currentUserEmail]);

    // --- 2. Setup Canvas ---
    useEffect(() => {
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            const parent = canvasContainerRef.current;
            if (!canvas || !parent) return;

            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;

            const context = canvas.getContext('2d');
            context.lineCap = 'round';
            context.lineJoin = 'round';
            contextRef.current = context;

            scheduleRedraw();
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    // Trackpad / Mouse Wheel Scroll for Zoom and Pan
    useEffect(() => {
        const div = canvasContainerRef.current;
        if (!div) return;

        const handleWheel = (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Zoom
                const zoomSensitivity = 0.01;
                setScale(prev => Math.min(Math.max(0.1, prev - e.deltaY * zoomSensitivity), 10));
            } else {
                // Pan
                setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
            }
        };

        div.addEventListener('wheel', handleWheel, { passive: false });
        return () => div.removeEventListener('wheel', handleWheel);
    }, []);

    // Redraw on Pan/Scale/Slide Changes
    useEffect(() => {
        scheduleRedraw();
    }, [pan, scale, currentSlide, slides]);

    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, []);

    // Auto-save Background State
    const saveAutoState = (slidesData) => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            fetch(`${API_BASE_URL.replace('/api', '')}/api/whiteboards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUserEmail, slides_data: JSON.stringify(slidesData) })
            }).catch(err => console.error(err));
        }, 450);
    };

    // --- Gallery Functions ---
    const fetchGallery = () => {
        fetch(`${API_BASE_URL.replace('/api', '')}/api/saved-whiteboards/${currentUserEmail}`)
            .then(res => res.json())
            .then(data => {
                setSavedBoards(data);
                setShowGallery(true);
            });
    };

    const saveAsNewGalleryBoard = () => {
        const title = prompt("Enter a name for this Whiteboard:", "My Lesson");
        if (!title) return;

        fetch(`${API_BASE_URL.replace('/api', '')}/api/saved-whiteboards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUserEmail, title, slides_data: JSON.stringify(slides) })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert("Saved to gallery!");
                    setCurrentBoardId(data.id);
                    setBoardTitle(title);
                }
            });
    };

    const loadGalleryBoard = (id, title) => {
        fetch(`${API_BASE_URL.replace('/api', '')}/api/saved-whiteboards/board/${id}`)
            .then(res => res.json())
            .then(data => {
                try {
                    setSlides(JSON.parse(data.slides_data));
                    setCurrentSlide(0);
                    setPan({ x: 0, y: 0 });
                    setScale(1);
                    setCurrentBoardId(id);
                    setBoardTitle(title);
                    setShowGallery(false);
                } catch (e) { console.error("Could not parse board data."); }
            });
    };

    const deleteGalleryBoard = (id) => {
        fetch(`${API_BASE_URL.replace('/api', '')}/api/saved-whiteboards/${id}`, { method: 'DELETE' })
            .then(() => {
                setSavedBoards(prev => prev.filter(b => b.id !== id));
                if (currentBoardId === id) {
                    setCurrentBoardId(null);
                    setBoardTitle("Untitled Whiteboard");
                }
            });
    };

    // --- Rendering ---
    const redraw = () => {
        const canvas = canvasRef.current;
        const ctx = contextRef.current;
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(scale, scale);

        drawGrid(ctx, canvas.width, canvas.height, pan, scale);

        const slide = slides[currentSlide];
        if (slide && slide.lines) {
            slide.lines.forEach(line => drawLineStroke(ctx, line));
        }

        // Live drawing line
        if (currentLineRef.current) {
            drawLineStroke(ctx, currentLineRef.current);
        }

        ctx.restore();
    };

    const drawGrid = (ctx, width, height, panState, scaleState) => {
        const gridSize = 40;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';

        const startX = -panState.x / scaleState;
        const startY = -panState.y / scaleState;
        const endX = (width - panState.x) / scaleState;
        const endY = (height - panState.y) / scaleState;

        const offsetX = startX - (startX % gridSize);
        const offsetY = startY - (startY % gridSize);

        const projectedCols = Math.ceil((endX - startX) / gridSize) + 2;
        const projectedRows = Math.ceil((endY - startY) / gridSize) + 2;
        const maxPoints = 6000;
        const pointCount = Math.max(1, projectedCols * projectedRows);
        const densityStep = pointCount > maxPoints ? Math.ceil(Math.sqrt(pointCount / maxPoints)) : 1;
        const step = gridSize * densityStep;

        for (let x = offsetX - step; x < endX + step; x += step) {
            for (let y = offsetY - step; y < endY + step; y += step) {
                ctx.beginPath();
                ctx.arc(x, y, 1.5 / scaleState, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    };

    const drawLineStroke = (ctx, line) => {
        if (!line.points || line.points.length === 0) return;

        ctx.strokeStyle = line.tool === 'eraser' ? '#0f172a' : line.color;
        ctx.lineWidth = line.tool === 'eraser' ? 20 : line.size;

        ctx.beginPath();
        const first = line.points[0];
        ctx.moveTo(first.x, first.y);

        for (let i = 1; i < line.points.length; i++) {
            const p = line.points[i];
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    };

    // --- Mouse Handlers ---
    const handleMouseDown = (e) => {
        const { offsetX, offsetY } = e.nativeEvent;

        if (tool === 'pan') {
            setIsPanning(true);
            setStartPan({ x: offsetX - pan.x, y: offsetY - pan.y });
            return;
        }

        setIsDrawing(true);
        const logicalX = (offsetX - pan.x) / scale;
        const logicalY = (offsetY - pan.y) / scale;

        currentLineRef.current = {
            tool,
            color,
            size: lineWidth,
            points: [{ x: logicalX, y: logicalY }]
        };
        scheduleRedraw();
    };

    const handleMouseMove = (e) => {
        const { offsetX, offsetY } = e.nativeEvent;

        if (isPanning && tool === 'pan') {
            setPan({
                x: offsetX - startPan.x,
                y: offsetY - startPan.y
            });
            return;
        }

        if (!isDrawing || tool === 'pan') return;

        const logicalX = (offsetX - pan.x) / scale;
        const logicalY = (offsetY - pan.y) / scale;

        currentLineRef.current.points.push({ x: logicalX, y: logicalY });
        scheduleRedraw();
    };

    const handleMouseUp = () => {
        if (tool === 'pan') {
            setIsPanning(false);
            return;
        }
        if (!isDrawing) return;

        setIsDrawing(false);

        if (currentLineRef.current && currentLineRef.current.points.length > 0) {
            const newSlides = [...slides];
            if (!newSlides[currentSlide]) newSlides[currentSlide] = { lines: [] };
            newSlides[currentSlide].lines.push(currentLineRef.current);
            setSlides(newSlides);
            currentLineRef.current = null;

            saveAutoState(newSlides);
        }
    };

    // --- Export Fast PDF ---
    const handleDownloadPDF = () => {
        if (slides.length === 0) return;

        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1123, 794] });
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 1123; offCanvas.height = 794;
        const offCtx = offCanvas.getContext('2d');
        offCtx.lineCap = 'round'; offCtx.lineJoin = 'round';

        slides.forEach((slide, index) => {
            if (index > 0) pdf.addPage();

            offCtx.fillStyle = '#0f172a';
            offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            slide.lines.forEach(line => {
                line.points.forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y > maxY) maxY = p.y;
                });
            });

            if (slide.lines.length === 0) {
                pdf.addImage(offCanvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 1123, 794);
                return;
            }

            const margin = 50;
            const contentWidth = Math.max(maxX - minX, 1);
            const contentHeight = Math.max(maxY - minY, 1);

            const scaleX = (offCanvas.width - margin * 2) / contentWidth;
            const scaleY = (offCanvas.height - margin * 2) / contentHeight;
            const scaleFit = Math.min(scaleX, scaleY, 1);

            const centerOffsetX = (offCanvas.width - (contentWidth * scaleFit)) / 2;
            const centerOffsetY = (offCanvas.height - (contentHeight * scaleFit)) / 2;

            offCtx.save();
            offCtx.translate(centerOffsetX, centerOffsetY);
            offCtx.scale(scaleFit, scaleFit);
            offCtx.translate(-minX, -minY);

            slide.lines.forEach(line => {
                if (!line.points || line.points.length === 0) return;
                offCtx.strokeStyle = line.tool === 'eraser' ? '#0f172a' : line.color;
                offCtx.lineWidth = line.tool === 'eraser' ? 20 : line.size;
                offCtx.beginPath();
                offCtx.moveTo(line.points[0].x, line.points[0].y);
                for (let i = 1; i < line.points.length; i++) {
                    offCtx.lineTo(line.points[i].x, line.points[i].y);
                }
                offCtx.stroke();
            });

            offCtx.restore();
            pdf.addImage(offCanvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 1123, 794);
        });
        pdf.save(`${boardTitle.replace(/ /g, '_')}.pdf`);
    };

    const colors = ['#f8fafc', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    return (
        <div className="glass-panel" style={{ height: '85vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

            {/* Gallery Modal overlay */}
            {showGallery && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                    <div style={{ background: 'var(--bg-panel)', padding: '2rem', borderRadius: '16px', width: '500px', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 className="text-gradient">My Saved Whiteboards</h2>
                            <button onClick={() => setShowGallery(false)} style={{ color: 'var(--text-muted)' }}><X size={24} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                            {savedBoards.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No saved whiteboards yet.</p>
                            ) : (
                                savedBoards.map(board => (
                                    <div key={board.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1.1rem' }}>{board.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Created {new Date(board.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => loadGalleryBoard(board.id, board.title)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.9rem' }}>Open</button>
                                            <button onClick={() => deleteGalleryBoard(board.id)} style={{ padding: '6px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Top Toolbar */}
            <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-panel)', padding: '10px 20px', borderRadius: '32px', display: 'flex', gap: '1rem', alignItems: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 10, backdropFilter: 'blur(16px)', border: '1px solid var(--border-color)', flexWrap: 'wrap', justifyContent: 'center' }}>

                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '8px' }}>{boardTitle}</span>
                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

                <button onClick={fetchGallery} style={{ padding: '8px', color: 'var(--text-main)' }} title="Open Gallery">
                    <FolderOpen size={20} />
                </button>

                <button onClick={saveAsNewGalleryBoard} style={{ padding: '8px', color: '#10b981' }} title="Save as New Board">
                    <Save size={20} />
                </button>

                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

                <button onClick={() => setTool('pan')} style={{ padding: '8px', color: tool === 'pan' ? 'var(--primary)' : 'var(--text-muted)' }} title="Pan (Infinite Canvas)">
                    <Move size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-dark)', padding: '4px', borderRadius: '16px' }}>
                    <button onClick={() => setScale(s => Math.max(0.1, s - 0.2))} style={{ color: 'var(--text-muted)' }}><ZoomOut size={16} /></button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', width: '35px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(10, s + 0.2))} style={{ color: 'var(--text-muted)' }}><ZoomIn size={16} /></button>
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

                <button onClick={() => setTool('pen')} style={{ padding: '8px', color: tool === 'pen' ? 'var(--primary)' : 'var(--text-muted)' }} title="Pen">
                    <Pen size={20} />
                </button>
                <button onClick={() => setTool('eraser')} style={{ padding: '8px', color: tool === 'eraser' ? 'var(--primary)' : 'var(--text-muted)' }} title="Eraser">
                    <Eraser size={20} />
                </button>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px' }}>
                    {colors.map(c => (
                        <button key={c} onClick={() => { setColor(c); setTool('pen'); }} style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: color === c && tool === 'pen' ? '2px solid white' : '2px solid transparent', transform: color === c ? 'scale(1.2)' : 'scale(1)', transition: '0.2s' }} />
                    ))}
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

                <button onClick={() => { setSlides([{ lines: [] }]); setCurrentSlide(0); saveAutoState([{ lines: [] }]); }} style={{ padding: '8px', color: '#fca5a5' }} title="Clear Entire Document">
                    <Trash2 size={20} />
                </button>

                <button onClick={handleDownloadPDF} style={{ padding: '8px', color: 'var(--text-main)' }} title="Download Multi-page PDF">
                    <Download size={20} />
                </button>
            </div>

            {/* Slides / View Toolbar */}
            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-panel)', padding: '10px 20px', borderRadius: '32px', display: 'flex', gap: '1rem', alignItems: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 10, backdropFilter: 'blur(16px)', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setCurrentSlide(s => Math.max(0, s - 1))} disabled={currentSlide === 0} style={{ padding: '8px', color: currentSlide === 0 ? 'var(--text-muted)' : 'var(--text-main)', opacity: currentSlide === 0 ? 0.5 : 1 }} title="Previous Slide">
                    <ChevronLeft size={20} />
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 500 }}>
                        Slide {currentSlide + 1} of {slides.length}
                    </span>
                    {(pan.x !== 0 || pan.y !== 0 || scale !== 1) && (
                        <button onClick={() => { setPan({ x: 0, y: 0 }); setScale(1); }} style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '2px', background: 'transparent', border: 'none' }}>
                            Reset View
                        </button>
                    )}
                </div>

                <button onClick={() => setCurrentSlide(s => Math.min(slides.length - 1, s + 1))} disabled={currentSlide === slides.length - 1} style={{ padding: '8px', color: currentSlide === slides.length - 1 ? 'var(--text-muted)' : 'var(--text-main)', opacity: currentSlide === slides.length - 1 ? 0.5 : 1 }} title="Next Slide">
                    <ChevronRight size={20} />
                </button>

                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

                <button onClick={() => { const ns = [...slides, { lines: [] }]; setSlides(ns); setCurrentSlide(ns.length - 1); saveAutoState(ns); }} style={{ padding: '8px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }} title="New Slide">
                    <Plus size={16} /> New Slide
                </button>
            </div>

            {/* Canvas Area container */}
            <div
                ref={canvasContainerRef}
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    background: 'var(--bg-dark)',
                    cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair'
                }}
            >
                <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseOut={handleMouseUp}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%'
                    }}
                />
            </div>
        </div>
    );
}

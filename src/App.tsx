import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  Image as ImageIcon, 
  Video, 
  MonitorPlay, 
  LayoutTemplate, 
  PictureInPicture, 
  SplitSquareHorizontal,
  Plus,
  Trash2,
  Play,
  Pause,
  Circle,
  Square,
  Radio,
  RefreshCcw,
  Settings,
  Mic,
  MonitorUp,
  Sliders,
  Type,
  Layers,
  Volume2,
  VolumeX,
  Save
} from 'lucide-react';

type MediaType = 'camera' | 'image' | 'video' | 'screen';
type LayoutType = 'full' | 'pip' | 'news';
type TabType = 'media' | 'audio' | 'graphics' | 'scenes';

interface MediaSource {
  id: string;
  type: MediaType;
  name: string;
  url?: string;
  stream?: MediaStream;
  facingMode?: 'user' | 'environment';
  elementRef: React.RefObject<HTMLVideoElement | HTMLImageElement | null>;
  volume: number;
  muted: boolean;
}

interface Scene {
  id: string;
  name: string;
  layout: LayoutType;
  bgId: string | null;
  fgId: string | null;
}

export default function App() {
  // Core State
  const [sources, setSources] = useState<MediaSource[]>([]);
  const [activeBackgroundId, setActiveBackgroundId] = useState<string | null>(null);
  const [activeForegroundId, setActiveForegroundId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutType>('full');
  
  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('media');
  
  // Graphics State
  const [lowerThird, setLowerThird] = useState({ title: 'John Doe', subtitle: 'Guest Speaker', show: false });
  const [ticker, setTicker] = useState({ text: 'BREAKING NEWS: Live from Web Switcher Studio', show: false });
  
  // Scenes State
  const [scenes, setScenes] = useState<Scene[]>([]);

  // Broadcasting & Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  // Transition State (Refs for performance in animation loop)
  const transitionRef = useRef({
    active: false,
    startTime: 0,
    duration: 400, // ms
    oldBg: null as string | null,
    oldFg: null as string | null,
    oldLayout: 'full' as LayoutType
  });

  // Helper to trigger smooth transitions
  const applyTransition = (newBg: string | null, newFg: string | null, newLayout: LayoutType) => {
    if (newBg === activeBackgroundId && newFg === activeForegroundId && newLayout === layout) return;
    
    transitionRef.current = {
      active: true,
      startTime: performance.now(),
      duration: 400,
      oldBg: activeBackgroundId,
      oldFg: activeForegroundId,
      oldLayout: layout
    };
    
    setActiveBackgroundId(newBg);
    setActiveForegroundId(newFg);
    setLayout(newLayout);
  };

  // Initialize Camera
  const addCamera = async (facingMode: 'user' | 'environment' = 'user') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode }, 
        audio: true 
      });
      const id = `cam-${Date.now()}`;
      setSources(prev => [...prev, {
        id, type: 'camera', name: facingMode === 'user' ? 'Front Camera' : 'Back Camera',
        stream, facingMode, elementRef: React.createRef(), volume: 1, muted: false
      }]);
      if (!activeBackgroundId) applyTransition(id, activeForegroundId, layout);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please ensure permissions are granted.");
    }
  };

  // Initialize Screen Share
  const addScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });
      const id = `screen-${Date.now()}`;
      setSources(prev => [...prev, {
        id, type: 'screen', name: 'Screen Share',
        stream, elementRef: React.createRef(), volume: 1, muted: false
      }]);
      
      // Handle user stopping screen share via browser UI
      stream.getVideoTracks()[0].onended = () => removeSource(id);
      
      if (!activeBackgroundId) applyTransition(id, activeForegroundId, layout);
    } catch (err) {
      console.error("Error accessing screen:", err);
    }
  };

  // Flip Camera
  const flipCamera = async (id: string) => {
    const source = sources.find(s => s.id === id);
    if (!source || source.type !== 'camera') return;
    const newMode = source.facingMode === 'user' ? 'environment' : 'user';
    if (source.stream) source.stream.getTracks().forEach(t => t.stop());
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode }, audio: true });
      setSources(prev => prev.map(s => s.id === id ? { ...s, stream: newStream, facingMode: newMode, name: newMode === 'user' ? 'Front Camera' : 'Back Camera' } : s));
    } catch (err) {
      console.error("Error flipping camera:", err);
    }
  };

  // Handle File Uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const id = `media-${Date.now()}`;
    setSources(prev => [...prev, {
      id, type, name: file.name, url, elementRef: React.createRef(), volume: 1, muted: false
    }]);
  };

  const removeSource = (id: string) => {
    setSources(prev => {
      const source = prev.find(s => s.id === id);
      if (source?.stream) source.stream.getTracks().forEach(t => t.stop());
      if (source?.url) URL.revokeObjectURL(source.url);
      return prev.filter(s => s.id !== id);
    });
    if (activeBackgroundId === id) applyTransition(null, activeForegroundId, layout);
    if (activeForegroundId === id) applyTransition(activeBackgroundId, null, layout);
  };

  // Audio Controls
  const updateVolume = (id: string, volume: number) => {
    setSources(prev => prev.map(s => {
      if (s.id === id) {
        if (s.elementRef.current && 'volume' in s.elementRef.current) {
          s.elementRef.current.volume = volume;
        }
        return { ...s, volume };
      }
      return s;
    }));
  };

  const toggleMute = (id: string) => {
    setSources(prev => prev.map(s => {
      if (s.id === id) {
        const newMuted = !s.muted;
        if (s.elementRef.current && 'muted' in s.elementRef.current) {
          s.elementRef.current.muted = newMuted;
        }
        return { ...s, muted: newMuted };
      }
      return s;
    }));
  };

  // Scenes
  const saveScene = () => {
    const name = `Scene ${scenes.length + 1}`;
    setScenes(prev => [...prev, {
      id: `scene-${Date.now()}`,
      name,
      layout,
      bgId: activeBackgroundId,
      fgId: activeForegroundId
    }]);
  };

  // Recording Logic
  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
      setIsRecording(false);
    } else {
      if (!canvasRef.current) return;
      const stream = canvasRef.current.captureStream(30);
      
      // Mix audio from unmuted sources
      sources.forEach(s => {
        if (!s.muted) {
          if (s.stream) {
            s.stream.getAudioTracks().forEach(t => stream.addTrack(t));
          } else if (s.elementRef.current && s.type === 'video') {
            try {
              const anyEl = s.elementRef.current as any;
              if (anyEl.captureStream) {
                const vidStream = anyEl.captureStream();
                vidStream.getAudioTracks().forEach((t: MediaStreamTrack) => stream.addTrack(t));
              }
            } catch(e) {}
          }
        }
      });

      try {
        const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
          ? { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 5000000 }
          : { mimeType: 'video/webm', videoBitsPerSecond: 5000000 };
          
        const recorder = new MediaRecorder(stream, options);
        recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `SwitcherStudio_Record_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
          recordedChunks.current = [];
        };
        recorder.start(1000);
        mediaRecorder.current = recorder;
        setIsRecording(true);
      } catch (e) {
        console.error("MediaRecorder error:", e);
        alert("Recording is not supported in this browser.");
      }
    }
  };

  // Main Render Loop for the Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Helper to draw a single source
    const drawSourceElement = (sourceId: string | null, x: number, y: number, w: number, h: number, isNewsBg: boolean = false) => {
      if (!sourceId) return;
      const source = sources.find(s => s.id === sourceId);
      if (!source || !source.elementRef.current) return;

      const el = source.elementRef.current;
      if ((source.type === 'camera' || source.type === 'video' || source.type === 'screen') && el instanceof HTMLVideoElement) {
        if (el.paused && (source.type === 'camera' || source.type === 'screen')) el.play().catch(() => {});
      }

      try {
        if (isNewsBg) {
           ctx.filter = 'blur(15px) brightness(0.4)';
           ctx.drawImage(el, 0, 0, width, height);
           ctx.filter = 'none';
           
           const aspect = el instanceof HTMLVideoElement ? el.videoWidth / el.videoHeight : (el as HTMLImageElement).naturalWidth / (el as HTMLImageElement).naturalHeight;
           let drawW = w;
           let drawH = w / aspect;
           if (drawH > h) { drawH = h; drawW = h * aspect; }
           const drawX = x + (w - drawW) / 2;
           const drawY = y + (h - drawH) / 2;
           
           ctx.shadowColor = 'rgba(0,0,0,0.5)';
           ctx.shadowBlur = 20;
           ctx.drawImage(el, drawX, drawY, drawW, drawH);
           ctx.shadowColor = 'transparent';
        } else {
           ctx.drawImage(el, x, y, w, h);
        }
      } catch (e) {}
    };

    // Helper to draw an entire scene layout
    const drawScene = (bgId: string | null, fgId: string | null, currentLayout: LayoutType, alpha: number) => {
      ctx.globalAlpha = alpha;
      
      if (currentLayout === 'full') {
        drawSourceElement(bgId, 0, 0, width, height);
      } else if (currentLayout === 'pip') {
        drawSourceElement(bgId, 0, 0, width, height);
        const pipW = width * 0.3;
        const pipH = height * 0.3;
        const pipX = width - pipW - 30;
        const pipY = height - pipH - 30;
        
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        drawSourceElement(fgId, pipX, pipY, pipW, pipH);
        ctx.shadowColor = 'transparent';
        
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'white';
        ctx.strokeRect(pipX, pipY, pipW, pipH);
      } else if (currentLayout === 'news') {
        drawSourceElement(bgId, 0, 0, width * 0.65, height, true);
        drawSourceElement(fgId, width * 0.65, 0, width * 0.35, height);
        ctx.fillStyle = 'white';
        ctx.fillRect(width * 0.65, 0, 6, height);
      }
      ctx.globalAlpha = 1.0;
    };

    // Handle Transitions
    let progress = 1;
    if (transitionRef.current.active) {
      const elapsed = performance.now() - transitionRef.current.startTime;
      progress = Math.min(elapsed / transitionRef.current.duration, 1);
      if (progress >= 1) transitionRef.current.active = false;
    }

    if (progress < 1) {
      // Draw old scene fading out, new scene fading in
      drawScene(transitionRef.current.oldBg, transitionRef.current.oldFg, transitionRef.current.oldLayout, 1);
      drawScene(activeBackgroundId, activeForegroundId, layout, progress);
    } else {
      drawScene(activeBackgroundId, activeForegroundId, layout, 1);
    }

    // Draw Graphics Overlays (Always on top, not affected by transitions)
    
    // News Ticker
    if (ticker.show || layout === 'news') {
      const tickerText = ticker.show ? ticker.text : 'LIVE: BREAKING NEWS';
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, height - 70, width, 70);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(tickerText, 30, height - 25);
    }

    // Lower Third
    if (lowerThird.show && layout !== 'news') {
      const padding = 30;
      const boxHeight = 100;
      const boxWidth = 500;
      const y = height - boxHeight - (ticker.show ? 90 : 40);
      
      // Background gradient
      const grad = ctx.createLinearGradient(padding, y, padding + boxWidth, y);
      grad.addColorStop(0, 'rgba(220, 38, 38, 0.95)'); // Red
      grad.addColorStop(1, 'rgba(185, 28, 28, 0.8)');
      
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 5;
      
      // Draw angled box
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + boxWidth, y);
      ctx.lineTo(padding + boxWidth - 30, y + boxHeight);
      ctx.lineTo(padding, y + boxHeight);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(lowerThird.title, padding + 25, y + 45);
      
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '22px sans-serif';
      ctx.fillText(lowerThird.subtitle, padding + 25, y + 80);
    }

    // "LIVE" Badge (if layout is news)
    if (layout === 'news') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(width - 120, 20, 100, 40);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('LIVE', width - 95, 48);
    }

    // Recording Indicator
    if (isRecording) {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(40, 40, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('REC', 60, 46);
    }

    requestRef.current = requestAnimationFrame(renderCanvas);
  }, [sources, activeBackgroundId, activeForegroundId, layout, isRecording, lowerThird, ticker]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(requestRef.current);
  }, [renderCanvas]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-red-500/30">
      {/* Live Broadcasting Modal */}
      {showLiveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Radio className="w-6 h-6 text-red-500" />
              Broadcast to Social Media
            </h3>
            <p className="text-sm text-neutral-400 mb-6">
              Enter your RTMP destination to stream live to YouTube, Facebook, or Twitch.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">RTMP Server URL</label>
                <input type="text" placeholder="rtmp://a.rtmp.youtube.com/live2" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Stream Key</label>
                <input type="password" placeholder="xxxx-xxxx-xxxx-xxxx" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition-colors" />
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <p className="text-xs text-blue-400 leading-relaxed">
                <strong>Note:</strong> Direct RTMP streaming from a web browser requires a backend WebRTC-to-RTMP gateway. For this web prototype, use the <strong>Record</strong> button in the main UI to save a high-quality local copy of your broadcast!
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowLiveModal(false)} className="px-5 py-2.5 rounded-lg font-semibold text-sm text-neutral-300 hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={() => { setShowLiveModal(false); setIsLive(true); }} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-2">
                <Radio className="w-4 h-4" />
                Start Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#111111] border-b border-white/5 h-16 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)]">
            <MonitorPlay className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-wide text-neutral-100">SWITCHER<span className="text-neutral-500 font-normal">STUDIO</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleRecording}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs tracking-widest uppercase transition-all duration-300 border ${
              isRecording ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-[#1a1a1a] border-white/10 text-neutral-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-4 h-4 fill-current text-red-500" />}
            {isRecording ? 'Recording...' : 'Record'}
          </button>

          <button 
            onClick={() => isLive ? setIsLive(false) : setShowLiveModal(true)}
            className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-xs tracking-widest uppercase transition-all duration-300 border ${
              isLive ? 'bg-red-500 border-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse' : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]'
            }`}
          >
            <Radio className="w-4 h-4" />
            {isLive ? 'End Live' : 'Go Live'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        {/* Left Column: Program Monitor & Controls */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Program Monitor */}
          <div className="bg-[#111111] rounded-2xl border border-white/5 p-2 flex-1 flex flex-col shadow-2xl">
            <div className="flex-1 bg-black rounded-xl overflow-hidden relative border border-white/5">
              <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Layout Controls */}
          <div className="bg-[#111111] rounded-2xl border border-white/5 p-5 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-neutral-400 tracking-widest uppercase">Program Layout</h2>
              <div className="flex items-center gap-2 text-xs text-neutral-500 bg-[#0a0a0a] px-3 py-1.5 rounded-lg border border-white/5">
                <Settings className="w-4 h-4" />
                <span>Transition: Crossfade (400ms)</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <button 
                onClick={() => applyTransition(activeBackgroundId, activeForegroundId, 'full')}
                className={`h-24 flex flex-col items-center justify-center gap-3 rounded-xl border transition-all duration-200 ${layout === 'full' ? 'bg-neutral-800 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-[#0a0a0a] border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'}`}
              >
                <LayoutTemplate className={`w-8 h-8 ${layout === 'full' ? 'text-red-500' : ''}`} />
                <span className="text-xs font-semibold tracking-wide uppercase">Full Screen</span>
              </button>
              <button 
                onClick={() => applyTransition(activeBackgroundId, activeForegroundId, 'pip')}
                className={`h-24 flex flex-col items-center justify-center gap-3 rounded-xl border transition-all duration-200 ${layout === 'pip' ? 'bg-neutral-800 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-[#0a0a0a] border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'}`}
              >
                <PictureInPicture className={`w-8 h-8 ${layout === 'pip' ? 'text-red-500' : ''}`} />
                <span className="text-xs font-semibold tracking-wide uppercase">Picture in Picture</span>
              </button>
              <button 
                onClick={() => applyTransition(activeBackgroundId, activeForegroundId, 'news')}
                className={`h-24 flex flex-col items-center justify-center gap-3 rounded-xl border transition-all duration-200 ${layout === 'news' ? 'bg-neutral-800 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-[#0a0a0a] border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'}`}
              >
                <SplitSquareHorizontal className={`w-8 h-8 ${layout === 'news' ? 'text-red-500' : ''}`} />
                <span className="text-xs font-semibold tracking-wide uppercase">News Split</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Tab Panel */}
        <div className="w-full lg:w-[420px] bg-[#111111] rounded-2xl border border-white/5 flex flex-col shrink-0 overflow-hidden shadow-2xl">
          {/* Tabs */}
          <div className="flex border-b border-white/5 bg-[#151515]">
            <button onClick={() => setActiveTab('media')} className={`flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-colors flex flex-col items-center gap-2 ${activeTab === 'media' ? 'text-red-500 border-b-2 border-red-500 bg-[#1a1a1a]' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <MonitorPlay className="w-5 h-5" /> Media
            </button>
            <button onClick={() => setActiveTab('audio')} className={`flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-colors flex flex-col items-center gap-2 ${activeTab === 'audio' ? 'text-red-500 border-b-2 border-red-500 bg-[#1a1a1a]' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <Sliders className="w-5 h-5" /> Audio
            </button>
            <button onClick={() => setActiveTab('graphics')} className={`flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-colors flex flex-col items-center gap-2 ${activeTab === 'graphics' ? 'text-red-500 border-b-2 border-red-500 bg-[#1a1a1a]' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <Type className="w-5 h-5" /> Graphics
            </button>
            <button onClick={() => setActiveTab('scenes')} className={`flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-colors flex flex-col items-center gap-2 ${activeTab === 'scenes' ? 'text-red-500 border-b-2 border-red-500 bg-[#1a1a1a]' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <Layers className="w-5 h-5" /> Scenes
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#0a0a0a]/50">
            
            {/* MEDIA TAB */}
            {activeTab === 'media' && (
              <div className="flex flex-col h-full">
                <div className="p-5 border-b border-white/5 bg-[#111111]">
                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => addCamera('user')} className="flex flex-col items-center justify-center gap-2 h-20 bg-[#0a0a0a] hover:bg-neutral-800 border border-white/5 hover:border-white/10 rounded-xl transition-all group" title="Add Camera">
                      <Camera className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-bold tracking-wider text-neutral-400 uppercase">Camera</span>
                    </button>
                    <button onClick={addScreenShare} className="flex flex-col items-center justify-center gap-2 h-20 bg-[#0a0a0a] hover:bg-neutral-800 border border-white/5 hover:border-white/10 rounded-xl transition-all group" title="Share Screen">
                      <MonitorUp className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-bold tracking-wider text-neutral-400 uppercase">Screen</span>
                    </button>
                    <label className="flex flex-col items-center justify-center gap-2 h-20 bg-[#0a0a0a] hover:bg-neutral-800 border border-white/5 hover:border-white/10 rounded-xl transition-all cursor-pointer group" title="Add Image">
                      <ImageIcon className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-bold tracking-wider text-neutral-400 uppercase">Image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
                    </label>
                    <label className="flex flex-col items-center justify-center gap-2 h-20 bg-[#0a0a0a] hover:bg-neutral-800 border border-white/5 hover:border-white/10 rounded-xl transition-all cursor-pointer group" title="Add Video">
                      <Video className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-bold tracking-wider text-neutral-400 uppercase">Video</span>
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
                    </label>
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-4">
                  {sources.length === 0 ? (
                    <div className="text-center text-neutral-500 py-12 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-neutral-900 border border-white/5 flex items-center justify-center mb-2">
                        <Plus className="w-8 h-8 text-neutral-600" />
                      </div>
                      <p className="text-sm font-medium">No media sources</p>
                    </div>
                  ) : (
                    sources.map(source => (
                      <div key={source.id} className="bg-[#151515] border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-lg">
                        <div className="hidden">
                          {source.type === 'camera' && <video autoPlay playsInline muted ref={(el) => { if (el && source.stream && el.srcObject !== source.stream) el.srcObject = source.stream; /* @ts-ignore */ source.elementRef.current = el; }} />}
                          {source.type === 'screen' && <video autoPlay playsInline muted ref={(el) => { if (el && source.stream && el.srcObject !== source.stream) el.srcObject = source.stream; /* @ts-ignore */ source.elementRef.current = el; }} />}
                          {source.type === 'video' && <video ref={source.elementRef as React.RefObject<HTMLVideoElement>} src={source.url} loop playsInline crossOrigin="anonymous" />}
                          {source.type === 'image' && <img ref={source.elementRef as React.RefObject<HTMLImageElement>} src={source.url} alt={source.name} crossOrigin="anonymous" />}
                        </div>

                        <div className="p-4 flex items-center justify-between border-b border-white/5 bg-[#1a1a1a]">
                          <div className="flex items-center gap-3 truncate">
                            <div className="p-2 rounded-lg bg-[#0a0a0a] border border-white/5 relative">
                              {source.type === 'camera' && <Camera className="w-4 h-4 text-emerald-500" />}
                              {source.type === 'screen' && <MonitorUp className="w-4 h-4 text-orange-500" />}
                              {source.type === 'image' && <ImageIcon className="w-4 h-4 text-blue-500" />}
                              {source.type === 'video' && <Video className="w-4 h-4 text-purple-500" />}
                              {(source.type === 'camera' || source.type === 'video' || source.type === 'screen') && (
                                <div className={`absolute -bottom-1 -right-1 bg-zinc-800 rounded-full p-0.5 border border-zinc-900 ${source.muted ? 'opacity-50' : ''}`}>
                                  {source.muted ? <VolumeX className="w-2.5 h-2.5 text-red-400" /> : <Mic className="w-2.5 h-2.5 text-green-400" />}
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-neutral-200 truncate">{source.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {source.type === 'camera' && (
                              <button onClick={() => flipCamera(source.id)} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                                <RefreshCcw className="w-4 h-4" />
                              </button>
                            )}
                            {source.type === 'video' && (
                              <button onClick={() => { const el = source.elementRef.current as HTMLVideoElement; if (el) el.paused ? el.play() : el.pause(); }} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => removeSource(source.id)} className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 grid grid-cols-2 gap-3 bg-[#111111]">
                          <button onClick={() => applyTransition(source.id, activeForegroundId, layout)} className={`h-12 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 flex items-center justify-center border ${activeBackgroundId === source.id ? 'bg-red-500 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-[#0a0a0a] border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}>
                            Background
                          </button>
                          <button onClick={() => applyTransition(activeBackgroundId, source.id, layout)} disabled={layout === 'full'} className={`h-12 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 flex items-center justify-center border ${layout === 'full' ? 'opacity-30 cursor-not-allowed bg-[#0a0a0a] border-white/5 text-neutral-600' : activeForegroundId === source.id ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-[#0a0a0a] border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}>
                            Foreground
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* AUDIO TAB */}
            {activeTab === 'audio' && (
              <div className="p-5 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Audio Mixer</h3>
                {sources.filter(s => s.type !== 'image').length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-8">No audio sources available.</p>
                ) : (
                  sources.filter(s => s.type !== 'image').map(source => (
                    <div key={`audio-${source.id}`} className="bg-[#151515] border border-white/5 rounded-xl p-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-neutral-200 truncate">{source.name}</span>
                        <button onClick={() => toggleMute(source.id)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${source.muted ? 'bg-red-500/20 text-red-500' : 'bg-neutral-800 text-green-400 hover:bg-neutral-700'}`}>
                          {source.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <VolumeX className="w-4 h-4 text-neutral-600" />
                        <input 
                          type="range" min="0" max="1" step="0.01" 
                          value={source.muted ? 0 : source.volume} 
                          onChange={(e) => updateVolume(source.id, parseFloat(e.target.value))}
                          className="flex-1 accent-red-500 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                        />
                        <Volume2 className="w-4 h-4 text-neutral-600" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* GRAPHICS TAB */}
            {activeTab === 'graphics' && (
              <div className="p-5 flex flex-col gap-6">
                {/* Lower Third */}
                <div className="bg-[#151515] border border-white/5 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-neutral-200">Lower Third</h3>
                    <button 
                      onClick={() => setLowerThird(prev => ({ ...prev, show: !prev.show }))}
                      className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${lowerThird.show ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                    >
                      {lowerThird.show ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Title</label>
                      <input type="text" value={lowerThird.title} onChange={e => setLowerThird(prev => ({ ...prev, title: e.target.value }))} className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Subtitle</label>
                      <input type="text" value={lowerThird.subtitle} onChange={e => setLowerThird(prev => ({ ...prev, subtitle: e.target.value }))} className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Ticker */}
                <div className="bg-[#151515] border border-white/5 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-neutral-200">News Ticker</h3>
                    <button 
                      onClick={() => setTicker(prev => ({ ...prev, show: !prev.show }))}
                      className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${ticker.show ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                    >
                      {ticker.show ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Ticker Text</label>
                    <input type="text" value={ticker.text} onChange={e => setTicker(prev => ({ ...prev, text: e.target.value }))} className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none" />
                  </div>
                </div>
              </div>
            )}

            {/* SCENES TAB */}
            {activeTab === 'scenes' && (
              <div className="p-5 flex flex-col gap-4">
                <button onClick={saveScene} className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors">
                  <Save className="w-4 h-4" /> Save Current State as Scene
                </button>
                
                <div className="flex flex-col gap-3 mt-4">
                  {scenes.length === 0 ? (
                    <p className="text-sm text-neutral-500 text-center py-4">No saved scenes.</p>
                  ) : (
                    scenes.map(scene => (
                      <button 
                        key={scene.id}
                        onClick={() => applyTransition(scene.bgId, scene.fgId, scene.layout)}
                        className="bg-[#151515] hover:bg-[#1a1a1a] border border-white/5 hover:border-red-500/50 rounded-xl p-4 flex items-center justify-between group transition-all text-left"
                      >
                        <div>
                          <h4 className="font-bold text-neutral-200 group-hover:text-red-400 transition-colors">{scene.name}</h4>
                          <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">{scene.layout} Layout</p>
                        </div>
                        <Play className="w-5 h-5 text-neutral-600 group-hover:text-red-500 transition-colors" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

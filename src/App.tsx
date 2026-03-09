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
  Pause
} from 'lucide-react';

type MediaType = 'camera' | 'image' | 'video';
type LayoutType = 'full' | 'pip' | 'news';

interface MediaSource {
  id: string;
  type: MediaType;
  name: string;
  url?: string;
  stream?: MediaStream;
  elementRef: React.RefObject<HTMLVideoElement | HTMLImageElement | null>;
}

export default function App() {
  const [sources, setSources] = useState<MediaSource[]>([]);
  const [activeBackgroundId, setActiveBackgroundId] = useState<string | null>(null);
  const [activeForegroundId, setActiveForegroundId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutType>('full');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  // Initialize Camera
  const addCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const id = `cam-${Date.now()}`;
      setSources(prev => [...prev, {
        id,
        type: 'camera',
        name: 'Webcam',
        stream,
        elementRef: React.createRef()
      }]);
      if (!activeBackgroundId) setActiveBackgroundId(id);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please ensure permissions are granted.");
    }
  };

  // Handle File Uploads (Images/Videos)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const id = `media-${Date.now()}`;
    
    setSources(prev => [...prev, {
      id,
      type,
      name: file.name,
      url,
      elementRef: React.createRef()
    }]);
  };

  const removeSource = (id: string) => {
    setSources(prev => {
      const source = prev.find(s => s.id === id);
      if (source?.stream) {
        source.stream.getTracks().forEach(t => t.stop());
      }
      if (source?.url) {
        URL.revokeObjectURL(source.url);
      }
      return prev.filter(s => s.id !== id);
    });
    if (activeBackgroundId === id) setActiveBackgroundId(null);
    if (activeForegroundId === id) setActiveForegroundId(null);
  };

  // Main Render Loop for the Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawSource = (sourceId: string | null, x: number, y: number, w: number, h: number, isNewsBg: boolean = false) => {
      if (!sourceId) return;
      const source = sources.find(s => s.id === sourceId);
      if (!source || !source.elementRef.current) return;

      const el = source.elementRef.current;
      
      // Ensure video is playing
      if ((source.type === 'camera' || source.type === 'video') && el instanceof HTMLVideoElement) {
        if (el.paused && source.type === 'camera') el.play().catch(() => {});
      }

      try {
        if (isNewsBg) {
           // Draw blurred background for news layout
           ctx.filter = 'blur(10px) brightness(0.5)';
           ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
           ctx.filter = 'none';
           
           // Draw actual image fitted
           const aspect = el instanceof HTMLVideoElement ? el.videoWidth / el.videoHeight : (el as HTMLImageElement).naturalWidth / (el as HTMLImageElement).naturalHeight;
           let drawW = w;
           let drawH = w / aspect;
           if (drawH > h) {
             drawH = h;
             drawW = h * aspect;
           }
           const drawX = x + (w - drawW) / 2;
           const drawY = y + (h - drawH) / 2;
           ctx.drawImage(el, drawX, drawY, drawW, drawH);
        } else {
           // Standard draw (stretch to fit for now, could be improved to cover/contain)
           ctx.drawImage(el, x, y, w, h);
        }
      } catch (e) {
        // Ignore draw errors (e.g., if image isn't loaded yet)
      }
    };

    const width = canvas.width;
    const height = canvas.height;

    if (layout === 'full') {
      drawSource(activeBackgroundId, 0, 0, width, height);
    } else if (layout === 'pip') {
      drawSource(activeBackgroundId, 0, 0, width, height);
      // Draw PIP in bottom right
      const pipW = width * 0.3;
      const pipH = height * 0.3;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'white';
      drawSource(activeForegroundId, width - pipW - 20, height - pipH - 20, pipW, pipH);
      ctx.strokeRect(width - pipW - 20, height - pipH - 20, pipW, pipH);
    } else if (layout === 'news') {
      // News layout: Background media on left/full, camera on right
      drawSource(activeBackgroundId, 0, 0, width * 0.65, height, true);
      
      // Foreground (usually camera) on the right
      drawSource(activeForegroundId, width * 0.65, 0, width * 0.35, height);
      
      // Draw a "News Ticker" bar at the bottom
      ctx.fillStyle = '#dc2626'; // Red bar
      ctx.fillRect(0, height - 60, width, 60);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('LIVE: BREAKING NEWS', 20, height - 22);
      
      // Separator line
      ctx.fillStyle = 'white';
      ctx.fillRect(width * 0.65, 0, 4, height);
    }

    requestRef.current = requestAnimationFrame(renderCanvas);
  }, [sources, activeBackgroundId, activeForegroundId, layout]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(requestRef.current);
  }, [renderCanvas]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="bg-[#111111] border-b border-white/5 h-16 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)]">
            <MonitorPlay className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-wide text-neutral-100">SWITCHER<span className="text-neutral-500 font-normal">STUDIO</span></h1>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
          <span className="text-xs font-bold tracking-widest text-red-500">LIVE</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        {/* Left Column: Program Monitor & Controls */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Program Monitor */}
          <div className="bg-[#111111] rounded-2xl border border-white/5 p-2 flex-1 flex flex-col shadow-2xl">
            <div className="flex-1 bg-black rounded-xl overflow-hidden relative border border-white/5">
              <canvas 
                ref={canvasRef} 
                width={1280} 
                height={720} 
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Layout Controls */}
          <div className="bg-[#111111] rounded-2xl border border-white/5 p-5 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-neutral-400 tracking-widest uppercase">Program Layout</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <button 
                onClick={() => setLayout('full')}
                className={`h-24 flex flex-col items-center justify-center gap-3 rounded-xl border transition-all duration-200 ${layout === 'full' ? 'bg-neutral-800 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-[#0a0a0a] border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'}`}
              >
                <LayoutTemplate className={`w-8 h-8 ${layout === 'full' ? 'text-red-500' : ''}`} />
                <span className="text-xs font-semibold tracking-wide uppercase">Full Screen</span>
              </button>
              <button 
                onClick={() => setLayout('pip')}
                className={`h-24 flex flex-col items-center justify-center gap-3 rounded-xl border transition-all duration-200 ${layout === 'pip' ? 'bg-neutral-800 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-[#0a0a0a] border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'}`}
              >
                <PictureInPicture className={`w-8 h-8 ${layout === 'pip' ? 'text-red-500' : ''}`} />
                <span className="text-xs font-semibold tracking-wide uppercase">Picture in Picture</span>
              </button>
              <button 
                onClick={() => setLayout('news')}
                className={`h-24 flex flex-col items-center justify-center gap-3 rounded-xl border transition-all duration-200 ${layout === 'news' ? 'bg-neutral-800 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-[#0a0a0a] border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'}`}
              >
                <SplitSquareHorizontal className={`w-8 h-8 ${layout === 'news' ? 'text-red-500' : ''}`} />
                <span className="text-xs font-semibold tracking-wide uppercase">News Split</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Media Pool */}
        <div className="w-full lg:w-[420px] bg-[#111111] rounded-2xl border border-white/5 flex flex-col shrink-0 overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-[#151515]">
            <h2 className="text-xs font-bold text-neutral-400 tracking-widest uppercase mb-4">Add Source</h2>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={addCamera} className="flex flex-col items-center justify-center gap-2 h-20 bg-[#0a0a0a] hover:bg-neutral-800 border border-white/5 hover:border-white/10 rounded-xl transition-all group" title="Add Camera">
                <Camera className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Camera</span>
              </button>
              <label className="flex flex-col items-center justify-center gap-2 h-20 bg-[#0a0a0a] hover:bg-neutral-800 border border-white/5 hover:border-white/10 rounded-xl transition-all cursor-pointer group" title="Add Image">
                <ImageIcon className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Image</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
              </label>
              <label className="flex flex-col items-center justify-center gap-2 h-20 bg-[#0a0a0a] hover:bg-neutral-800 border border-white/5 hover:border-white/10 rounded-xl transition-all cursor-pointer group" title="Add Video">
                <Video className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Video</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-[#0a0a0a]/50">
            {sources.length === 0 ? (
              <div className="text-center text-neutral-500 py-12 flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-neutral-900 border border-white/5 flex items-center justify-center mb-2">
                  <Plus className="w-8 h-8 text-neutral-600" />
                </div>
                <p className="text-sm font-medium">No media sources</p>
                <p className="text-xs text-neutral-600">Add a camera, image, or video to begin mixing.</p>
              </div>
            ) : (
              sources.map(source => (
                <div key={source.id} className="bg-[#151515] border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-lg">
                  {/* Hidden actual media elements used for canvas rendering */}
                  <div className="hidden">
                    {source.type === 'camera' && (
                      <video 
                        autoPlay 
                        playsInline 
                        muted 
                        ref={(el) => {
                          if (el && source.stream && el.srcObject !== source.stream) {
                            el.srcObject = source.stream;
                          }
                          // @ts-ignore
                          source.elementRef.current = el;
                        }}
                      />
                    )}
                    {source.type === 'video' && (
                      <video 
                        ref={source.elementRef as React.RefObject<HTMLVideoElement>} 
                        src={source.url} 
                        loop 
                        playsInline
                        crossOrigin="anonymous"
                      />
                    )}
                    {source.type === 'image' && (
                      <img 
                        ref={source.elementRef as React.RefObject<HTMLImageElement>} 
                        src={source.url} 
                        alt={source.name}
                        crossOrigin="anonymous" 
                      />
                    )}
                  </div>

                  {/* UI Representation */}
                  <div className="p-4 flex items-center justify-between border-b border-white/5 bg-[#1a1a1a]">
                    <div className="flex items-center gap-3 truncate">
                      <div className="p-2 rounded-lg bg-[#0a0a0a] border border-white/5">
                        {source.type === 'camera' && <Camera className="w-4 h-4 text-emerald-500" />}
                        {source.type === 'image' && <ImageIcon className="w-4 h-4 text-blue-500" />}
                        {source.type === 'video' && <Video className="w-4 h-4 text-purple-500" />}
                      </div>
                      <span className="text-sm font-semibold text-neutral-200 truncate">{source.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {source.type === 'video' && (
                        <button 
                          onClick={() => {
                            const el = source.elementRef.current as HTMLVideoElement;
                            if (el) el.paused ? el.play() : el.pause();
                          }}
                          className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => removeSource(source.id)}
                        className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Assignment Controls */}
                  <div className="p-3 grid grid-cols-2 gap-3 bg-[#111111]">
                    <button 
                      onClick={() => setActiveBackgroundId(source.id)}
                      className={`h-12 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 flex items-center justify-center border ${
                        activeBackgroundId === source.id 
                          ? 'bg-red-500 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                          : 'bg-[#0a0a0a] border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                      }`}
                    >
                      Background
                    </button>
                    <button 
                      onClick={() => setActiveForegroundId(source.id)}
                      disabled={layout === 'full'}
                      className={`h-12 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 flex items-center justify-center border ${
                        layout === 'full' 
                          ? 'opacity-30 cursor-not-allowed bg-[#0a0a0a] border-white/5 text-neutral-600' 
                          : activeForegroundId === source.id 
                            ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                            : 'bg-[#0a0a0a] border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                      }`}
                    >
                      Foreground
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

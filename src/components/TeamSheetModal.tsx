import React, { useState, useRef, useEffect } from 'react';
import { Team, Player, Settings } from '../types';
import { X, Plus, Trash2, Save, Users, Layout, List, Shield, ShieldAlert, Camera, Move, RefreshCw, Star, ChevronRight, Search, Info, RotateCcw, Image as ImageIcon, Pencil, Upload, Download } from 'lucide-react';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { useExport } from '../contexts/ExportContext';
import { generateId, cn } from '../utils';
import { exportAsImage } from '../utils/exportImage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const PlayerPhoto = ({ player, className }: { player: Player, className?: string }) => {
  if (player.photoUrl && !player.photoUrl.includes('pravatar.cc')) {
    return <img src={player.photoUrl} alt={player.name} className={cn("object-cover", className)} referrerPolicy="no-referrer" />;
  }
  return (
    <div className={cn("bg-indigo-600 flex items-center justify-center text-white font-black italic font-display text-3xl", className)}>
      {player.name ? player.name.charAt(0).toUpperCase() : '?'}
    </div>
  );
};

interface TeamSheetModalProps {
  team: Team;
  settings: Settings;
  onSave: (id: string, updates: Partial<Team>) => void;
  onClose: () => void;
}

export function TeamSheetModal({ team, settings, onSave, onClose }: TeamSheetModalProps) {
  if (!team) return null;
  const [players, setPlayers] = useState<Player[]>(team.players || []);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('MF');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'pitch'>('pitch');
  const { setExportOptions } = useExport();

  useEffect(() => {
    if (viewMode === 'pitch') {
      setExportOptions([
        { label: `Export ${team.name} Pitch (Image)`, icon: <ImageIcon className="w-4 h-4" />, onClick: () => exportAsImage(pitchRef.current, `${team.name.toLowerCase().replace(/\s+/g, '-')}-pitch`) }
      ]);
    } else {
      setExportOptions([]);
    }
    
    return () => setExportOptions([]);
  }, [viewMode, team.name, setExportOptions]);

  const [subbingPlayerId, setSubbingPlayerId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const pitchRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  const isDraggingRef = useRef(false);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [pitchSize, setPitchSize] = useState<{width: number, height: number} | undefined>(() => {
    if (team.pitchSize) return team.pitchSize;
    try {
      const savedLayout = localStorage.getItem('defaultPitchLayout');
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        return parsed.pitchSize;
      }
    } catch (e) {
      console.error('Failed to parse default layout', e);
    }
    return undefined;
  });
  const [pitchScrollPosition, setPitchScrollPosition] = useState<{x: number, y: number} | undefined>(() => {
    if (team.pitchScrollPosition) return team.pitchScrollPosition;
    try {
      const savedLayout = localStorage.getItem('defaultPitchLayout');
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        return parsed.pitchScrollPosition;
      }
    } catch (e) {
      console.error('Failed to parse default layout', e);
    }
    return undefined;
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentScrollPosRef = useRef<{x: number, y: number} | undefined>(pitchScrollPosition);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef<{x: number, y: number, w: number, h: number} | null>(null);

  useKeyboardShortcut('i', () => {
    if (viewMode === 'pitch') {
      exportAsImage(pitchRef.current, `${team.name.toLowerCase().replace(/\s+/g, '-')}-pitch`);
    }
  });

  const activePlayers = players.filter(p => p.isActive);
  const benchPlayers = players.filter(p => !p.isActive);
  const activePerSide = settings.playerSettings?.activePlayersPerSide || 7;

  useEffect(() => {
    setPlayers(prevPlayers => {
      let updated = false;
      const newPlayers = [...prevPlayers];
      
      // 1. Ensure exactly `activePerSide` players are active, prioritizing earlier players
      const currentActiveCount = newPlayers.filter(p => p.isActive).length;
      if (currentActiveCount === 0 && newPlayers.length > 0) {
          newPlayers.forEach((p, index) => {
              p.isActive = index < activePerSide;
          });
          updated = true;
      }

      // 2. Assign positions based on 3-2-1 formation for active players
      const active = newPlayers.filter(p => p.isActive);
      const needsArrangement = active.some(p => !p.pitchPosition || (p.pitchPosition.x === 50 && p.pitchPosition.y === 50));
      
      if (needsArrangement || (currentActiveCount === 0 && newPlayers.length > 0)) {
          const defaultSlots = [
            { role: 'GK', x: 10, y: 50, filled: false },
            { role: 'DF', x: 28, y: 20, filled: false },
            { role: 'DF', x: 28, y: 50, filled: false },
            { role: 'DF', x: 28, y: 80, filled: false },
            { role: 'MF', x: 50, y: 30, filled: false },
            { role: 'MF', x: 50, y: 70, filled: false },
            { role: 'FW', x: 70, y: 50, filled: false },
            // Fallbacks
            { role: 'FW', x: 70, y: 30, filled: false },
            { role: 'FW', x: 70, y: 70, filled: false },
            { role: 'MF', x: 50, y: 50, filled: false },
            { role: 'DF', x: 28, y: 35, filled: false },
            { role: 'DF', x: 28, y: 65, filled: false },
          ];

          let slots = [...defaultSlots];
          try {
            const savedLayout = localStorage.getItem('defaultPitchLayout');
            if (savedLayout) {
              const parsed = JSON.parse(savedLayout);
              if (parsed.positions && Array.isArray(parsed.positions)) {
                slots = [
                  ...parsed.positions.map((p: any) => ({ ...p, filled: false })),
                  ...defaultSlots
                ];
              }
            }
          } catch (e) {
            console.error('Failed to load default layout', e);
          }
          
          active.forEach(player => {
              let slot = slots.find(s => !s.filled && player.position.includes(s.role));
              if (!slot) {
                  slot = slots.find(s => !s.filled);
              }
              if (slot) {
                  player.pitchPosition = { x: slot.x, y: slot.y };
                  slot.filled = true;
              }
          });
          updated = true;
      }
      
      return updated ? newPlayers : prevPlayers;
    });
  }, [activePerSide]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeStartPos.current) {
        const dx = e.clientX - resizeStartPos.current.x;
        const dy = e.clientY - resizeStartPos.current.y;
        setPitchSize({
          width: Math.max(300, resizeStartPos.current.w + dx),
          height: Math.max(200, resizeStartPos.current.h + dy)
        });
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (viewMode === 'pitch' && scrollContainerRef.current) {
      const posToRestore = currentScrollPosRef.current || pitchScrollPosition;
      
      if (posToRestore) {
        // Try setting it immediately
        scrollContainerRef.current.scrollLeft = posToRestore.x;
        scrollContainerRef.current.scrollTop = posToRestore.y;
        
        // And also after a short delay to ensure layout is complete
        const timer1 = setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = posToRestore.x;
            scrollContainerRef.current.scrollTop = posToRestore.y;
          }
        }, 50);
        
        // And a longer delay just in case of slow rendering
        const timer2 = setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = posToRestore.x;
            scrollContainerRef.current.scrollTop = posToRestore.y;
          }
        }, 250);
        
        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    }
  }, [viewMode, pitchScrollPosition]); // Run when viewMode changes to 'pitch' or pitchScrollPosition is loaded

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const storageRef = ref(storage, `player-photos/${generateId()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setPhotoUrl(url);
    } catch (err) {
      console.error('Upload failed', err);
      setError('Failed to upload photo.');
    }
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setError(null);
    
    const maxPlayers = settings.playerSettings?.maxPlayersPerTeam || 15;
    if (players.length >= maxPlayers) {
      setError(`Maximum number of players (${maxPlayers}) reached.`);
      return;
    }

    const newPlayer: Player = { 
      id: generateId(), 
      name, 
      number, 
      position,
      photoUrl: photoUrl,
      isCaptain: false,
      isViceCaptain: false,
      isActive: activePlayers.length < activePerSide,
      pitchPosition: activePlayers.length < activePerSide ? { 
        x: position === 'GK' ? 10 : position === 'DF' ? 28 : position === 'MF' ? 58 : 85, 
        y: position === 'GK' ? 50 : position === 'DF' ? 20 + (activePlayers.length % 3) * 30 : position === 'MF' ? 30 + (activePlayers.length % 2) * 40 : 50 
      } : undefined
    };

    setPlayers([...players, newPlayer]);
    setName('');
    setNumber('');
    setPosition('MF');
    setPhotoUrl('');
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const toggleActive = (id: string) => {
    const player = players.find(p => p.id === id);
    if (!player) return;

    if (!player.isActive && activePlayers.length >= activePerSide) {
      setError(`Already have ${activePerSide} active players. Substitute a player to change the lineup.`);
      return;
    }

    setPlayers(players.map(p => {
      if (p.id === id) {
        const newActive = !p.isActive;
        return { 
          ...p, 
          isActive: newActive,
          pitchPosition: newActive ? { 
            x: p.position === 'GK' ? 10 : p.position === 'DF' ? 28 : p.position === 'MF' ? 58 : 85, 
            y: p.position === 'GK' ? 50 : p.position === 'DF' ? 20 + (activePlayers.length % 3) * 30 : p.position === 'MF' ? 30 + (activePlayers.length % 2) * 40 : 50 
          } : undefined
        };
      }
      return p;
    }));
  };

  const toggleCaptain = (id: string, type: 'captain' | 'vice') => {
    setPlayers(players.map(p => {
      if (p.id === id) {
        if (type === 'captain') return { ...p, isCaptain: !p.isCaptain, isViceCaptain: false };
        return { ...p, isViceCaptain: !p.isViceCaptain, isCaptain: false };
      }
      if (type === 'captain' && p.isCaptain) return { ...p, isCaptain: false };
      if (type === 'vice' && p.isViceCaptain) return { ...p, isViceCaptain: false };
      return p;
    }));
  };

  const handleSubstitute = (outId: string, inId: string) => {
    setPlayers(players.map(p => {
      if (p.id === outId) return { ...p, isActive: false, pitchPosition: undefined };
      if (p.id === inId) {
        const outPlayer = players.find(pl => pl.id === outId);
        return { 
          ...p, 
          isActive: true, 
          pitchPosition: outPlayer?.pitchPosition || { 
            x: p.position === 'GK' ? 10 : p.position === 'DF' ? 28 : p.position === 'MF' ? 58 : 85, 
            y: p.position === 'GK' ? 50 : p.position === 'DF' ? 20 + (activePlayers.length % 3) * 30 : p.position === 'MF' ? 30 + (activePlayers.length % 2) * 40 : 50 
          } 
        };
      }
      return p;
    }));
    setSubbingPlayerId(null);
  };

  const handlePitchMouseMove = (e: React.MouseEvent) => {
    if (!draggingPlayerId || !pitchRef.current) return;

    if (dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDraggingRef.current = true;
      }
    }

    const rect = pitchRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const constrainedX = Math.max(5, Math.min(95, x));
    const constrainedY = Math.max(5, Math.min(95, y));

    setPlayers(players.map(p => 
      p.id === draggingPlayerId ? { ...p, pitchPosition: { x: constrainedX, y: constrainedY } } : p
    ));
  };

  const handleSave = () => {
    const currentScroll = scrollContainerRef.current ? {
      x: scrollContainerRef.current.scrollLeft,
      y: scrollContainerRef.current.scrollTop
    } : currentScrollPosRef.current;
    
    onSave(team.id, { players, pitchSize, pitchScrollPosition: currentScroll });
    onClose();
  };

  const handleSaveAsDefault = () => {
    const currentScroll = scrollContainerRef.current ? {
      x: scrollContainerRef.current.scrollLeft,
      y: scrollContainerRef.current.scrollTop
    } : currentScrollPosRef.current;

    const defaultLayout = {
      pitchSize,
      pitchScrollPosition: currentScroll,
      positions: activePlayers.map(p => ({
        role: p.position,
        x: p.pitchPosition?.x || 50,
        y: p.pitchPosition?.y || 50
      }))
    };
    localStorage.setItem('defaultPitchLayout', JSON.stringify(defaultLayout));
    alert('Saved as default layout for all teams!');
  };

  const filteredPlayers = players.filter(p => {
    const name = p.name || '';
    const num = p.number || '';
    const pos = p.position || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           num.includes(searchTerm) ||
           pos.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4 font-sans overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/30 blur-[120px] rounded-full" />
      </div>

      <div 
        className="bg-[#050505] rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] w-[98vw] h-[98vh] max-w-none max-h-none overflow-hidden flex flex-col border border-white/10 relative"
      >
        {/* Header Section */}
        <div className="flex justify-between items-center p-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center transform -rotate-6 group-hover:rotate-0 transition-transform">
                <Users className="w-6 h-6 text-indigo-500" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none font-display">
                {team.name} <span className="text-indigo-500">SQUAD</span>
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                  <Star className="w-2.5 h-2.5 fill-indigo-500 text-indigo-500" />
                  LINEUP: {activePlayers.length} / {activePerSide}
                </div>
                <div className="h-1 w-1 rounded-full bg-white/20" />
                <div className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                  SQUAD SIZE: {players.length} / {settings.playerSettings?.maxPlayersPerTeam || 15}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to reset this team to the default layout?')) {
                  try {
                    const savedLayout = localStorage.getItem('defaultPitchLayout');
                    if (savedLayout) {
                      const parsed = JSON.parse(savedLayout);
                      if (parsed.pitchSize) {
                        setPitchSize(parsed.pitchSize);
                      }
                      if (parsed.pitchScrollPosition) {
                        currentScrollPosRef.current = parsed.pitchScrollPosition;
                        if (scrollContainerRef.current) {
                          scrollContainerRef.current.scrollLeft = parsed.pitchScrollPosition.x;
                          scrollContainerRef.current.scrollTop = parsed.pitchScrollPosition.y;
                          
                          setTimeout(() => {
                            if (scrollContainerRef.current) {
                              scrollContainerRef.current.scrollLeft = parsed.pitchScrollPosition.x;
                              scrollContainerRef.current.scrollTop = parsed.pitchScrollPosition.y;
                            }
                          }, 50);
                        }
                      }
                      if (parsed.positions && Array.isArray(parsed.positions)) {
                        const newPlayers = [...players];
                        const active = newPlayers.filter(p => p.isActive);
                        let slots = [
                          ...parsed.positions.map((p: any) => ({ ...p, filled: false })),
                          { role: 'GK', x: 10, y: 50, filled: false },
                          { role: 'DF', x: 28, y: 20, filled: false },
                          { role: 'DF', x: 28, y: 50, filled: false },
                          { role: 'DF', x: 28, y: 80, filled: false },
                          { role: 'MF', x: 50, y: 30, filled: false },
                          { role: 'MF', x: 50, y: 70, filled: false },
                          { role: 'FW', x: 70, y: 50, filled: false },
                        ];
                        active.forEach(player => {
                            let slot = slots.find(s => !s.filled && player.position.includes(s.role));
                            if (!slot) {
                                slot = slots.find(s => !s.filled);
                            }
                            if (slot) {
                                player.pitchPosition = { x: slot.x, y: slot.y };
                                slot.filled = true;
                            }
                        });
                        setPlayers(newPlayers);
                      }
                    } else {
                      alert('No default layout saved yet.');
                    }
                  } catch (e) {
                    console.error('Failed to load default layout', e);
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 text-gray-400 rounded-xl hover:bg-gray-700/50 transition-colors font-medium text-sm border border-gray-700/50"
              title="Reset this team to the saved default layout"
            >
              <RotateCcw className="w-4 h-4" /> Reset to Default
            </button>
            <button
              onClick={handleSaveAsDefault}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-400 rounded-xl hover:bg-indigo-600/30 transition-colors font-medium text-sm border border-indigo-500/30"
              title="Save current pitch size and player positions as default for all teams"
            >
              <Save className="w-4 h-4" /> Save Default Layout
            </button>
            {viewMode === 'pitch' && (
              <button
                onClick={() => exportAsImage(pitchRef.current, `${team.name.toLowerCase().replace(/\s+/g, '-')}-pitch`)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-xl hover:bg-emerald-600/30 transition-colors font-medium text-sm border border-emerald-500/30"
                title="Export pitch as image"
              >
                <ImageIcon className="w-4 h-4" /> Export Image
              </button>
            )}
            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-black uppercase text-[10px] tracking-widest",
                  viewMode === 'list' ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]" : "text-gray-500 hover:text-gray-300"
                )}
              >
                <List className="w-3.5 h-3.5" /> SQUAD LIST
              </button>
              <button 
                onClick={() => setViewMode('pitch')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-black uppercase text-[10px] tracking-widest",
                  viewMode === 'pitch' ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]" : "text-gray-500 hover:text-gray-300"
                )}
              >
                <Layout className="w-3.5 h-3.5" /> VOLTA PITCH
              </button>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-all p-2 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className={cn(
          "p-4 flex-1 custom-scrollbar flex flex-col",
          viewMode === 'list' ? "overflow-y-auto" : "overflow-hidden"
        )}>
          <div className="flex-1 flex flex-col min-h-0">
            {error && (
              <div 
                className="mb-8 p-5 bg-red-500/10 border border-red-500/20 rounded-3xl text-red-400 text-sm font-black uppercase tracking-widest flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <ShieldAlert className="w-6 h-6" />
                  {error}
                </div>
                <button onClick={() => setError(null)} className="hover:text-red-300 p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {viewMode === 'list' ? (
              <div 
                key="list"
                className="space-y-10"
              >
                {/* Add Player Form */}
                <form onSubmit={handleAddPlayer} className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-wrap gap-6 items-end">
                  <div className="flex-1 min-w-[250px]">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-3">PLAYER IDENTITY</label>
                    <div className="relative">
                      <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-black placeholder:text-white/10 uppercase italic" placeholder="ENTER FULL NAME" />
                    </div>
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-3">SQUAD #</label>
                    <input type="text" value={number} onChange={e => setNumber(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-black text-center" placeholder="00" />
                  </div>
                  <div className="w-36">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-3">POSITION</label>
                    <select 
                      value={position} 
                      onChange={e => setPosition(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-black appearance-none cursor-pointer uppercase italic"
                    >
                      <option value="GK">GK</option>
                      <option value="DF">DF</option>
                      <option value="MF">MF</option>
                      <option value="FW">FW</option>
                    </select>
                  </div>
                  <div className="w-52">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-3">AVATAR</label>
                    <div className="relative flex items-center gap-2">
                      <input type="text" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-black placeholder:text-white/10" placeholder="IMAGE URL" />
                      <Camera className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                      <label className="cursor-pointer bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                        <Upload className="w-5 h-5 text-indigo-400" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>
                  </div>
                  <button type="submit" className="bg-indigo-600 text-white px-10 py-4 rounded-2xl hover:bg-indigo-700 transition-all duration-300 flex items-center gap-3 text-xs font-black uppercase tracking-widest h-[56px] shadow-[0_15px_30px_rgba(79,70,229,0.3)] hover:translate-y-[-2px] active:translate-y-0">
                    <Plus className="w-5 h-5" /> RECRUIT PLAYER
                  </button>
                </form>

                {/* Squad Table */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter italic font-display">
                      SQUAD <span className="text-indigo-500">MANAGEMENT</span>
                    </h3>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-4 py-2 bg-[#1A1D24]/80 backdrop-blur-md border border-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-800 transition-all duration-200 text-sm shadow-sm ${isEditing ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50" : ""}`}
                      >
                        <Pencil className="w-4 h-4" /> {isEditing ? 'Done Editing' : 'Edit Table'}
                      </button>
                      <div className="relative w-64">
                        <input 
                          type="text" 
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          placeholder="SEARCH SQUAD..." 
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-[10px] font-black text-white uppercase tracking-widest outline-none focus:border-indigo-500/50 transition-all"
                        />
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="px-8 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">#</th>
                          <th className="px-8 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">PLAYER</th>
                          <th className="px-8 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">POSITION</th>
                          <th className="px-8 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">STATUS</th>
                          <th className="px-8 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">ROLES</th>
                          <th className="px-8 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] text-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredPlayers.map(player => (
                          <tr 
                            key={player.id} 
                            className="group hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-8 py-4">
                              <span className="text-lg font-black text-white/40 group-hover:text-indigo-500 transition-colors italic font-display" contentEditable={isEditing} suppressContentEditableWarning={true}>
                                {player.number || '00'}
                              </span>
                            </td>
                            <td className="px-8 py-4">
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  <img src={player.photoUrl} alt="" className="w-12 h-12 rounded-2xl object-cover border-2 border-white/10 group-hover:border-indigo-500 transition-colors" referrerPolicy="no-referrer" />
                                  {!player.isActive && <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center"><span className="text-[8px] font-black text-white/40 uppercase">BENCH</span></div>}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.name}</p>
                                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">ID: {player.id.slice(0, 8)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-4">
                              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black text-white uppercase tracking-widest italic" contentEditable={isEditing} suppressContentEditableWarning={true}>
                                {player.position}
                              </span>
                            </td>
                            <td className="px-8 py-4">
                              <button 
                                onClick={() => toggleActive(player.id)}
                                className={cn(
                                  "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                                  player.isActive 
                                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" 
                                    : "bg-gray-500/10 border-gray-500/30 text-gray-500 hover:text-indigo-400 hover:border-indigo-500/30"
                                )}
                              >
                                {player.isActive ? 'STARTING XI' : 'SUBSTITUTE'}
                              </button>
                            </td>
                            <td className="px-8 py-4">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => toggleCaptain(player.id, 'captain')}
                                  className={cn(
                                    "p-2 rounded-xl transition-all border group/btn",
                                    player.isCaptain 
                                      ? "bg-yellow-400 text-black border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]" 
                                      : "bg-white/5 border-white/10 text-white/20 hover:text-white/60"
                                  )}
                                  title="Set Captain"
                                >
                                  <Shield className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => toggleCaptain(player.id, 'vice')}
                                  className={cn(
                                    "p-2 rounded-xl transition-all border",
                                    player.isViceCaptain 
                                      ? "bg-indigo-400 text-black border-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.4)]" 
                                      : "bg-white/5 border-white/10 text-white/20 hover:text-white/60"
                                  )}
                                  title="Set Vice Captain"
                                >
                                  <Star className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <button 
                                onClick={() => handleRemovePlayer(player.id)}
                                className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredPlayers.length === 0 && (
                      <div className="p-20 text-center">
                        <Users className="w-16 h-16 text-white/5 mx-auto mb-4" />
                        <p className="text-gray-600 font-black uppercase tracking-[0.5em] text-xs">No players found in squad</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div 
                key="pitch"
                className="flex flex-col lg:flex-row items-stretch justify-center gap-6 w-full flex-1 min-h-0 max-w-none mx-auto"
              >
                {/* Left Panel: Team Info & Lists */}
                <div className="w-full lg:w-80 flex flex-col gap-6 bg-[#080A0E] border border-white/5 rounded-[2rem] p-6 shadow-2xl lg:h-full min-h-0 shrink-0">
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6">
                    {/* Starters List */}
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2 px-2">STARTING {activePerSide}</h3>
                      {activePlayers.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-3 text-white/90 text-xs font-black uppercase tracking-wider bg-white/5 p-2.5 rounded-xl border border-white/5">
                          <span className="text-indigo-400 w-5 text-right">{idx + 1}.</span>
                          <span className="truncate">{p.name}</span>
                        </div>
                      ))}
                    </div>

                    {/* Subs List */}
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2 px-2">SUBSTITUTES</h3>
                      {benchPlayers.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-3 text-white/50 text-xs font-black uppercase tracking-wider p-2.5">
                          <span className="text-white/30 w-5 text-right">{activePlayers.length + idx + 1}.</span>
                          <span className="truncate">{p.name}</span>
                        </div>
                      ))}
                      {benchPlayers.length === 0 && (
                        <div className="text-center p-4 border border-dashed border-white/10 rounded-xl">
                          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">NO SUBS</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div 
                  ref={scrollContainerRef}
                  className="flex-1 w-full h-full min-h-0 min-w-0 p-4 lg:p-8 overflow-auto custom-scrollbar flex"
                  onScroll={(e) => {
                    currentScrollPosRef.current = {
                      x: e.currentTarget.scrollLeft,
                      y: e.currentTarget.scrollTop
                    };
                  }}
                >
                  <div 
                    ref={pitchRef}
                    className="m-auto relative bg-[#080A0E] rounded-[3rem] overflow-hidden border-[8px] border-white/5 shadow-[0_0_150px_rgba(0,0,0,0.9)] select-none shrink-0"
                    style={{
                      width: pitchSize?.width ? `${pitchSize.width}px` : '100%',
                      height: pitchSize?.height ? `${pitchSize.height}px` : '100%',
                      maxWidth: pitchSize ? 'none' : '100%',
                      maxHeight: pitchSize ? 'none' : '800px'
                    }}
                    onMouseMove={handlePitchMouseMove}
                    onMouseUp={() => setDraggingPlayerId(null)}
                    onMouseLeave={() => setDraggingPlayerId(null)}
                  >
                    {/* Resize Handle */}
                    <div 
                      className="absolute bottom-0 right-0 w-12 h-12 cursor-se-resize z-50 flex items-end justify-end p-3 group hide-on-export"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (pitchRef.current) {
                          const rect = pitchRef.current.getBoundingClientRect();
                          resizeStartPos.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
                          setIsResizing(true);
                        }
                      }}
                    >
                      <div className="w-4 h-4 border-b-4 border-r-4 border-white/30 group-hover:border-white/70 rounded-br-lg transition-colors" />
                    </div>

                    {/* Volta Pitch Markings */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30" />
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/10 via-transparent to-violet-900/10" />
                    
                    <div className="absolute inset-10 border-4 border-indigo-500/10 rounded-[3rem] pointer-events-none">
                      {/* Center Circle */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-indigo-500/10 rounded-full" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500/20 rounded-full" />
                      
                      {/* Halfway Line */}
                      <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-indigo-500/10 -translate-x-1/2" />
                      
                      {/* Penalty Areas */}
                      <div className="absolute top-1/2 -translate-y-1/2 left-0 w-48 h-80 border-r-4 border-y-4 border-indigo-500/10 rounded-r-[3rem]" />
                      <div className="absolute top-1/2 -translate-y-1/2 right-0 w-48 h-80 border-l-4 border-y-4 border-indigo-500/10 rounded-l-[3rem]" />
                      
                      {/* Goals */}
                      <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-4 h-40 bg-indigo-500/20 rounded-r-xl border-r-4 border-indigo-500/40" />
                      <div className="absolute top-1/2 -translate-y-1/2 -right-4 w-4 h-40 bg-indigo-500/20 rounded-l-xl border-l-4 border-indigo-500/40" />
                      
                      {/* Neon Corner Accents */}
                      <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-indigo-500 rounded-tl-[3rem] shadow-[0_0_30px_rgba(99,102,241,0.6)]" />
                      <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-indigo-500 rounded-tr-[3rem] shadow-[0_0_30px_rgba(99,102,241,0.6)]" />
                      <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-indigo-500 rounded-bl-[3rem] shadow-[0_0_30px_rgba(99,102,241,0.6)]" />
                      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-indigo-500 rounded-br-[3rem] shadow-[0_0_30px_rgba(99,102,241,0.6)]" />
                    </div>

                    {/* Active Players */}
                    {activePlayers.map(player => (
                      <div 
                        key={player.id}
                        className={cn(
                          "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 group cursor-grab active:cursor-grabbing z-20",
                          draggingPlayerId === player.id && "z-40 scale-110"
                        )}
                        style={{ 
                          left: `${player.pitchPosition?.x || 50}%`, 
                          top: `${player.pitchPosition?.y || 50}%` 
                        }}
                        onMouseDown={(e) => {
                          setDraggingPlayerId(player.id);
                          dragStartPos.current = { x: e.clientX, y: e.clientY };
                          isDraggingRef.current = false;
                        }}
                      >
                      <div className="relative flex flex-col items-center">
                        {/* Glow Effect */}
                        <div className="absolute inset-0 bg-indigo-500/40 blur-2xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        <div 
                          className="w-16 h-20 rounded-2xl border-2 border-indigo-400/50 overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.4)] bg-indigo-600 relative z-10 transform group-hover:rotate-3 transition-transform cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isDraggingRef.current) {
                              setSubbingPlayerId(player.id);
                            }
                          }}
                        >
                          <PlayerPhoto player={player} className="w-full h-full opacity-90 mix-blend-luminosity" />
                          <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/80 to-transparent" />
                          <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <RefreshCw className="w-8 h-8 text-white animate-spin-slow" />
                          </div>
                        </div>

                        {/* Badges */}
                        {player.isCaptain && (
                          <div className="absolute -top-3 -right-3 bg-yellow-400 text-black text-[10px] font-black px-2 py-1 rounded-lg border-2 border-black shadow-xl z-20 transform rotate-12">
                            CPT
                          </div>
                        )}
                        {player.isViceCaptain && (
                          <div className="absolute -top-3 -right-3 bg-indigo-400 text-black text-[10px] font-black px-2 py-1 rounded-lg border-2 border-black shadow-xl z-20 transform rotate-12">
                            VC
                          </div>
                        )}
                        
                        <div className="absolute bottom-6 -right-3 bg-white text-black text-[11px] font-black w-7 h-7 flex items-center justify-center rounded-full border-2 border-[#080A0E] shadow-xl z-20 italic font-display">
                          {player.number}
                        </div>

                        <div className="absolute bottom-6 -left-3 bg-[#080A0E] text-white text-[9px] font-black px-2 py-1 rounded-lg border border-white/10 shadow-xl z-20 uppercase tracking-widest">
                          {player.position}
                        </div>

                        <div className="mt-2 bg-[#080A0E] px-3 py-1 rounded-lg border border-white/10 shadow-2xl relative z-10 group-hover:border-indigo-500/50 transition-colors">
                          <span className="text-[10px] font-black text-white tracking-widest uppercase italic font-display">
                            {player.name.split(' ').pop()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Substitution Overlay */}
                  {subbingPlayerId && (
                    <div 
                      className="absolute inset-0 bg-black/90 backdrop-blur-2xl z-50 flex flex-col items-center justify-center p-12"
                    >
                      <button onClick={() => setSubbingPlayerId(null)} className="absolute top-10 right-10 text-white/40 hover:text-white p-3 hover:bg-white/5 rounded-2xl transition-all">
                        <X className="w-10 h-10" />
                      </button>
                      
                      <div className="text-center mb-12">
                        <h4 className="text-4xl font-black text-white uppercase tracking-tighter italic font-display">
                          SUBSTITUTE <span className="text-indigo-500">{players.find(p => p.id === subbingPlayerId)?.name}</span>
                        </h4>
                        <p className="text-gray-500 font-black uppercase tracking-[0.4em] text-[10px] mt-2">SELECT A PLAYER FROM THE BENCH TO SWAP</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl overflow-y-auto max-h-[55vh] p-4 custom-scrollbar">
                        {benchPlayers.map(p => (
                          <button 
                            key={p.id}
                            onClick={() => handleSubstitute(subbingPlayerId, p.id)}
                            className="group bg-white/[0.03] hover:bg-indigo-600 border border-white/10 hover:border-indigo-400 rounded-3xl p-4 flex flex-col items-center gap-3 transition-all shadow-xl"
                          >
                            <div className="relative">
                              <PlayerPhoto player={p} className="w-16 h-16 rounded-2xl border-2 border-white/10 group-hover:border-white/40" />
                              <div className="absolute -bottom-2 -right-2 bg-indigo-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg border-2 border-black italic font-display">
                                {p.number}
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-black text-white uppercase tracking-tight line-clamp-1 italic font-display">{p.name}</p>
                              <span className="text-[9px] font-black text-indigo-400 group-hover:text-white/60 uppercase tracking-[0.2em]">{p.position}</span>
                            </div>
                          </button>
                        ))}
                        {benchPlayers.length === 0 && (
                          <div className="col-span-full py-20 text-center">
                            <ShieldAlert className="w-16 h-16 text-white/5 mx-auto mb-4" />
                            <p className="text-gray-600 font-black uppercase tracking-[0.5em] text-xs">No substitutes available on bench</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-gradient-to-t from-white/5 to-transparent flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-gray-500">
            <Info className="w-4 h-4 text-indigo-500" />
            <p className="text-[9px] font-black uppercase tracking-widest">Changes are only permanent after saving squad</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose} 
              className="px-6 py-2.5 text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest hover:text-white"
            >
              DISCARD
            </button>
            <button 
              onClick={handleSave} 
              className="group flex items-center gap-3 px-8 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-black uppercase text-[10px] tracking-widest shadow-[0_15px_40px_rgba(79,70,229,0.4)] hover:translate-y-[-2px] active:translate-y-0"
            >
              <Save className="w-4 h-4 group-hover:scale-110 transition-transform" /> CONFIRM SQUAD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

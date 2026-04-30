/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, MicOff, Send, MessageSquare, Sparkles, Languages, Volume2, 
  ShieldAlert, Menu, X, Plus, History, Trash2, ChevronLeft, MoreVertical,
  ThumbsUp, ThumbsDown, User, Zap, Globe, Code, Upload, Terminal, Bell,
  Settings, Activity, ChevronRight
} from "lucide-react";
import VoiceWave from "./components/VoiceWave";
import VoiceOrb from "./components/VoiceOrb";
import { getMonaResponse, getMonaStreamingResponse, type AgentType } from "./services/mona";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Session Interface
interface Message {
  role: 'user' | 'model';
  text: string;
  feedback?: 'positive' | 'negative' | null;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastModified: number;
  language: 'en-US' | 'ur-PK';
}

interface UserSettings {
  theme: 'dark' | 'neon' | 'minimal';
  language: 'en-US' | 'ur-PK';
  autoMode: boolean;
}

// Speech Recognition types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const DEFAULT_GREETING = "Hi, I’m Mona. How may I assist you today?";

export default function App() {
  // Session State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentType>('general');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState<'orb' | 'chat'>('orb');

  // Active Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [language, setLanguage] = useState<'en-US' | 'ur-PK'>('en-US');
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{ id: string, text: string }[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'dark',
    language: 'en-US',
    autoMode: true
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-switch to chat mode when typing or receiving long messages
  useEffect(() => {
    if (!settings.autoMode) return;
    if (input.length > 5 || messages.length > 2) {
      setFocusMode('chat');
    }
  }, [input, messages.length, settings.autoMode]);

  // Load Sessions from Storage
  useEffect(() => {
    const saved = localStorage.getItem('mona_sessions');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) {
        setActiveSessionId(parsed[0].id);
        setMessages(parsed[0].messages);
        setLanguage(parsed[0].language);
      } else {
        createNewSession();
      }
    } else {
      createNewSession();
    }

    const savedSettings = localStorage.getItem('mona_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setLanguage(parsed.language);
    }
  }, []);

  // Sync Storage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('mona_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('mona_settings', JSON.stringify(settings));
  }, [settings]);

  // Update current session when messages or language change
  useEffect(() => {
    if (activeSessionId) {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages, language, lastModified: Date.now() } 
          : s
      ));
    }
  }, [messages, language, activeSessionId]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "History",
      messages: [{ role: 'model', text: DEFAULT_GREETING }],
      lastModified: Date.now(),
      language: 'en-US'
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages(newSession.messages);
    setLanguage('en-US');
    addNotification("New chat.");
  };

  const switchSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setActiveSessionId(id);
      setMessages(session.messages);
      setLanguage(session.language);
    }
  };

  const handleReadAloud = (text: string, msgId: string) => {
    if (isSpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setIsSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.onend = () => setIsSpeakingId(null);
    utterance.onerror = () => setIsSpeakingId(null);
    
    setIsSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (activeSessionId === id) {
      if (newSessions.length > 0) {
        switchSession(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const clearAllHistory = () => {
    if (window.confirm("Confirm purge of all encrypted history?")) {
      localStorage.removeItem('mona_sessions');
      setSessions([]);
      createNewSession();
    }
  };

  const addNotification = (text: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addNotification(`File uploaded: ${file.name}`);
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join("");
        
        setInput(transcript);

        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const finalTranscript = lastResult[0].transcript.trim();
          
          if (finalTranscript.toLowerCase().includes("new chat") || finalTranscript.toLowerCase().includes("clear session")) {
            createNewSession();
            return;
          }
          if (finalTranscript.toLowerCase().includes("switch to urdu")) {
            setLanguage('ur-PK');
            return;
          }
          if (finalTranscript.toLowerCase().includes("switch to english")) {
            setLanguage('en-US');
            return;
          }
        }
      };
      recognition.onerror = (event: any) => {
        console.error(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        // Only flip the state if it was actually intended to stop
        // Browsers might occasionally drop the connection, so we check the intent
        if (isListening) {
          try {
            recognition.start();
          } catch (e) {
            // Might already be started
          }
        }
      };

      recognitionRef.current = recognition;
    }
  }, [language, isThinking]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isThinking) return;

    if (messages.length <= 1 && activeSessionId) {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, title: textToSend.slice(0, 24) + (textToSend.length > 24 ? "..." : "") } 
          : s
      ));
    }

    if (isListening) recognitionRef.current?.stop();

    const userMessage: Message = { role: 'user', text: textToSend };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setIsThinking(true);

    const historyForModel = currentMessages.map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.text }]
    }));

    const responseText = "";
    const modelMessage: Message = { role: 'model', text: "" };
    setMessages(prev => [...prev, modelMessage]);
    
    let fullResponse = "";
    try {
      const stream = getMonaStreamingResponse(textToSend, historyForModel, activeAgent);
      setIsThinking(false); // Stop thinking state and start showing content

      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === 'model') {
            lastMsg.text = fullResponse;
          }
          return newMessages;
        });
      }
    } catch (err) {
      console.error("Streaming error:", err);
      setMessages(prev => [...prev, { role: 'model', text: "Transmission interrupted. Neural link unstable." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const triggerFeedback = (idx: number, type: 'positive' | 'negative') => {
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, feedback: type } : m));
    addNotification("Feedback processed.");
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const getSystemStatus = () => {
    if (isThinking) return { text: "Thinking", color: "text-amber-400" };
    if (isListening) return { text: "Listening", color: "text-red-500" };
    return { text: "Standby", color: "text-neon-green/40" };
  };

  const status = getSystemStatus();

  const SettingsModal = () => (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 md:p-10">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSettingsOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl glass-panel p-0 overflow-hidden border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
               <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-neon-green/10">
                     <Settings className="w-5 h-5 text-neon-green" />
                  </div>
                  <div>
                     <h2 className="text-xl font-display font-bold text-white tracking-tight">System Configuration</h2>
                     <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/20 mt-1">Core Operational Parameters</p>
                  </div>
               </div>
               <button 
                 onClick={() => setIsSettingsOpen(false)}
                 className="p-3 rounded-xl hover:bg-white/5 transition-colors"
               >
                 <X className="w-5 h-5 text-white/20" />
               </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-8 space-y-10 max-h-[60vh] overflow-y-auto scrollbar-hide">
               
                {/* Language Selection */}
               <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-white/60">Primary Linguistics</h3>
                  <div className="grid grid-cols-2 gap-3">
                     {[
                       { id: 'en-US', label: 'English (Neural)', sub: 'Default Global' },
                       { id: 'ur-PK', label: 'Urdu (Regional)', sub: 'Urdu Lexicon' }
                     ].map((lang) => (
                       <button
                         key={lang.id}
                         onClick={() => {
                           setSettings(prev => ({ ...prev, language: lang.id as any }));
                           setLanguage(lang.id as any);
                         }}
                         className={`p-4 rounded-2xl flex flex-col items-start gap-1 transition-all border ${settings.language === lang.id ? 'bg-neon-green/10 border-neon-green/30' : 'bg-white/2 border-white/0 hover:border-white/10'}`}
                       >
                         <span className={`text-sm font-bold ${settings.language === lang.id ? 'text-white' : 'text-white/40'}`}>{lang.label}</span>
                         <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider">{lang.sub}</span>
                       </button>
                     ))}
                  </div>
               </div>

               {/* Theme Options */}
               <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-white/60">Visual Matrix Style</h3>
                  <div className="grid grid-cols-3 gap-3">
                     {[
                       { id: 'dark', label: 'Dark Blue', icon: <div className="w-4 h-4 rounded-full bg-[#0a0c10]" /> },
                       { id: 'neon', label: 'Black', icon: <div className="w-4 h-4 rounded-full bg-neon-green" /> },
                       { id: 'minimal', label: 'Ethereal', icon: <div className="w-4 h-4 rounded-full bg-white/10" /> }
                     ].map((theme) => (
                       <button
                         key={theme.id}
                         onClick={() => setSettings(prev => ({ ...prev, theme: theme.id as any }))}
                         className={`p-4 rounded-2xl flex flex-col items-center gap-3 transition-all border ${settings.theme === theme.id ? 'bg-neon-green/10 border-neon-green/30' : 'bg-white/2 border-white/0 hover:border-white/10'}`}
                       >
                         {theme.icon}
                         <span className={`text-[10px] font-bold uppercase tracking-widest ${settings.theme === theme.id ? 'text-white' : 'text-white/40'}`}>{theme.label}</span>
                       </button>
                     ))}
                   </div>
                </div>
               {/* Auto Mode */}
               <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                  <div>
                     <h3 className="text-sm font-bold text-white tracking-wide">Auto-Focus Sequence</h3>
                     <p className="text-[10px] text-white/20 mt-1 uppercase font-bold tracking-wider">Predictive UI Switching</p>
                  </div>
                  <button 
                    onClick={() => setSettings(prev => ({ ...prev, autoMode: !prev.autoMode }))}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings.autoMode ? 'bg-neon-green' : 'bg-white/10'}`}
                  >
                     <motion.div 
                       animate={{ x: settings.autoMode ? 24 : 4 }}
                       className="absolute top-1 w-4 h-4 rounded-full bg-black shadow-lg"
                     />
                  </button>
               </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-white/[0.03] border-t border-white/5 flex justify-end">
               <button 
                 onClick={() => setIsSettingsOpen(false)}
                 className="px-8 py-3 bg-neon-green text-black font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:scale-105 active:scale-95 transition-all"
               >
                 Apply Settings
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`relative min-h-screen w-full flex p-0 md:p-4 overflow-hidden font-sans transition-colors duration-500 ${
      settings.theme === 'neon' ? 'bg-[#050505]' : 
      settings.theme === 'minimal' ? 'bg-slate-900' : 
      'bg-dark-navy'
    }`}>
      <SettingsModal />
      
      {/* Notifications */}
      <div className="fixed top-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              className="px-6 py-4 glass-panel border-neon-green/20 text-white/90 text-sm flex items-center gap-3 w-72 shadow-2xl"
            >
              <Activity className="w-4 h-4 text-neon-green" />
              {n.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* MOBILE SIDEBAR OVERLAY */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            className="fixed inset-y-0 left-0 lg:static lg:flex flex-col w-80 shrink-0 p-6 z-50 h-full bg-[#0a0c10]/40 backdrop-blur-xl border-r border-white/5 lg:border-none lg:bg-transparent"
          >
            <div className="flex items-center gap-4 mb-10 pl-2">
              <div className="w-12 h-12 rounded-2xl bg-neon-green flex items-center justify-center neon-glow">
                <Sparkles className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg tracking-tight text-white leading-none">Mona</h1>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/20 mt-1.5">Premium Interface</p>
              </div>
            </div>



            {/* Agent Selector */}
            <div className="space-y-4 mb-8 px-2 pt-2">
              <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-4">Active Subroutines</h3>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'general', name: 'Mona Core', desc: 'General intelligence assistant', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-white' },
                  { id: 'research', name: 'Research Polymath', desc: 'Deep search & analysis', icon: <Globe className="w-3.5 h-3.5" />, color: 'text-amber-400' },
                  { id: 'coding', name: 'Engineering Matrix', desc: 'Code & technical architecture', icon: <Code className="w-3.5 h-3.5" />, color: 'text-blue-400' },
                  { id: 'planning', name: 'Strategic Planner', desc: 'Task management & roadmaps', icon: <Terminal className="w-3.5 h-3.5" />, color: 'text-purple-400' }
                ].map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setActiveAgent(agent.id as AgentType);
                      addNotification(`${agent.name} protocol engaged.`);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${activeAgent === agent.id ? 'bg-white/10 border-white/10 shadow-lg' : 'border-transparent hover:bg-white/5'}`}
                  >
                    <div className={`p-2 rounded-lg bg-white/5 ${activeAgent === agent.id ? agent.color : 'text-white/20'}`}>
                      {agent.icon}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className={`text-[11px] font-bold tracking-wide truncate ${activeAgent === agent.id ? 'text-white' : 'text-white/40'}`}>
                        {agent.name}
                      </p>
                      <p className="text-[9px] text-white/20 truncate lowercase tracking-tight mt-0.5">
                        {agent.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide px-2">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 mb-4">Transmission Log</h2>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => switchSession(session.id)}
                  className={`
                    group flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border
                    ${activeSessionId === session.id 
                      ? 'bg-neon-green/10 border-neon-green/30' 
                      : 'bg-white/2 border-white/0 hover:border-white/10 hover:bg-white/[0.04]'}
                  `}
                >
                  <MessageSquare className={`w-4 h-4 ${activeSessionId === session.id ? 'text-neon-green' : 'text-white/20'}`} />
                  <span className={`text-xs truncate font-medium flex-1 ${activeSessionId === session.id ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
                    {session.title}
                  </span>
                  <button onClick={(e) => deleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-white/5 mt-auto space-y-4 px-2">
              <div 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-green/80 to-neon-green/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Settings className="w-5 h-5 text-black" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-white truncate">Settings</p>
                  <p className="text-[10px] text-white/30 truncate">System Configuration</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
              </div>
              <button onClick={clearAllHistory} className="w-full py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 hover:text-red-400 transition-colors">
                Purge History
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* CENTER AREA (Orb & Chat) */}
      <main className="flex-1 flex flex-col h-screen relative z-10 overflow-hidden">
        
        {/* Header Controls */}
        <div className="flex items-center justify-between p-4 md:p-6 lg:px-10">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
            >
              <Menu className="w-5 h-5 text-white/40" />
            </button>
            <div className="flex items-center gap-1 md:gap-3">
               <button 
                 onClick={() => setFocusMode('orb')}
                 className={`px-3 md:px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${focusMode === 'orb' ? 'bg-neon-green text-black' : 'text-white/40 hover:text-white'}`}
               >
                 Voice
               </button>
               <button 
                 onClick={() => setFocusMode('chat')}
                 className={`px-3 md:px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${focusMode === 'chat' ? 'bg-neon-green text-black' : 'text-white/40 hover:text-white'}`}
               >
                 Chat
               </button>
            </div>
            <div className="hidden md:block h-4 w-px bg-white/10 mx-2" />
            <div className="hidden sm:flex items-center gap-2">
               <div className={`p-1.5 rounded-md bg-white/5 ${
                 activeAgent === 'research' ? 'text-amber-400' : 
                 activeAgent === 'coding' ? 'text-blue-400' : 
                 activeAgent === 'planning' ? 'text-purple-400' : 
                 'text-neon-green'
               }`}>
                 {activeAgent === 'research' ? <Globe className="w-3 h-3" /> : 
                  activeAgent === 'coding' ? <Code className="w-3 h-3" /> : 
                  activeAgent === 'planning' ? <Terminal className="w-3 h-3" /> : 
                  <Zap className="w-3 h-3" />}
               </div>
               <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                 {activeAgent === 'general' ? 'Core' : activeAgent}
               </span>
            </div>
          </div>

          <div className={`flex items-center gap-2 md:gap-6 transition-all duration-700 ${focusMode === 'chat' ? 'opacity-100' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
             <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-neon-green uppercase tracking-[0.2em]">{status.text}</p>
                <div className="flex gap-1 mt-1 justify-end">
                   {[1,2,3].map(i => (
                     <motion.div 
                       key={i}
                       animate={isThinking ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.2 }}
                       transition={{ repeat: Infinity, delay: i * 0.2 }}
                       className="w-1 h-1 rounded-full bg-neon-green" 
                     />
                   ))}
                </div>
             </div>
             <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-neon-green/20 relative flex items-center justify-center">
                <div className="scale-[0.12] md:scale-[0.15] absolute inset-0 flex items-center justify-center">
                   <VoiceOrb state={isThinking ? 'thinking' : isListening ? 'listening' : 'idle'} />
                </div>
             </div>
          </div>
        </div>

        <div 
          style={{ height: '200px' }}
          className="flex-1 flex flex-col overflow-hidden relative">
          {/* ORB FOCUS MODE */}
          <AnimatePresence>
            {focusMode === 'orb' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
              >
                <div className="transform -translate-y-12">
                   <VoiceOrb state={isThinking ? 'thinking' : isListening ? 'listening' : 'idle'} />
                   <div className="mt-12 flex flex-col items-center text-center">
                      <h2 className="text-3xl md:text-5xl font-display font-medium tracking-tight text-white/90">
                        {isListening ? "Listening..." : isThinking ? "Neural Processing..." : "Standing by."}
                      </h2>
                      <div className="mt-8">
                         <VoiceWave isActive={isListening} isThinking={isThinking} />
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CHAT HISTORY */}
          <div 
            ref={scrollRef}
            className={`flex-1 overflow-y-auto px-4 md:px-12 lg:px-24 scrollbar-hide py-10 transition-all duration-700 ${focusMode === 'orb' ? 'opacity-10 blur-xl scale-95 pointer-events-none' : 'opacity-100 blur-0 scale-100'}`}
          >
            {messages.length <= 1 && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 md:space-y-12">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-2 md:px-0">
                    {[
                      { title: "Quantum Analysis", desc: "Complex problem solving & logic", icon: <Zap className="w-5 h-5 text-amber-400" /> },
                      { title: "Neural Synthesis", desc: "Creative writing & ideation", icon: <Sparkles className="w-5 h-5 text-neon-green" /> },
                      { title: "Binary Protocol", desc: "Code generation & debugging", icon: <Code className="w-5 h-5 text-blue-400" /> },
                      { title: "Matrix Insight", desc: "Data interpretation & research", icon: <Globe className="w-5 h-5 text-purple-400" /> }
                    ].map((card, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => handleSend(card.title)}
                        className="p-6 glass-panel border-white/0 hover:border-white/10 hover:bg-white/[0.04] transition-all text-left group"
                      >
                         <div className="flex items-center gap-4 mb-3">
                            <div className="p-2.5 rounded-xl bg-white/5 group-hover:scale-110 transition-transform">
                               {card.icon}
                            </div>
                            <h3 className="text-sm font-bold text-white tracking-wide">{card.title}</h3>
                         </div>
                         <p className="text-xs text-white/40 leading-relaxed">{card.desc}</p>
                      </motion.button>
                    ))}
                 </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex mb-8 md:mb-12 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`
                  max-w-[90%] md:max-w-[70%] p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] text-sm leading-relaxed relative group transition-all
                  ${msg.role === 'user' 
                    ? 'bg-neon-green text-black font-semibold rounded-tr-none shadow-[10px_10px_30px_rgba(34,197,94,0.1)]' 
                    : 'glass-panel text-white/90 rounded-tl-none hover:border-white/20'}
                `}>
                  <div className={`prose max-w-none ${msg.role === 'user' ? 'text-black prose-invert' : 'prose-invert'}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>

                  {msg.role === 'model' && (
                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleReadAloud(msg.text, `${activeSessionId}-${i}`)}
                        className={`p-2 rounded-xl transition-all ${isSpeakingId === `${activeSessionId}-${i}` ? 'bg-neon-green text-black animate-pulse' : 'hover:bg-white/5 text-white/40'}`}
                        title="Read Aloud"
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isSpeakingId === `${activeSessionId}-${i}` ? 'animate-bounce' : ''}`} />
                      </button>
                      <button 
                        onClick={() => triggerFeedback(i, 'positive')}
                        className={`p-2 rounded-xl transition-all ${msg.feedback === 'positive' ? 'bg-neon-green text-black' : 'hover:bg-white/5 text-white/40'}`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => triggerFeedback(i, 'negative')}
                        className={`p-2 rounded-xl transition-all ${msg.feedback === 'negative' ? 'bg-red-500 text-white' : 'hover:bg-white/5 text-white/40'}`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {isThinking && (
              <div className="flex justify-start mb-12 translate-x-4">
                 <div className="flex gap-2">
                    {[0.2, 0.4, 0.6].map(d => (
                       <motion.div 
                        key={d}
                        animate={{ opacity: [0.2, 1, 0.2] }} 
                        transition={{ repeat: Infinity, duration: 1, delay: d }}
                        className="w-2 h-2 rounded-full bg-neon-green/40" 
                       />
                    ))}
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* INPUT AREA */}
        <div className="max-w-4xl mx-auto w-full pt-2 pb-6 md:pt-4 md:pb-8 px-4 md:px-6 lg:px-0">
          <div className="glass-panel p-1.5 md:p-2 flex items-center gap-1 md:gap-2 border-neon-green/20 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 md:p-4 rounded-2xl text-white/30 hover:text-neon-green hover:bg-white/5 transition-all"
            >
              <Upload className="w-5 h-5" />
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            </button>
            
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Query neural network..."
              className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-white placeholder:text-white/10 px-2 md:px-4 text-sm md:text-base font-medium min-w-0"
            />

            <button 
              onClick={toggleListening}
              className={`p-3 md:p-4 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-white/5 text-white/30 hover:text-white'}`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isThinking}
              className="p-3 md:p-4 bg-neon-green text-black rounded-2xl hover:scale-[1.03] active:scale-95 transition-all shadow-xl shadow-neon-green/10 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="flex justify-center mt-4 md:mt-6">
             <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.3em] md:tracking-[0.5em] text-white/10 text-center">Mona Digital Intelligence • v.2.4</p>
          </div>
        </div>
      </main>


    </div>
  );
}

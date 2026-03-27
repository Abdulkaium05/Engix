import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  Map as MapIcon, 
  Calculator, 
  ClipboardList, 
  FlaskConical, 
  MessageSquare, 
  Trophy, 
  Languages, 
  Navigation, 
  Upload, 
  Send,
  Loader2,
  ChevronRight,
  Info,
  Menu,
  X,
  Building2,
  Ruler,
  Compass,
  Construction,
  Cpu,
  Activity,
  Wrench,
  Droplets,
  Thermometer,
  Network,
  Database,
  Target,
  HardHat,
  Settings,
  Zap,
  Code,
  LayoutGrid,
  LogOut,
  LogIn,
  User as UserIcon,
  Layers,
  Sun,
  Moon,
  ArrowRightLeft,
  RefreshCw,
  Trash2,
  Plus,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, materialTests, quizQuestions, homeTopics } from './data/content';
import { cn } from './lib/utils';
import { getChatResponse, estimateMaterials, analyzeLand, generateExampleImage, generateQuizQuestions } from './services/gemini';
import ReactMarkdown from 'react-markdown';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';

// Fix Leaflet default icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

type Tab = 'home' | 'survey' | 'land' | 'estimating' | 'materials' | 'quiz' | 'chat' | 'mech_design' | 'thermo' | 'fluids' | 'circuits' | 'power' | 'control' | 'software' | 'data' | 'network' | 'settings' | 'plot_planner' | 'slab_design' | 'unit_converter' | 'beam_design';
type Dept = 'civil' | 'mechanical' | 'electrical' | 'computer';

const DEPT_CONFIG = {
  civil: { color: 'emerald', icon: <HardHat />, logo: 'E', bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200', theme: 'civil-theme' },
  mechanical: { color: 'orange', icon: <Settings />, logo: 'E', bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-200', theme: 'mechanical-theme' },
  electrical: { color: 'blue', icon: <Zap />, logo: 'E', bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200', theme: 'electrical-theme' },
  computer: { color: 'purple', icon: <Code />, logo: 'E', bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', theme: 'computer-theme' },
};

const DEPT_TABS: Record<Dept, Tab[]> = {
  civil: ['home', 'chat', 'quiz', 'survey', 'land', 'plot_planner', 'estimating', 'materials', 'slab_design', 'beam_design', 'unit_converter'],
  mechanical: ['home', 'chat', 'quiz', 'mech_design', 'thermo', 'fluids', 'unit_converter'],
  electrical: ['home', 'chat', 'quiz', 'circuits', 'power', 'control', 'unit_converter'],
  computer: ['home', 'chat', 'quiz', 'software', 'data', 'network', 'unit_converter'],
};

const TAB_ICONS: Record<string, any> = {
  home: <Home size={20} />,
  survey: <Navigation size={20} />,
  land: <MapIcon size={20} />,
  plot_planner: <LayoutGrid size={20} />,
  slab_design: <Layers size={20} />,
  beam_design: <Construction size={20} />,
  unit_converter: <ArrowRightLeft size={20} />,
  estimating: <Calculator size={20} />,
  materials: <FlaskConical size={20} />,
  quiz: <Trophy size={20} />,
  chat: <MessageSquare size={20} />,
  settings: <Settings size={20} />,
  mech_design: <Wrench size={20} />,
  thermo: <Thermometer size={20} />,
  fluids: <Droplets size={20} />,
  circuits: <Activity size={20} />,
  power: <Zap size={20} />,
  control: <Target size={20} />,
  software: <Code size={20} />,
  data: <Database size={20} />,
  network: <Network size={20} />,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [lang, setLang] = useState<'bn' | 'en'>(() => (localStorage.getItem('engix_lang') as 'bn' | 'en') || 'bn');
  const [dept, setDept] = useState<Dept>(() => (localStorage.getItem('engix_dept') as Dept) || 'civil');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('engix_theme') as 'light' | 'dark') || 'dark');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const t = translations[lang];
  const config = DEPT_CONFIG[dept];

  useEffect(() => {
    // Force dark mode for Glass Engineering UI
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    // Reset scroll position when changing tabs
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeTab, dept]);

  const saveUserSettings = (newLang: 'bn' | 'en', newDept: Dept, newTheme: 'light' | 'dark' = theme) => {
    // Always save to localStorage for guest persistence
    localStorage.setItem('engix_lang', newLang);
    localStorage.setItem('engix_dept', newDept);
    localStorage.setItem('engix_theme', newTheme);
  };

  useEffect(() => {
    if (!DEPT_TABS[dept].includes(activeTab as any) && activeTab !== 'settings') {
      setActiveTab('home');
    }
  }, [dept]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className={cn("h-[100dvh] relative flex flex-col overflow-hidden", config.theme)}>
      {/* Floating Blur Blobs */}
      <div className="blur-circle top-[10%] left-[10%]" />
      <div className="blur-circle top-[60%] right-[10%] opacity-10" />
      <div className="blur-circle bottom-[10%] left-[30%] opacity-5" />
      {/* Navbar */}
      {activeTab !== 'chat' && (
        <nav className="navbar px-6 py-4 flex items-center justify-between z-10">
          <motion.div 
            initial={{ opacity: 1 }}
            animate={{ opacity: isMenuOpen ? 0 : 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4"
          >
            <motion.div 
              key={dept}
              initial={{ rotate: -90, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl", config.bg)}
            >
              {config.logo}
            </motion.div>
            <div>
              <h1 className="text-xl font-black text-white leading-none tracking-tight">Engix</h1>
              <p className={cn("text-[8px] font-bold uppercase tracking-widest mt-1", config.text)}>{t[dept]}</p>
            </div>
          </motion.div>
          <button 
            onClick={toggleMenu}
            className="btn-glass p-2.5"
          >
            <Menu size={20} className="text-white" />
          </button>
        </nav>
      )}

      {/* Sidebar Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleMenu}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 z-50 w-80 max-w-[80vw] glass border-r border-white/10 p-6 flex flex-col overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl", config.bg)}>
                    {config.logo}
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Engix</h2>
                </div>
                <button onClick={toggleMenu} className="btn-glass p-2 rounded-full">
                  <X size={20} className="text-white" />
                </button>
              </div>

              <div className="space-y-8 flex-1">
                {/* Navigation Links */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{lang === 'bn' ? 'মেনু' : 'Menu'}</p>
                  <div className="space-y-1">
                    {DEPT_TABS[dept].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setIsMenuOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
                          activeTab === tab ? "bg-white/20 text-white border border-white/10" : "text-white/60 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <div className={cn(activeTab === tab ? config.text : "text-white/40")}>
                          {TAB_ICONS[tab]}
                        </div>
                        {t[tab]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Department Selection */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{lang === 'bn' ? 'বিভাগ' : 'Department'}</p>
                  <div className="grid grid-cols-1 gap-2">
                    <DeptButton active={dept === 'civil'} onClick={() => { setDept('civil'); saveUserSettings(lang, 'civil', theme); setIsMenuOpen(false); }} icon={<HardHat size={16} />} label={t.civil} color="emerald" />
                    <DeptButton active={dept === 'mechanical'} onClick={() => { setDept('mechanical'); saveUserSettings(lang, 'mechanical', theme); setIsMenuOpen(false); }} icon={<Settings size={16} />} label={t.mechanical} color="orange" />
                    <DeptButton active={dept === 'electrical'} onClick={() => { setDept('electrical'); saveUserSettings(lang, 'electrical', theme); setIsMenuOpen(false); }} icon={<Zap size={16} />} label={t.electrical} color="blue" />
                    <DeptButton active={dept === 'computer'} onClick={() => { setDept('computer'); saveUserSettings(lang, 'computer', theme); setIsMenuOpen(false); }} icon={<Code size={16} />} label={t.computer} color="purple" />
                  </div>
                </div>

                {/* Language Selection */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{lang === 'bn' ? 'ভাষা' : 'Language'}</p>
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button 
                      onClick={() => { setLang('bn'); saveUserSettings('bn', dept, theme); }}
                      className={cn("flex-1 py-2 rounded-lg font-bold text-sm transition-all", lang === 'bn' ? "bg-white/20 text-white" : "text-white/40 hover:text-white")}
                    >
                      বাংলা
                    </button>
                    <button 
                      onClick={() => { setLang('en'); saveUserSettings('en', dept, theme); }}
                      className={cn("flex-1 py-2 rounded-lg font-bold text-sm transition-all", lang === 'en' ? "bg-white/20 text-white" : "text-white/40 hover:text-white")}
                    >
                      English
                    </button>
                  </div>
                </div>
              </div>
              
              {/* User / Settings at bottom */}
              <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
                <button
                  onClick={() => { setActiveTab('settings'); setIsMenuOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
                    activeTab === 'settings' ? "bg-white/20 text-white border border-white/10" : "text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Settings size={18} className={activeTab === 'settings' ? config.text : "text-white/40"} />
                  {t.settings}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">


        {/* Main Content */}
        <main ref={mainRef} className={cn("flex-1 flex flex-col w-full relative min-h-0", activeTab === 'chat' ? "overflow-hidden p-0" : "overflow-y-auto pb-8 pt-8 px-6 no-scrollbar")}>
          <div className={cn("mx-auto h-full flex flex-col w-full min-h-0", activeTab === 'chat' ? "max-w-3xl" : "max-w-7xl")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${dept}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col min-h-0 w-full h-full"
              >
                {activeTab === 'home' && <HomeTab t={t} lang={lang} dept={dept} config={config} setActiveTab={setActiveTab} />}
                {activeTab === 'survey' && <SurveyTab t={t} config={config} />}
                {activeTab === 'land' && <LandTab t={t} lang={lang} config={config} />}
                {activeTab === 'plot_planner' && <PlotPlannerTab t={t} config={config} />}
                {activeTab === 'slab_design' && <SlabDesignTab t={t} lang={lang} config={config} />}
                {activeTab === 'beam_design' && <BeamDesignTab t={t} lang={lang} config={config} />}
                {activeTab === 'unit_converter' && <UnitConverterTab t={t} config={config} />}
                {activeTab === 'estimating' && <EstimatingTab t={t} config={config} />}
                {activeTab === 'materials' && <MaterialsTab t={t} lang={lang} config={config} />}
                {activeTab === 'quiz' && <QuizTab t={t} lang={lang} config={config} dept={dept} />}
                {activeTab === 'chat' && <ChatTab t={t} lang={lang} config={config} dept={dept} setActiveTab={setActiveTab} toggleMenu={toggleMenu} />}
                {activeTab === 'settings' && <SettingsTab t={t} lang={lang} setLang={setLang} dept={dept} setDept={setDept} theme={theme} setTheme={setTheme} saveUserSettings={saveUserSettings} config={config} />}
                {['mech_design', 'thermo', 'fluids', 'circuits', 'power', 'control', 'software', 'data', 'network'].includes(activeTab) && (
                  <ComingSoonTab t={t} config={config} tabId={activeTab} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

function MenuLink({ active, onClick, icon, label, color, isGrid }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string, isGrid?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 rounded-2xl transition-all font-medium group",
        isGrid ? "flex-col justify-center p-4 text-center text-xs" : "px-4 py-3 text-sm w-full",
        active 
          ? cn("bg-stone-100 dark:bg-stone-800", color) 
          : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-100"
      )}
    >
      <div className={cn(
        "transition-transform group-hover:scale-110",
        active ? color : "text-stone-400 dark:text-stone-500"
      )}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
    </button>
  );
}

function DeptButton({ active, onClick, icon, label, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string }) {
  const colors: any = {
    emerald: active ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    orange: active ? 'bg-orange-600 text-white' : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30',
    blue: active ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
    purple: active ? 'bg-purple-600 text-white' : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30',
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold transition-all border",
        colors[color]
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// --- Tab Components ---

function ChatTab({ t, lang, config, dept, setActiveTab, toggleMenu }: { t: any, lang: 'bn' | 'en', config: any, dept: string, setActiveTab: (tab: Tab) => void, toggleMenu: () => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    const response = await getChatResponse(userMsg, messages, 'long');
    
    setMessages(prev => [...prev, { role: 'ai', content: response || "Sorry, I couldn't process that." }]);
    setIsLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full bg-black/10 backdrop-blur-sm relative">
      {/* Minimal Header */}
      <div className="shrink-0 flex items-center gap-3 p-4 border-b border-white/10 bg-white/5 backdrop-blur-md z-10">
        <button onClick={() => setActiveTab('home')} className="p-2 glass rounded-full text-white hover:bg-white/20 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-base font-bold text-white leading-tight">{t.chat || "AI Assistant"}</h2>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-tight">{dept}</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-6 no-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <MessageSquare size={48} className="text-white/20" />
            <p className="text-white/60 font-medium max-w-xs">
              {lang === 'bn' ? "আপনার ইঞ্জিনিয়ারিং প্রশ্ন জিজ্ঞাসা করুন..." : "Ask your engineering questions..."}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={idx} 
              className={cn(
                "flex w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[85%] rounded-2xl p-4",
                msg.role === 'user' 
                  ? cn("text-white rounded-tr-sm", config.bg) 
                  : "glass border border-white/10 text-white/90 rounded-tl-sm"
              )}>
                {msg.role === 'ai' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))
        )}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="glass border border-white/10 rounded-2xl rounded-tl-sm p-4 flex items-center gap-3 text-white/60">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 p-4 bg-black/40 backdrop-blur-xl border-t border-white/10 z-10">
        <div className="relative flex items-center max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={lang === 'bn' ? "মেসেজ লিখুন..." : "Type your message..."}
            className="w-full glass border border-white/10 rounded-full py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder:text-white/30 transition-all shadow-lg"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "absolute right-2 p-2.5 rounded-full text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md",
              config.bg
            )}
          >
            <Send size={18} className={cn(input.trim() && !isLoading && "translate-x-0.5 -translate-y-0.5")} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ t, lang, setLang, dept, setDept, theme, setTheme, saveUserSettings, config }: any) {
  return (
    <div className="space-y-6">
      <div className="card-glass transition-colors duration-300">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white/5 text-white">
            <Settings size={28} />
          </div>
          <h2 className="text-2xl font-black text-white">{t.settings}</h2>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{t.language}</p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setLang('bn'); saveUserSettings('bn', dept, theme); }}
                className={cn(
                  "py-4 rounded-2xl font-bold border transition-all", 
                  lang === 'bn' 
                    ? "bg-white/20 text-white border-white/30 scale-105" 
                    : "glass border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                )}
              >
                বাংলা
              </button>
              <button 
                onClick={() => { setLang('en'); saveUserSettings('en', dept, theme); }}
                className={cn(
                  "py-4 rounded-2xl font-bold border transition-all", 
                  lang === 'en' 
                    ? "bg-white/20 text-white border-white/30 scale-105" 
                    : "glass border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                )}
              >
                English
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Theme</p>
            <div className="flex glass p-1.5 rounded-2xl border border-white/10">
              <button 
                onClick={() => { setTheme('light'); saveUserSettings(lang, dept, 'light'); }}
                className={cn(
                  "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2", 
                  theme === 'light' 
                    ? "bg-white/20 text-white border border-white/30" 
                    : "text-white/40 hover:text-white/60 hover:bg-white/5"
                )}
              >
                <Sun size={20} />
                Light
              </button>
              <button 
                onClick={() => { setTheme('dark'); saveUserSettings(lang, dept, 'dark'); }}
                className={cn(
                  "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2", 
                  theme === 'dark' 
                    ? "bg-white/20 text-white border border-white/30" 
                    : "text-white/40 hover:text-white/60 hover:bg-white/5"
                )}
              >
                <Moon size={20} />
                Dark
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">{t.deptSelect}</p>
            <div className="grid grid-cols-2 gap-3">
              <DeptButton active={dept === 'civil'} onClick={() => { setDept('civil'); saveUserSettings(lang, 'civil', theme); }} icon={<HardHat size={16} />} label={t.civil} color="emerald" />
              <DeptButton active={dept === 'mechanical'} onClick={() => { setDept('mechanical'); saveUserSettings(lang, 'mechanical', theme); }} icon={<Settings size={16} />} label={t.mechanical} color="orange" />
              <DeptButton active={dept === 'electrical'} onClick={() => { setDept('electrical'); saveUserSettings(lang, 'electrical', theme); }} icon={<Zap size={16} />} label={t.electrical} color="blue" />
              <DeptButton active={dept === 'computer'} onClick={() => { setDept('computer'); saveUserSettings(lang, 'computer', theme); }} icon={<Code size={16} />} label={t.computer} color="purple" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlotPlannerTab({ t, config }: { t: any, config: any }) {
  const [length, setLength] = useState<number>(40);
  const [width, setWidth] = useState<number>(60);
  const [roadWidth, setRoadWidth] = useState<number>(10);

  // Simplified Setback Rules (Typical for residential in many regions)
  const calculateSetbacks = () => {
    let front = 5;
    let back = 5;
    let side = 4;

    if (roadWidth >= 20) front = 10;
    else if (roadWidth >= 12) front = 8;

    if (length * width > 3000) {
      back = 8;
      side = 5;
    }

    return { front, back, side };
  };

  const setbacks = calculateSetbacks();
  const buildableLength = Math.max(0, length - setbacks.front - setbacks.back);
  const buildableWidth = Math.max(0, width - (setbacks.side * 2));
  const buildableArea = buildableLength * buildableWidth;
  const totalArea = length * width;
  const mgc = (buildableArea / totalArea) * 100;

  return (
    <div className="space-y-6">
      <div className="card-glass transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 text-white">{t.plot_planner}</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <InputGroup label={t.length} value={length} onChange={setLength} />
          <InputGroup label={t.width} value={width} onChange={setWidth} />
          <InputGroup label={t.roadWidth} value={roadWidth} onChange={setRoadWidth} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="glass p-6 border border-white/10">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
                <Info size={18} className="text-white" />
                {t.setback}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-white/40 font-medium uppercase tracking-widest text-[10px]">{t.front}</p><p className="font-bold text-white text-lg">{setbacks.front} ft</p></div>
                <div><p className="text-white/40 font-medium uppercase tracking-widest text-[10px]">{t.back}</p><p className="font-bold text-white text-lg">{setbacks.back} ft</p></div>
                <div><p className="text-white/40 font-medium uppercase tracking-widest text-[10px]">{t.side}</p><p className="font-bold text-white text-lg">{setbacks.side} ft</p></div>
              </div>
            </div>

            <div className="glass p-6 border border-white/10">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
                <Calculator size={18} className="text-white" />
                {t.mgc}
              </h3>
              <p className="text-4xl font-black mb-1 text-white tracking-tighter">{mgc.toFixed(1)}%</p>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{t.buildableArea}: {buildableArea} sq ft</p>
            </div>

            <div className="glass p-6 border border-white/10">
              <h3 className="font-bold mb-2 flex items-center gap-2 text-white">
                <Zap size={18} className="text-amber-400" />
                {t.advice}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed italic">
                {mgc > 65 
                  ? "আপনার গ্রাউন্ড কভারেজ অনেক বেশি। পর্যাপ্ত আলো-বাতাসের জন্য সেটব্যাক বাড়ানো উচিত।" 
                  : "আপনার প্ল্যানটি স্ট্যান্ডার্ড রুলস অনুযায়ী সঠিক আছে।"}
                {roadWidth < 12 && " রাস্তা সরু হওয়ার কারণে সামনের সেটব্যাক অন্তত ৫-৮ ফুট রাখা নিরাপদ।"}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 ml-1">{t.plotMap}</p>
            <div className="relative border-2 border-white/10 glass rounded-xl overflow-hidden" style={{ width: '200px', height: '250px' }}>
              {/* Plot Boundary */}
              <div className="absolute inset-0 border-4 border-white/10 opacity-20" />
              
              {/* Buildable Area */}
              <motion.div 
                layout
                className={cn("absolute border-2 border-dashed bg-white/10 backdrop-blur-md", config.border)}
                style={{
                  top: `${(setbacks.front / length) * 100}%`,
                  bottom: `${(setbacks.back / length) * 100}%`,
                  left: `${(setbacks.side / width) * 100}%`,
                  right: `${(setbacks.side / width) * 100}%`,
                }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-tighter text-white opacity-40">Building</span>
                </div>
              </motion.div>

              {/* Labels */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white/40 uppercase tracking-widest">ROAD</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type="number" 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full glass border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-white/20 font-bold text-white transition-all"
      />
    </div>
  );
}

function BeamDesignTab({ t, config, lang }: { t: any, config: any, lang: 'bn' | 'en' }) {
  const [length, setLength] = useState<number>(10);
  const [supportType, setSupportType] = useState<'simply' | 'cantilever'>('simply');
  const [pointLoads, setPointLoads] = useState<{ id: string, pos: number, mag: number }[]>([
    { id: '1', pos: 5, mag: 10 }
  ]);
  const [udls, setUdls] = useState<{ id: string, start: number, end: number, mag: number }[]>([
    { id: '1', start: 0, end: 10, mag: 2 }
  ]);

  const addPointLoad = () => {
    setPointLoads([...pointLoads, { id: Math.random().toString(36).substr(2, 9), pos: length / 2, mag: 5 }]);
  };

  const removePointLoad = (id: string) => {
    setPointLoads(pointLoads.filter(p => p.id !== id));
  };

  const updatePointLoad = (id: string, field: 'pos' | 'mag', val: number) => {
    setPointLoads(pointLoads.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const addUDL = () => {
    setUdls([...udls, { id: Math.random().toString(36).substr(2, 9), start: 0, end: length, mag: 1 }]);
  };

  const removeUDL = (id: string) => {
    setUdls(udls.filter(u => u.id !== id));
  };

  const updateUDL = (id: string, field: 'start' | 'end' | 'mag', val: number) => {
    setUdls(udls.map(u => u.id === id ? { ...u, [field]: val } : u));
  };

  // Calculations
  const calculateDiagrams = () => {
    const steps = 101;
    const data = [];
    const dx = length / (steps - 1);

    let r1 = 0;
    let r2 = 0;
    let m1 = 0; // Moment at fixed end for cantilever

    if (supportType === 'simply') {
      // Reactions for simply supported
      let totalMomentR1 = 0;
      let totalLoad = 0;

      pointLoads.forEach(p => {
        totalMomentR1 += p.mag * p.pos;
        totalLoad += p.mag;
      });

      udls.forEach(u => {
        const w = u.mag * (u.end - u.start);
        const center = (u.start + u.end) / 2;
        totalMomentR1 += w * center;
        totalLoad += w;
      });

      r2 = totalMomentR1 / length;
      r1 = totalLoad - r2;
    } else {
      // Cantilever (fixed at x=0)
      pointLoads.forEach(p => {
        r1 += p.mag;
        m1 += p.mag * p.pos;
      });
      udls.forEach(u => {
        const w = u.mag * (u.end - u.start);
        const center = (u.start + u.end) / 2;
        r1 += w;
        m1 += w * center;
      });
    }

    for (let i = 0; i < steps; i++) {
      const x = i * dx;
      let shear = 0;
      let moment = 0;

      if (supportType === 'simply') {
        shear = r1;
        moment = r1 * x;

        pointLoads.forEach(p => {
          if (x >= p.pos) {
            shear -= p.mag;
            moment -= p.mag * (x - p.pos);
          }
        });

        udls.forEach(u => {
          if (x > u.start) {
            const loadX = Math.min(x, u.end) - u.start;
            const w = u.mag * loadX;
            const center = u.start + loadX / 2;
            shear -= w;
            moment -= w * (x - center);
          }
        });
      } else {
        // Cantilever
        shear = r1;
        moment = -m1 + r1 * x;

        pointLoads.forEach(p => {
          if (x >= p.pos) {
            shear -= p.mag;
            moment -= p.mag * (x - p.pos);
          }
        });

        udls.forEach(u => {
          if (x > u.start) {
            const loadX = Math.min(x, u.end) - u.start;
            const w = u.mag * loadX;
            const center = u.start + loadX / 2;
            shear -= w;
            moment -= w * (x - center);
          }
        });
      }

      data.push({
        x: Number(x.toFixed(2)),
        shear: Number(shear.toFixed(2)),
        moment: Number(moment.toFixed(2))
      });
    }

    return { data, r1, r2, m1 };
  };

  const { data, r1, r2, m1 } = calculateDiagrams();

  return (
    <div className="space-y-6">
      <div className="card-glass transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
          <Construction className="text-white" size={28} />
          {t.beam_design}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="glass p-6 border border-white/10">
              <h3 className="font-bold mb-4 text-white flex items-center gap-2">
                <Ruler size={18} className="text-white" />
                {lang === 'bn' ? 'বিম প্যারামিটার' : 'Beam Parameters'}
              </h3>
              <div className="space-y-4">
                <InputGroup label={lang === 'bn' ? 'বিম দৈর্ঘ্য (ফুট)' : 'Beam Length (ft)'} value={length} onChange={setLength} />
                <div className="space-y-2">
                  <label className="text-xs font-black text-white/40 uppercase tracking-widest ml-1">
                    {lang === 'bn' ? 'সাপোর্ট টাইপ' : 'Support Type'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSupportType('simply')}
                      className={cn(
                        "py-2 px-4 rounded-xl text-sm font-bold border transition-all",
                        supportType === 'simply' 
                          ? "bg-white/20 text-white border-white/30" 
                          : "glass text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {lang === 'bn' ? 'সিম্পলি সাপোর্টেড' : 'Simply Supported'}
                    </button>
                    <button
                      onClick={() => setSupportType('cantilever')}
                      className={cn(
                        "py-2 px-4 rounded-xl text-sm font-bold border transition-all",
                        supportType === 'cantilever' 
                          ? "bg-white/20 text-white border-white/30" 
                          : "glass text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {lang === 'bn' ? 'ক্যান্টিলিভার' : 'Cantilever'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Activity size={18} className="text-white" />
                  {lang === 'bn' ? 'পয়েন্ট লোড' : 'Point Loads'}
                </h3>
                <button onClick={addPointLoad} className="p-1.5 rounded-lg glass text-white border border-white/20 hover:bg-white/20 transition-all">
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {pointLoads.map(p => (
                  <div key={p.id} className="glass p-3 space-y-2 border border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Load {p.id.substr(0, 3)}</span>
                      <button onClick={() => removePointLoad(p.id)} className="text-white/40 hover:text-white transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase">Pos (ft)</label>
                        <input 
                          type="number" 
                          value={p.pos} 
                          onChange={(e) => updatePointLoad(p.id, 'pos', Number(e.target.value))}
                          className="w-full glass border border-white/10 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase">Mag (kip)</label>
                        <input 
                          type="number" 
                          value={p.mag} 
                          onChange={(e) => updatePointLoad(p.id, 'mag', Number(e.target.value))}
                          className="w-full glass border border-white/10 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Layers size={18} className="text-white" />
                  {lang === 'bn' ? 'UDL লোড' : 'UDL Loads'}
                </h3>
                <button onClick={addUDL} className="p-1.5 rounded-lg glass text-white border border-white/20 hover:bg-white/20 transition-all">
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {udls.map(u => (
                  <div key={u.id} className="glass p-3 space-y-2 border border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">UDL {u.id.substr(0, 3)}</span>
                      <button onClick={() => removeUDL(u.id)} className="text-white/40 hover:text-white transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase">Start</label>
                        <input 
                          type="number" 
                          value={u.start} 
                          onChange={(e) => updateUDL(u.id, 'start', Number(e.target.value))}
                          className="w-full glass border border-white/10 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase">End</label>
                        <input 
                          type="number" 
                          value={u.end} 
                          onChange={(e) => updateUDL(u.id, 'end', Number(e.target.value))}
                          className="w-full glass border border-white/10 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase">w (k/ft)</label>
                        <input 
                          type="number" 
                          value={u.mag} 
                          onChange={(e) => updateUDL(u.id, 'mag', Number(e.target.value))}
                          className="w-full glass border border-white/10 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div className="glass p-6 overflow-hidden">
              <h3 className="font-bold mb-6 flex items-center gap-2 text-white">
                <LayoutGrid size={18} className="text-white" />
                {lang === 'bn' ? 'বিম এবং লোড ডায়াগ্রাম' : 'Beam & Load Diagram'}
              </h3>
              <div className="relative w-full h-[180px] bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center p-4">
                <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                  {/* Beam */}
                  <rect x="10" y="18" width="80" height="2" fill="#444" rx="1" />
                  
                  {/* Supports */}
                  {supportType === 'simply' ? (
                    <>
                      {/* Left Support (Pinned) */}
                      <path d="M8 20 L12 20 L10 16 Z" fill="#666" />
                      <rect x="8" y="20" width="4" height="1" fill="#666" />
                      {/* Right Support (Roller) */}
                      <circle cx="90" cy="21" r="1" fill="#666" />
                      <rect x="88" y="22" width="4" height="0.5" fill="#666" />
                    </>
                  ) : (
                    /* Fixed Support */
                    <rect x="8" y="10" width="2" height="20" fill="#666" />
                  )}

                  {/* UDLs */}
                  {udls.map(u => {
                    const xStart = 10 + (u.start / length) * 80;
                    const xEnd = 10 + (u.end / length) * 80;
                    const width = xEnd - xStart;
                    return (
                      <g key={u.id}>
                        <rect x={xStart} y="8" width={width} height="10" fill={config.color === 'emerald' ? '#10b981' : config.color === 'orange' ? '#f97316' : config.color === 'blue' ? '#2563eb' : '#9333ea'} fillOpacity={0.2} stroke={config.color === 'emerald' ? '#10b981' : config.color === 'orange' ? '#f97316' : config.color === 'blue' ? '#2563eb' : '#9333ea'} strokeWidth="0.2" />
                        {/* Small arrows for UDL */}
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <path key={idx} d={`M${xStart + (width/4)*idx} 8 L${xStart + (width/4)*idx} 16 M${xStart + (width/4)*idx - 0.5} 14.5 L${xStart + (width/4)*idx} 16 L${xStart + (width/4)*idx + 0.5} 14.5`} stroke={config.color === 'emerald' ? '#10b981' : config.color === 'orange' ? '#f97316' : config.color === 'blue' ? '#2563eb' : '#9333ea'} strokeWidth="0.3" fill="none" />
                        ))}
                        <text x={xStart + width/2} y="6" fontSize="2" textAnchor="middle" className="fill-stone-500 font-bold">{u.mag} k/ft</text>
                      </g>
                    );
                  })}

                  {/* Point Loads */}
                  {pointLoads.map(p => {
                    const x = 10 + (p.pos / length) * 80;
                    return (
                      <g key={p.id}>
                        <path d={`M${x} 2 L${x} 16 M${x-1} 14 L${x} 16 L${x+1} 14`} stroke="#ef4444" strokeWidth="0.8" fill="none" />
                        <text x={x} y="1" fontSize="2.5" textAnchor="middle" className="fill-red-600 font-black">{p.mag} kip</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="glass p-6 border border-white/10">
              <h3 className="font-bold mb-6 flex items-center gap-2 text-white">
                <Activity size={18} className="text-white" />
                {lang === 'bn' ? 'Shear Force Diagram (SFD)' : 'Shear Force Diagram (SFD)'}
              </h3>
              <div className="h-[250px] w-full glass border border-white/10 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="x" hide />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', backdropFilter: 'blur(10px)' }} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    <Area type="stepAfter" dataKey="shear" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass p-6 border border-white/10">
              <h3 className="font-bold mb-6 flex items-center gap-2 text-white">
                <Activity size={18} className="text-white" />
                {lang === 'bn' ? 'Bending Moment Diagram (BMD)' : 'Bending Moment Diagram (BMD)'}
              </h3>
              <div className="h-[250px] w-full glass border border-white/10 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="x" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', backdropFilter: 'blur(10px)' }} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    <Area type="monotone" dataKey="moment" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="glass p-4 border border-white/10">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">R1 (Left)</p>
                <p className="text-xl font-black text-white">{r1.toFixed(2)} kip</p>
              </div>
              {supportType === 'simply' && (
                <div className="glass p-4 border border-white/10">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">R2 (Right)</p>
                  <p className="text-xl font-black text-white">{r2.toFixed(2)} kip</p>
                </div>
              )}
              {supportType === 'cantilever' && (
                <div className="glass p-4 border border-white/10">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">M1 (Fixed)</p>
                  <p className="text-xl font-black text-red-500">{m1.toFixed(2)} k-ft</p>
                </div>
              )}
              <div className="glass p-4 border border-white/10">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Max Moment</p>
                <p className="text-xl font-black text-red-500">
                  {Math.max(...data.map(d => Math.abs(d.moment))).toFixed(2)} k-ft
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlabDesignTab({ t, config, lang }: { t: any, config: any, lang: 'bn' | 'en' }) {
  const [lx, setLx] = useState<number>(12);
  const [ly, setLy] = useState<number>(15);
  const [thickness, setThickness] = useState<number>(5);
  const [floorFinish, setFloorFinish] = useState<number>(25);
  const [partitionWall, setPartitionWall] = useState<number>(40);
  const [liveLoad, setLiveLoad] = useState<number>(40);

  const concreteDensity = 150; // pcf
  
  const maxSpan = Math.max(lx, ly, 1);
  const minSpan = Math.min(lx, ly, 1);
  const isTwoWay = (maxSpan / minSpan) <= 2;
  const selfWeight = (thickness / 12) * concreteDensity;
  const totalDeadLoad = selfWeight + floorFinish + partitionWall;
  const factoredLoad = (1.2 * totalDeadLoad) + (1.6 * liveLoad);

  return (
    <div className="space-y-6">
      <div className="card-glass transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
          <Layers className="text-white" size={28} />
          {t.slab_design}
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t.shortSpan} value={lx} onChange={setLx} />
              <InputGroup label={t.longSpan} value={ly} onChange={setLy} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t.thickness} value={thickness} onChange={setThickness} />
              <InputGroup label={t.liveLoad} value={liveLoad} onChange={setLiveLoad} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t.floorFinish} value={floorFinish} onChange={setFloorFinish} />
              <InputGroup label={t.partitionWall} value={partitionWall} onChange={setPartitionWall} />
            </div>
          </div>
          
            <div className="glass p-6 flex flex-col items-center justify-between overflow-hidden relative min-h-[400px] border border-white/10">
              {/* Blueprint Background */}
              <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:1rem_1rem]" />
              
              <div className="w-full flex justify-between items-center relative z-10 mb-4">
                <h3 className="font-bold flex items-center gap-2 glass px-3 py-1.5 rounded-xl border border-white/10 text-white">
                  <LayoutGrid size={18} className="text-white" />
                  {lang === 'bn' ? 'ইন্টারেক্টিভ মডেল' : 'Interactive Model'}
                </h3>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold glass text-white/60 px-2 py-1 rounded-md uppercase tracking-wider border border-white/10">Plan</span>
                  <span className="text-[10px] font-bold glass text-white/60 px-2 py-1 rounded-md uppercase tracking-wider border border-white/10">Section</span>
                </div>
              </div>

            {/* Plan View */}
            <div className="relative w-full flex-1 flex items-center justify-center z-10 p-8">
              <motion.div
                layout
                className={cn("relative border-4 flex items-center justify-center bg-white/10", config.border)}
                animate={{
                  width: `${(lx / maxSpan) * 100}%`,
                  height: `${(ly / maxSpan) * 100}%`,
                }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
              >
                {/* Reinforcement Mesh */}
                <div className="absolute inset-2 opacity-20 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:0.5rem_0.5rem]" />
                
                {/* Columns */}
                <div className="absolute -top-3 -left-3 w-6 h-6 bg-white/20 rounded-sm" />
                <div className="absolute -top-3 -right-3 w-6 h-6 bg-white/20 rounded-sm" />
                <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-white/20 rounded-sm" />
                <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-white/20 rounded-sm" />

                {/* Load Distribution Arrows */}
                {isTwoWay ? (
                  <div className="absolute inset-0 flex items-center justify-center opacity-70 text-white">
                    <ArrowRightLeft size={36} className="absolute rotate-90" />
                    <ArrowRightLeft size={36} className="absolute" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-70 text-white">
                    <ArrowRightLeft size={36} className={lx < ly ? "" : "rotate-90"} />
                  </div>
                )}

                {/* Dimension Ly */}
                <div className="absolute -right-10 top-0 bottom-0 flex items-center">
                  <div className="w-px h-full bg-white/30 relative">
                    <div className="absolute top-0 -left-1.5 w-3 h-px bg-white/30" />
                    <div className="absolute bottom-0 -left-1.5 w-3 h-px bg-white/30" />
                  </div>
                  <div className="absolute left-2 bg-white/10 backdrop-blur-md px-1 py-0.5 rounded text-[10px] font-black text-white whitespace-nowrap rotate-90 origin-left translate-y-1/2">
                    Ly = {ly}'
                  </div>
                </div>

                {/* Dimension Lx */}
                <div className="absolute -bottom-10 left-0 right-0 flex justify-center">
                  <div className="h-px w-full bg-white/30 relative">
                    <div className="absolute left-0 -top-1.5 h-3 w-px bg-white/30" />
                    <div className="absolute right-0 -top-1.5 h-3 w-px bg-white/30" />
                  </div>
                  <div className="absolute top-2 bg-white/10 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-black text-white whitespace-nowrap">
                    Lx = {lx}'
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Cross Section View */}
            <div className="w-full mt-8 z-10 glass p-4 backdrop-blur-md border border-white/10">
              <div className="relative w-full flex items-end justify-center h-24 border-b-2 border-white/10 pb-2 px-12">
                
                {/* Supports */}
                <div className="w-6 h-16 glass border-2 border-white/20 border-b-0 absolute left-8 bottom-2 rounded-t-sm" />
                <div className="w-6 h-16 glass border-2 border-white/20 border-b-0 absolute right-8 bottom-2 rounded-t-sm" />

                <motion.div
                  layout
                  className={cn("w-full border-2 relative overflow-hidden z-10 bg-white/20", config.border)}
                  animate={{
                    height: `${Math.max(16, Math.min(72, (thickness / 12) * 72))}px`
                  }}
                  transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                >
                  {/* Concrete Texture */}
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:4px_4px]" />
                  {/* Rebar */}
                  <div className="absolute bottom-1.5 left-0 right-0 h-1.5 border-b-2 border-dashed border-white/40 opacity-60" />
                  <div className="absolute top-1.5 left-0 right-0 h-1.5 border-t-2 border-dashed border-white/40 opacity-30" />
                </motion.div>
                
                {/* Thickness Dimension */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                  <div className="h-full w-px bg-white/30 relative">
                    <div className="absolute top-0 -left-1.5 w-3 h-px bg-white/30" />
                    <div className="absolute bottom-0 -left-1.5 w-3 h-px bg-white/30" />
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-1 rounded text-[10px] font-black text-white ml-1 border border-white/10">
                    {thickness}"
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass p-6 border border-white/10">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
                <Info size={18} className="text-white" />
                {t.slabType}
              </h3>
              <p className="text-4xl font-black mb-1 text-white tracking-tighter">
                {isTwoWay ? t.twoWaySlab : t.oneWaySlab}
              </p>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                Ratio = {(maxSpan / minSpan).toFixed(2)}
              </p>
            </div>

            <div className="glass p-6 border border-white/10">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
                <Calculator size={18} className="text-white" />
                {t.loadAnalysis}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/40 font-medium uppercase tracking-widest text-[10px]">{t.selfWeight}</span>
                  <span className="font-bold text-white glass px-2 py-0.5 rounded-md border border-white/10">{selfWeight.toFixed(1)} psf</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/40 font-medium uppercase tracking-widest text-[10px]">{t.floorFinish}</span>
                  <span className="font-bold text-white glass px-2 py-0.5 rounded-md border border-white/10">{floorFinish.toFixed(1)} psf</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/40 font-medium uppercase tracking-widest text-[10px]">{t.partitionWall}</span>
                  <span className="font-bold text-white glass px-2 py-0.5 rounded-md border border-white/10">{partitionWall.toFixed(1)} psf</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-white/60 font-bold uppercase tracking-widest text-[10px]">{t.totalDeadLoad}</span>
                  <span className="font-bold text-white glass px-2 py-0.5 rounded-md border border-white/10">{totalDeadLoad.toFixed(1)} psf</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60 font-bold uppercase tracking-widest text-[10px]">{t.liveLoad}</span>
                  <span className="font-bold text-white glass px-2 py-0.5 rounded-md border border-white/10">{liveLoad.toFixed(1)} psf</span>
                </div>
                <div className="pt-3 border-t border-white/10 flex justify-between items-center text-base">
                  <span className="font-black text-white uppercase tracking-widest text-xs">{t.factoredLoad}</span>
                  <span className="font-black text-xl text-white tracking-tighter">{factoredLoad.toFixed(1)} psf</span>
                </div>
                <div className="text-[10px] text-white/40 text-right mt-2 font-medium">
                  * Wu = 1.2 DL + 1.6 LL (ACI Code)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoonTab({ t, config, tabId }: { t: any, config: any, tabId: string }) {
  return (
    <div className="glass p-12 text-center space-y-8">
      <div className={cn("w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto", config.bg, "text-white")}>
        {TAB_ICONS[tabId]}
      </div>
      <div>
        <h2 className="text-3xl font-black mb-2 text-white">{t[tabId]}</h2>
        <p className="text-white/60 font-medium text-lg">{t.comingSoon}</p>
      </div>
      <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-white/40 text-sm">
        Stay tuned for the next major update!
      </div>
    </div>
  );
}

const UNIT_INFO: Record<string, string> = {
  m: "Meter - Base unit of length in the International System of Units (SI).",
  cm: "Centimeter - 1/100th of a meter. Common for small measurements.",
  mm: "Millimeter - 1/1000th of a meter. Used for precise engineering measurements.",
  km: "Kilometer - 1000 meters. Used for long distances.",
  in: "Inch - 1/12th of a foot. Common in US and UK.",
  ft: "Foot - 12 inches. Standard for height and short distances in US.",
  yd: "Yard - 3 feet. Used in landscaping and textiles.",
  mi: "Mile - 5280 feet. Used for long distances in US and UK.",
  sq_m: "Square Meter - Base unit of area in SI.",
  sq_ft: "Square Foot - Common area measurement in real estate (US/UK).",
  sq_in: "Square Inch - Small area measurement.",
  acre: "Acre - 43,560 sq ft. Used for land measurement.",
  hectare: "Hectare - 10,000 sq meters. Used for large land tracts.",
  decimal: "Decimal - 1/100th of an acre. Common in South Asia.",
  katha: "Katha - Traditional land measure in South Asia (~720 sq ft).",
  bigha: "Bigha - Traditional land measure in South Asia (~14,400 sq ft).",
  kg: "Kilogram - Base unit of mass in SI.",
  g: "Gram - 1/1000th of a kg. Used for small weights.",
  mg: "Milligram - 1/1000th of a gram. Used in medicine and chemistry.",
  lb: "Pound - 16 ounces. Standard weight in US.",
  oz: "Ounce - 1/16th of a pound.",
  ton: "Metric Ton - 1000 kg. Used for heavy loads.",
  liter: "Liter - Base unit of volume in metric system.",
  ml: "Milliliter - 1/1000th of a liter.",
  cubic_m: "Cubic Meter - 1000 liters. Used for large volumes.",
  cubic_ft: "Cubic Foot - Common volume measurement in US.",
  gallon_us: "US Gallon - ~3.785 liters. Standard for liquids in US."
};

const CONVERSION_RATES: any = {
  length: {
    m: 1,
    cm: 100,
    mm: 1000,
    km: 0.001,
    in: 39.3701,
    ft: 3.28084,
    yd: 1.09361,
    mi: 0.000621371
  },
  area: {
    sq_m: 1,
    sq_ft: 10.7639,
    sq_in: 1550,
    acre: 0.000247105,
    hectare: 0.0001,
    decimal: 0.0247105,
    katha: 0.0149499,
    bigha: 0.000747494
  },
  weight: {
    kg: 1,
    g: 1000,
    mg: 1000000,
    lb: 2.20462,
    oz: 35.274,
    ton: 0.001
  },
  volume: {
    liter: 1,
    ml: 1000,
    cubic_m: 0.001,
    cubic_ft: 0.0353147,
    gallon_us: 0.264172
  }
};

function UnitConverterTab({ t, config }: { t: any, config: any }) {
  const [category, setCategory] = useState('length');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  const [inputValue, setInputValue] = useState<number | ''>(1);

  useEffect(() => {
    const units = Object.keys(CONVERSION_RATES[category]);
    setFromUnit(units[0]);
    setToUnit(units[1] || units[0]);
  }, [category]);

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const rates = CONVERSION_RATES[category];
  const val = typeof inputValue === 'number' ? inputValue : 0;
  const result = (val / rates[fromUnit]) * rates[toUnit];

  return (
    <div className="space-y-6">
      <div className="card-glass transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
          <ArrowRightLeft className="text-white" size={28} />
          {t.unit_converter}
        </h2>

        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['length', 'area', 'weight', 'volume'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all border", 
                  category === cat 
                    ? "bg-white/20 text-white border-white/30 scale-105" 
                    : "glass text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
                )}
              >
                {t[cat] || cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center glass p-6 border border-white/10">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{t.from}</label>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full glass border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-white/20 font-bold text-lg text-white transition-all"
              />
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full glass border border-white/10 rounded-xl p-3 focus:outline-none font-medium text-white transition-all appearance-none"
              >
                {Object.keys(rates).map(u => <option key={u} value={u} className="bg-stone-900">{u}</option>)}
              </select>
              <div className="flex items-start gap-1.5 mt-2 px-1 text-white/50">
                <Info size={12} className="mt-0.5 shrink-0" />
                <p className="text-[10px] leading-tight">{UNIT_INFO[fromUnit]}</p>
              </div>
            </div>

            <button onClick={handleSwap} className="p-4 rounded-full glass text-white border border-white/20 hover:scale-110 transition-all mx-auto mt-6 md:mt-0">
              <ArrowRightLeft size={20} />
            </button>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{t.to}</label>
              <div className="w-full glass border border-white/10 rounded-xl p-3 font-black text-lg text-white overflow-hidden text-ellipsis transition-all min-h-[52px] flex items-center">
                {(result || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full glass border border-white/10 rounded-xl p-3 focus:outline-none font-medium text-white transition-all appearance-none"
              >
                {Object.keys(rates).map(u => <option key={u} value={u} className="bg-stone-900">{u}</option>)}
              </select>
              <div className="flex items-start gap-1.5 mt-2 px-1 text-white/50">
                <Info size={12} className="mt-0.5 shrink-0" />
                <p className="text-[10px] leading-tight">{UNIT_INFO[toUnit]}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeTab({ t, lang, dept, config, setActiveTab }: { t: any, lang: 'bn' | 'en', dept: Dept, config: any, setActiveTab: (tab: Tab) => void }) {
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [shuffledTopics, setShuffledTopics] = useState<any[]>([]);

  const refreshTopics = () => {
    const topics = [...(homeTopics[dept] || [])].sort(() => Math.random() - 0.5);
    setShuffledTopics(topics);
  };

  useEffect(() => {
    refreshTopics();
  }, [dept]);

  const quickActions = DEPT_TABS[dept].filter(tab => tab !== 'home').slice(0, 4);

  const dailyTip = {
    en: "Always double-check your unit conversions before finalizing any structural design calculations.",
    bn: "যেকোনো স্ট্রাকচারাল ডিজাইনের হিসাব চূড়ান্ত করার আগে সর্বদা আপনার ইউনিটের রূপান্তরগুলো দুবার চেক করুন।"
  };

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card-glass text-white p-10 relative overflow-hidden"
      >
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        <motion.div 
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -right-20 -top-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ 
            rotate: -360,
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -left-20 -bottom-20 w-80 h-80 bg-black/10 rounded-full blur-3xl" 
        />

        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20">
                {config.icon}
              </div>
              <span className="font-bold tracking-widest uppercase text-sm opacity-90">{t[dept]} Engineering</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tight leading-tight">{t.welcome}</h2>
            <p className="opacity-90 font-medium text-xl leading-relaxed max-w-lg">{t.tagline}</p>
          </motion.div>
          
          <div className="mt-10 flex flex-wrap gap-4">
            <button 
              onClick={() => setActiveTab('chat')}
              className="px-6 py-3 bg-white text-stone-900 rounded-2xl font-black hover:scale-105 transition-all flex items-center gap-2"
            >
              <MessageSquare size={20} className={config.text} />
              {lang === 'bn' ? 'এআই চ্যাট শুরু করুন' : 'Start AI Chat'}
            </button>
            <button 
              onClick={() => setActiveTab('quiz')}
              className="px-6 py-3 glass text-white rounded-2xl font-bold hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20"
            >
              <Trophy size={20} />
              {t.quiz}
            </button>
          </div>
        </div>
        
        <div className="absolute bottom-0 right-0 p-8 opacity-10 scale-[5] pointer-events-none translate-x-1/4 translate-y-1/4">
          {config.icon}
        </div>
      </motion.div>

      {/* Daily Tip Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass p-6 flex items-start gap-4 border border-white/10"
      >
        <div className="p-3 bg-white/10 rounded-xl text-white shrink-0 border border-white/10">
          <Zap size={24} className="text-amber-400" />
        </div>
        <div>
          <h4 className="font-black text-white mb-1 uppercase tracking-widest text-xs opacity-40">{lang === 'bn' ? 'আজকের টিপস' : 'Daily Tip'}</h4>
          <p className="text-white/80 font-medium leading-relaxed italic">"{dailyTip[lang]}"</p>
        </div>
      </motion.div>

      {/* Quick Actions Grid */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-white px-2 flex items-center gap-2">
          <LayoutGrid size={20} className="text-white" />
          {lang === 'bn' ? 'কুইক এক্সেস' : 'Quick Access'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((tab, i) => (
            <motion.button
              key={tab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setActiveTab(tab)}
              className="glass p-6 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-4 group border border-white/10"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 glass text-white border border-white/20">
                {TAB_ICONS[tab]}
              </div>
              <span className="font-bold text-white/40 text-xs uppercase tracking-widest text-center group-hover:text-white transition-colors">{t[tab]}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Q&A Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-2 h-8 rounded-full bg-white/20" />
            {t.qna}
          </h3>
          <button 
            onClick={refreshTopics}
            className="p-2 px-4 rounded-xl glass hover:bg-white/10 text-white/60 transition-all flex items-center gap-2 text-sm font-bold"
            title="Refresh QnA"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">{lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shuffledTopics.map((topic: any, i: number) => (
            <motion.div 
              key={topic.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedTopic(topic)}
              className="group glass p-6 hover:bg-white/10 transition-all cursor-pointer flex flex-col h-full border border-white/10"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 glass text-white border border-white/20">
                  <MessageSquare size={20} />
                </div>
                <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/30 group-hover:text-white group-hover:bg-white/10 transition-all border border-white/10">
                  <ChevronRight size={16} />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg text-white group-hover:text-white/80 transition-colors mb-2 line-clamp-2">{topic.title[lang]}</h4>
                <p className="text-white/60 text-sm line-clamp-2 leading-relaxed italic">"{topic.desc[lang]}"</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedTopic && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTopic(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative card-glass w-full max-w-2xl p-10 overflow-hidden"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center glass text-white border border-white/10">
                    <Info size={24} />
                  </div>
                  <h3 className="text-3xl font-black text-white">{selectedTopic.title[lang]}</h3>
                </div>
                <button onClick={() => setSelectedTopic(null)} className="p-3 rounded-xl glass hover:bg-white/10 text-white/60 transition-all">
                  <X size={28} />
                </button>
              </div>

              <div className="glass p-8 mb-8">
                <p className="text-white/80 leading-relaxed text-xl font-medium italic">
                  "{selectedTopic.content[lang]}"
                </p>
              </div>

              <button 
                onClick={() => setSelectedTopic(null)}
                className="w-full py-5 glass hover:bg-white/10 text-white font-black text-lg transition-all"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SurveyTab({ t, config }: { t: any, config: any }) {
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [isSurveying, setIsSurveying] = useState(false);
  const [heading, setHeading] = useState(0);
  const [currentTime, setCurrentTime] = useState<string | null>(null);
  const [recordedPoints, setRecordedPoints] = useState<{ lat: number, lng: number, heading: number, time: string }[]>([]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (isSurveying) {
      setCurrentTime(new Date().toLocaleTimeString());
      timer = setInterval(() => {
        setCurrentTime(new Date().toLocaleTimeString());
      }, 1000);
    } else {
      setCurrentTime(null);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSurveying]);

  useEffect(() => {
    let watchId: number;
    if (isSurveying && navigator.geolocation) {
      setError(null);
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.error("Geolocation Error:", err);
          if (err.code === 1) setError("GPS Permission Denied");
          else if (err.code === 2) setError("GPS Position Unavailable");
          else if (err.code === 3) setError("GPS Timeout");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isSurveying]);

  useEffect(() => {
    const handleOrientation = (e: any) => {
      let compassHeading = 0;
      if (e.webkitCompassHeading) {
        // iOS
        compassHeading = e.webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Android / Other
        // alpha is 0 to 360, relative to the direction the device was pointing when the event was first fired
        // unless absolute is true
        compassHeading = e.absolute ? (360 - e.alpha) : (360 - e.alpha);
      }
      
      if (compassHeading !== undefined) {
        setHeading(compassHeading);
      }
    };

    if (isSurveying) {
      const win = window as any;
      const hasAbsolute = 'ondeviceorientationabsolute' in win;
      
      if (hasAbsolute) {
        win.addEventListener('deviceorientationabsolute', handleOrientation);
      } else {
        win.addEventListener('deviceorientation', handleOrientation);
      }

      return () => {
        win.removeEventListener('deviceorientationabsolute', handleOrientation);
        win.removeEventListener('deviceorientation', handleOrientation);
      };
    }
  }, [isSurveying]);

  const requestOrientationPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setIsSurveying(true);
        }
      } catch (error) {
        console.error("Permission Error:", error);
      }
    } else {
      setIsSurveying(true);
    }
  };

  return (
    <div className="space-y-8">
      <div className="card-glass p-8 transition-colors duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={cn("p-4 rounded-2xl glass border border-white/10", config.text)}>
              <Navigation size={28} />
            </div>
            <h2 className="text-3xl font-black text-white">{t.survey}</h2>
          </div>
          <div className={cn("px-4 py-2 rounded-xl glass text-[10px] font-black uppercase tracking-widest border border-white/10", isSurveying ? "text-red-400 animate-pulse" : "text-white/40")}>
            {isSurveying ? "Live" : "Idle"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Stats & Compass */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <SurveyCard label={t.lat} value={coords?.lat.toFixed(6) || "---"} config={config} />
              <SurveyCard label={t.lng} value={coords?.lng.toFixed(6) || "---"} config={config} />
              <SurveyCard label={t.rl} value="12.45 m" config={config} />
              <SurveyCard label={t.msl} value="15.20 m" config={config} />
              <div className="col-span-2">
                <SurveyCard label={t.currentTime} value={currentTime || "---"} config={config} />
              </div>
            </div>

            {/* Animated Compass */}
            <div className="relative aspect-square max-w-[280px] mx-auto bg-black/40 rounded-full p-6 border-8 border-white/5 overflow-hidden glass border-white/10">
              {/* Fixed Lubber Line (Needle) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-10 bg-red-500 z-20 rounded-b-full" />
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full rounded-full border border-white/5" />
              </div>
              
              {/* Rotating Compass Face */}
              <motion.div 
                animate={{ rotate: -heading }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                className="relative w-full h-full"
              >
                {['N', 'E', 'S', 'W'].map((dir, i) => (
                  <div 
                    key={dir} 
                    className={cn(
                      "absolute font-black text-sm",
                      dir === 'N' ? "text-red-500 scale-125" : "text-white/40"
                    )}
                    style={{ 
                      top: i === 0 ? '12%' : i === 2 ? '88%' : '50%',
                      left: i === 3 ? '12%' : i === 1 ? '88%' : '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    {dir}
                  </div>
                ))}
                
                {/* Degree Markers */}
                {[...Array(72)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "absolute w-0.5 bg-white/10",
                      i % 18 === 0 ? "h-5 bg-white/60 w-1" : i % 9 === 0 ? "h-4 bg-white/30" : "h-2"
                    )}
                    style={{ 
                      top: '50%', left: '50%',
                      transform: `translate(-50%, -50%) rotate(${i * 5}deg) translateY(-105px)`
                    }}
                  />
                ))}
              </motion.div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-4xl font-black text-white font-mono">{Math.round(heading)}°</p>
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{t.compass}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Map View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                <MapIcon size={14} />
                {t.mapView}
              </h3>
            </div>
            <div className="aspect-square bg-white/5 rounded-[2rem] border border-white/10 overflow-hidden relative">
              {coords ? (
                <div className="w-full h-full relative">
                  <iframe 
                    key={`${coords.lat}-${coords.lng}`}
                    className="w-full h-full border-0 grayscale opacity-80 contrast-125 dark:invert dark:hue-rotate-180"
                    src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`}
                    title="Google Map"
                    loading="lazy"
                    allowFullScreen
                  />
                  <div className="absolute bottom-2 right-2 glass px-2 py-1 rounded-lg text-[8px] font-bold text-white/60 pointer-events-none uppercase tracking-tighter">
                    Google Maps View
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-white/20 p-8 text-center">
                  <MapIcon size={48} className={cn(isSurveying ? "animate-pulse" : "")} />
                  <p className="text-xs font-bold uppercase tracking-widest">
                    {error ? error : (isSurveying ? "Locating your position..." : "Start Survey to see Map")}
                  </p>
                  {error && (
                    <button 
                      onClick={() => setIsSurveying(false)}
                      className="text-[10px] text-red-400 underline font-bold"
                    >
                      Reset & Try Again
                    </button>
                  )}
                </div>
              )}
              {coords && (
                <div className="absolute top-4 right-4 p-2 glass rounded-xl">
                  <Target size={20} className={config.text} />
                </div>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={() => isSurveying ? setIsSurveying(false) : requestOrientationPermission()}
          className={cn(
            "w-full mt-8 py-6 rounded-[2rem] font-black text-xl transition-all hover:scale-[1.01] active:scale-[0.99]",
            isSurveying 
              ? "bg-red-500 text-white" 
              : cn("text-white", config.bg)
          )}
        >
          {isSurveying ? t.stopSurvey : t.startSurvey}
        </button>

        {isSurveying && coords && (
          <button
            onClick={() => setRecordedPoints([...recordedPoints, { ...coords, heading, time: new Date().toLocaleTimeString() }])}
            className="w-full mt-4 py-4 rounded-[2rem] font-black text-lg transition-all hover:scale-[1.01] active:scale-[0.99] glass text-white border border-white/20 hover:bg-white/10"
          >
            Record Current Point
          </button>
        )}

        {recordedPoints.length > 0 && (
          <div className="mt-8 space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <MapIcon size={20} />
              Recorded Points
            </h3>
            <div className="space-y-2">
              {recordedPoints.map((pt, i) => (
                <div key={i} className="glass p-4 rounded-xl border border-white/10 flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold">Point {i + 1}</p>
                    <p className="text-white/60 text-xs font-mono">{pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{Math.round(pt.heading)}°</p>
                    <p className="text-white/60 text-xs">{pt.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setRecordedPoints([])}
              className="text-red-400 text-sm font-bold underline mt-2"
            >
              Clear All Points
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SurveyCard({ label, value, config }: { label: string, value: string, config: any }) {
  return (
    <div className="glass p-4 overflow-hidden border border-white/10">
      <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1 truncate">{label}</p>
      <p className={cn("text-lg sm:text-xl font-mono font-bold truncate", config.text)} title={value}>{value}</p>
    </div>
  );
}

function LandTab({ t, lang, config }: { t: any, lang: 'bn' | 'en', config: any }) {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [areaInfo, setAreaInfo] = useState<{
    sqm: number;
    sqft: number;
    decimal: number;
    katha: number;
    bigha: number;
  } | null>(null);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [aiCommand, setAiCommand] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [landAnalysis, setLandAnalysis] = useState<string | null>(null);
  const [visualOverlays, setVisualOverlays] = useState<any[]>([]);
  const [calcMode, setCalcMode] = useState<'general' | 'coordinates' | 'station'>('general');
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
      });
    } else {
      setCenter([23.8103, 90.4125]); // Default Dhaka
    }
  }, []);

  useEffect(() => {
    if (points.length > 2) {
      const polygonPoints = [...points, points[0]]; // Close the polygon
      const turfPolygon = turf.polygon([polygonPoints.map(p => [p[1], p[0]])]);
      const areaSqm = turf.area(turfPolygon);
      
      const sqft = areaSqm * 10.7639;
      const decimal = sqft / 435.6;
      const katha = sqft / 720;
      const bigha = sqft / 14400;

      setAreaInfo({
        sqm: areaSqm,
        sqft,
        decimal,
        katha,
        bigha
      });
    } else {
      setAreaInfo(null);
      setVisualOverlays([]);
    }
  }, [points]);

  function MapEvents() {
    useMapEvents({
      click(e) {
        setPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
      },
    });
    return null;
  }

  const clearPoints = () => {
    setPoints([]);
    setLandAnalysis(null);
    setVisualOverlays([]);
  };

  const undoLastPoint = () => {
    setPoints(prev => prev.slice(0, -1));
  };

  const addManualPoint = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setPoints(prev => [...prev, [lat, lng]]);
      setManualLat("");
      setManualLng("");
      // Center map on the new point
      setCenter([lat, lng]);
    }
  };

  const addStationPoint = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPoints(prev => [...prev, [lat, lng]]);
          setCenter([lat, lng]);
          setIsLocating(false);
        },
        (err) => {
          console.error(err);
          setIsLocating(false);
          alert(lang === 'bn' ? "লোকেশন পাওয়া যায়নি। দয়া করে জিপিএস চালু করুন।" : "Could not get location. Please enable GPS.");
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleAiCommand = async () => {
    if (!aiCommand.trim() || points.length < 3) return;
    setIsProcessing(true);
    try {
      const prompt = `
        I have a land area defined by these GPS coordinates: ${JSON.stringify(points)}.
        The user wants to: "${aiCommand}".
        Please analyze this land and provide a response.
        If the user wants to divide or mark something, describe how it would look.
        Return your response in Markdown.
      `;
      const response = await getChatResponse(prompt, [], 'long');
      setLandAnalysis(response);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const googleMapsUrl = (type: string) => {
    switch(type) {
      case 'satellite': return "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
      case 'hybrid': return "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
      default: return "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
    }
  };

  // 2D Model Normalization
  const getNormalizedPointsData = () => {
    if (points.length === 0) return [];
    const lats = points.map(p => p[0]);
    const lngs = points.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;
    
    // Maintain aspect ratio
    const scale = 60 / Math.max(latRange, lngRange);
    
    return points.map((p, i) => {
      const x = 20 + (p[1] - minLng) * scale;
      const y = 80 - (p[0] - minLat) * scale;
      return { 
        x, 
        y, 
        label: String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i/26) : ""),
        lat: p[0],
        lng: p[1]
      };
    });
  };

  const normalizedPoints = getNormalizedPointsData();
  const sideData = points.length > 2 ? normalizedPoints.map((p, i) => {
    const nextP = normalizedPoints[(i + 1) % normalizedPoints.length];
    const from = turf.point([p.lng, p.lat]);
    const to = turf.point([nextP.lng, nextP.lat]);
    const distKm = turf.distance(from, to);
    const distFt = distKm * 3280.84;
    
    return {
      x1: p.x,
      y1: p.y,
      x2: nextP.x,
      y2: nextP.y,
      midX: (p.x + nextP.x) / 2,
      midY: (p.y + nextP.y) / 2,
      label: `${p.label}${nextP.label}`,
      length: distFt.toFixed(1) + " ft"
    };
  }) : [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="card-glass p-4 sm:p-8 transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={cn("p-3 sm:p-4 rounded-2xl glass border border-white/10", config.text)}>
              <MapIcon size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-white">{t.land}</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-1 sm:gap-2 glass p-1 rounded-2xl border border-white/10 w-full md:w-auto">
            <button 
              onClick={() => setMapType('roadmap')}
              className={cn("px-2 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap w-full", mapType === 'roadmap' ? "bg-white/20 text-white" : "text-white/40")}
            >
              Roadmap
            </button>
            <button 
              onClick={() => setMapType('satellite')}
              className={cn("px-2 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap w-full", mapType === 'satellite' ? "bg-white/20 text-white" : "text-white/40")}
            >
              Satellite
            </button>
            <button 
              onClick={() => setMapType('hybrid')}
              className={cn("px-2 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap w-full", mapType === 'hybrid' ? "bg-white/20 text-white" : "text-white/40")}
            >
              Hybrid
            </button>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={undoLastPoint}
              disabled={points.length === 0}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl glass text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50 border border-white/10"
            >
              {lang === 'bn' ? "পয়েন্ট মুছুন" : "Undo"}
            </button>
            <button 
              onClick={clearPoints}
              disabled={points.length === 0}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl glass text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all disabled:opacity-50 border border-red-500/20"
            >
              {lang === 'bn' ? "সব মুছুন" : "Clear All"}
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-6 p-1 bg-white/5 rounded-2xl border border-white/10 w-full sm:w-fit">
          <button 
            onClick={() => setCalcMode('general')}
            className={cn("px-2 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all w-full", calcMode === 'general' ? "bg-white/20 text-white" : "text-white/40")}
          >
            {lang === 'bn' ? "সাধারণ" : "General"}
          </button>
          <button 
            onClick={() => setCalcMode('station')}
            className={cn("px-2 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all w-full", calcMode === 'station' ? "bg-white/20 text-white" : "text-white/40")}
          >
            {lang === 'bn' ? "স্টেশন (GPS)" : "Station (GPS)"}
          </button>
          <button 
            onClick={() => setCalcMode('coordinates')}
            className={cn("px-2 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all w-full", calcMode === 'coordinates' ? "bg-white/20 text-white" : "text-white/40")}
          >
            {lang === 'bn' ? "স্থানাঙ্ক" : "Coordinates"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Map View */}
          <div className="lg:col-span-2 space-y-4">
            {calcMode === 'coordinates' && (
              <div className="p-4 glass space-y-4">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  {lang === 'bn' 
                    ? `${points.length + 1} নং বিন্দুর অক্ষাংশ ও দ্রাঘিমাংশ দিন` 
                    : `Enter coordinates for Point ${points.length + 1}`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-white/40 uppercase ml-1">{lang === 'bn' ? "অক্ষাংশ (Latitude)" : "Latitude"}</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="e.g. 23.8103"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-white/40 uppercase ml-1">{lang === 'bn' ? "দ্রাঘিমাংশ (Longitude)" : "Longitude"}</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="e.g. 90.4125"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  onClick={addManualPoint}
                  className={cn("w-full py-3 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all", config.bg)}
                >
                  {lang === 'bn' ? "বিন্দু যোগ করুন" : "Add Point"}
                </button>
              </div>
            )}

            {calcMode === 'station' && (
              <div className="p-4 glass space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    {lang === 'bn' ? "আপনার বর্তমান অবস্থান ব্যবহার করুন" : "Use your current location"}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-white/40 uppercase">GPS ACTIVE</span>
                  </div>
                </div>
                <button 
                  onClick={addStationPoint}
                  disabled={isLocating}
                  className={cn("w-full py-4 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2", config.bg)}
                >
                  {isLocating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Navigation size={16} />
                  )}
                  {lang === 'bn' ? `${points.length + 1} নং বিন্দু হিসাবে বর্তমান লোকেশন নিন` : `Take Current Location as Point ${points.length + 1}`}
                </button>
                <p className="text-[9px] text-white/40 text-center italic">
                  {lang === 'bn' 
                    ? "* জমির এক কোণায় দাঁড়িয়ে বাটনে ক্লিক করুন, তারপর অন্য কোণায় গিয়ে আবার ক্লিক করুন।" 
                    : "* Stand at one corner of the land and click, then move to the next corner and click again."}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] sm:text-xs font-black text-white/40 uppercase tracking-widest leading-tight">{t.clickOnMap}</p>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-bold text-white/40 uppercase whitespace-nowrap">{points.length} POINTS</span>
              </div>
            </div>
            <div className="aspect-video lg:aspect-square bg-white/5 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden relative z-0">
              {center && (
                <MapContainer 
                  center={center} 
                  zoom={18} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                  scrollWheelZoom={true}
                  touchZoom={true}
                >
                  <TileLayer
                    attribution='&copy; Google Maps'
                    url={googleMapsUrl(mapType)}
                  />
                  <MapEvents />
                  {points.map((p, i) => (
                    <Marker key={i} position={p} />
                  ))}
                  {points.length > 1 && (
                    <Polygon 
                      positions={points} 
                      pathOptions={{ 
                        color: config.text.includes('emerald') ? '#10b981' : config.text.includes('orange') ? '#f97316' : config.text.includes('blue') ? '#3b82f6' : '#a855f7',
                        fillColor: config.text.includes('emerald') ? '#10b981' : config.text.includes('orange') ? '#f97316' : config.text.includes('blue') ? '#3b82f6' : '#a855f7',
                        fillOpacity: 0.3 
                      }} 
                    />
                  )}
                </MapContainer>
              )}
            </div>
          </div>

          {/* 2D Model & AI */}
          <div className="space-y-6">
            <div>
              <p className="text-[10px] sm:text-xs font-black text-white/40 uppercase tracking-widest mb-3 sm:mb-4">2D Model View</p>
              <div className="aspect-square bg-white/5 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 relative flex items-center justify-center overflow-hidden">
                {points.length > 2 ? (
                  <svg viewBox="0 0 100 100" className="w-full h-full p-4">
                    <polygon 
                      points={normalizedPoints.map(p => `${p.x},${p.y}`).join(" ")} 
                      className={cn("fill-current opacity-10 stroke-[1px] stroke-current", config.text)}
                    />
                    
                    {/* Side Labels */}
                    {sideData.map((side, i) => (
                      <g key={`side-${i}`}>
                        <text 
                          x={side.midX} 
                          y={side.midY} 
                          className="fill-white/40 font-black text-[3px] uppercase tracking-tighter"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {side.label}: {side.length}
                        </text>
                      </g>
                    ))}

                    {/* Vertex Points and Labels */}
                    {normalizedPoints.map((p, i) => (
                      <g key={`vertex-${i}`}>
                        <circle cx={p.x} cy={p.y} r="1.2" className={cn("fill-current", config.text)} />
                        <text 
                          x={p.x} 
                          y={p.y - 3} 
                          className={cn("font-black text-[4px] fill-current", config.text)}
                          textAnchor="middle"
                        >
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <div className="text-center p-6 sm:p-8">
                    <Compass size={40} className="sm:w-12 sm:h-12 mx-auto text-white/10 mb-4 animate-pulse" />
                    <p className="text-[9px] sm:text-[10px] font-black text-white/20 uppercase tracking-widest">Select at least 3 points on map</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] sm:text-xs font-black text-white/40 uppercase tracking-widest">{t.aiSuggestion}</p>
              <div className="relative">
                <input 
                  type="text"
                  placeholder={lang === 'bn' ? "AI কে কমান্ড দিন..." : "Command AI..."}
                  className="w-full glass border border-white/10 rounded-2xl py-3 sm:py-4 pl-4 sm:pl-6 pr-12 sm:pr-14 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white/20 text-white transition-all"
                  value={aiCommand}
                  onChange={(e) => setAiCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiCommand()}
                />
                <button 
                  onClick={handleAiCommand}
                  disabled={isProcessing || points.length < 3}
                  className={cn("absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl text-white transition-all disabled:opacity-50", config.bg)}
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>

              <AnimatePresence mode="wait">
                {landAnalysis && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 sm:p-6 glass max-h-[250px] overflow-y-auto no-scrollbar"
                  >
                    <div className="prose prose-xs sm:prose-sm prose-invert">
                      <ReactMarkdown>{landAnalysis}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <ResultCard label={t.sqft} value={areaInfo ? areaInfo.sqft.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "---"} unit="ft²" config={config} />
              <ResultCard label={t.decimal} value={areaInfo ? areaInfo.decimal.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "---"} unit="Dec" config={config} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value, unit, config }: { label: string, value: string, unit: string, config: any }) {
  return (
    <div className="glass p-6 group hover:border-white/20 transition-all">
      <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-mono font-black", config.text)}>{value}</span>
        <span className="text-[10px] font-bold text-white/40 uppercase">{unit}</span>
      </div>
    </div>
  );
}

function EstimatingTab({ t, config }: { t: any, config: any }) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const [floors, setFloors] = useState<number>(1);
  const [foundation, setFoundation] = useState<string>('Spread Footing');
  const [buildingType, setBuildingType] = useState<string>('Residential');
  const [areaSqft, setAreaSqft] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleEstimate = async () => {
    setLoading(true);
    try {
      const base64 = image ? image.split(',')[1] : null;
      const mimeType = image ? "image/png" : null;
      
      const details = {
        floors,
        foundation,
        type: buildingType,
        area: areaSqft
      };
      
      const res = await estimateMaterials(base64, mimeType, details);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-glass transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 text-white">{t.estimating}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{t.floors}</label>
            <input 
              type="number" 
              min="1"
              value={floors}
              onChange={(e) => setFloors(Number(e.target.value))}
              className="w-full glass border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-white/20 font-bold text-white transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{t.areaSqft} {t.optional}</label>
            <input 
              type="number" 
              placeholder="e.g. 1200"
              value={areaSqft}
              onChange={(e) => setAreaSqft(e.target.value)}
              className="w-full glass border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-white/20 font-bold text-white transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{t.foundationType}</label>
            <select 
              value={foundation}
              onChange={(e) => setFoundation(e.target.value)}
              className="w-full glass border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-white/20 font-bold text-white transition-all appearance-none"
            >
              <option value="Spread Footing" className="bg-stone-900">Spread Footing</option>
              <option value="Mat/Raft Foundation" className="bg-stone-900">Mat/Raft Foundation</option>
              <option value="Pile Foundation" className="bg-stone-900">Pile Foundation</option>
              <option value="Strip Foundation" className="bg-stone-900">Strip Foundation</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">{t.buildingType}</label>
            <select 
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value)}
              className="w-full glass border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-white/20 font-bold text-white transition-all appearance-none"
            >
              <option value="Residential" className="bg-stone-900">Residential</option>
              <option value="Commercial" className="bg-stone-900">Commercial</option>
              <option value="Industrial" className="bg-stone-900">Industrial</option>
            </select>
          </div>
        </div>

        <div className="relative aspect-video glass rounded-3xl border-2 border-dashed border-white/10 mb-6 flex items-center justify-center overflow-hidden group transition-all">
          {image ? (
            <>
              <img src={image} className="w-full h-full object-cover" alt="Plan" />
              <button onClick={() => setImage(null)} className="absolute top-4 right-4 p-2 glass hover:bg-white/10 text-white transition-all">
                <X size={20} />
              </button>
            </>
          ) : (
            <label className="cursor-pointer flex flex-col items-center gap-3 text-white/40 group-hover:text-white transition-colors">
              <div className="p-5 rounded-full glass group-hover:bg-white/10 transition-all border border-white/10">
                <Upload size={32} />
              </div>
              <span className="text-sm font-bold">{t.uploadPlan} {t.optional}</span>
              <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
            </label>
          )}
        </div>

        <button 
          onClick={handleEstimate}
          disabled={loading || (!image && !areaSqft)}
          className={cn("w-full text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50", config.bg)}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Calculator size={24} />}
          {t.estimate}
        </button>
      </div>

      {result && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard label={t.cement} value={`${result.cement || 0} Bags`} config={config} />
          <StatCard label={t.sand} value={`${result.sand || 0} cft`} config={config} />
          <StatCard label={t.bricks} value={`${result.bricks || 0} Pcs`} config={config} />
          <StatCard label={t.rods} value={`${result.rods || 0} kg`} config={config} />
          
          {result.breakdown && (
            <div className="col-span-2 card-glass p-6 mt-2 transition-colors duration-300">
              <h3 className="text-sm font-black text-white/40 uppercase tracking-widest mb-4">{t.costBreakdown}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <BreakdownItem label="Foundation" value={result.breakdown.foundation} config={config} />
                <BreakdownItem label="Walls" value={result.breakdown.walls} config={config} />
                <BreakdownItem label="Roof/Slab" value={result.breakdown.roof} config={config} />
                <BreakdownItem label="Doors & Windows" value={result.breakdown.doorsWindows} config={config} />
                <BreakdownItem label="Finishing" value={result.breakdown.finishing} config={config} />
                <BreakdownItem label="Plumbing & Electrical" value={result.breakdown.plumbingElectrical} config={config} />
              </div>
            </div>
          )}

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-2 card-glass p-8 relative overflow-hidden mt-2"
          >
            <div className="relative z-10">
              <p className="text-xs uppercase font-black text-slate-400 mb-2 tracking-widest">{t.cost}</p>
              <p className="text-5xl font-black text-white">৳ {(result.totalCost || 0).toLocaleString()}</p>
              <p className="mt-6 text-lg font-medium text-slate-300 leading-relaxed">{result.summary}</p>
            </div>
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function BreakdownItem({ label, value, config }: { label: string, value: number, config: any }) {
  return (
    <div className="glass p-4 border border-white/10 transition-all">
      <p className="text-[10px] uppercase font-bold text-white/40 mb-1">{label}</p>
      <p className="text-lg font-black text-white">{value ? `৳ ${value.toLocaleString()}` : 'N/A'}</p>
    </div>
  );
}

function StatCard({ label, value, config }: { label: string, value: string, config: any }) {
  return (
    <div className="glass p-6 transition-all border border-white/10">
      <p className="text-[10px] uppercase font-black text-white/40 mb-1 tracking-widest">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function MaterialsTab({ t, lang, config }: { t: any, lang: 'bn' | 'en', config: any }) {
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>('brick');
  const [activeType, setActiveType] = useState<string>('field');

  const categories = ['cement', 'sand', 'brick', 'stone', 'rod', 'concrete', 'soil', 'water', 'bitumen'];
  const types = ['field', 'lab'];

  const filteredTests = materialTests.filter(test => {
    const categoryMatch = test.material === activeCategory;
    const typeMatch = test.type === activeType;
    return categoryMatch && typeMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-black text-white">{t.materials}</h2>
        
        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all border flex items-center gap-2",
                activeCategory === cat 
                   ? "bg-white/20 text-white border-white/30 scale-105" 
                  : "glass text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
              )}
            >
              {t[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Type Filters */}
        <div className="flex gap-2">
          {types.map(type => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={cn(
                "flex-1 py-3 rounded-2xl font-bold text-sm transition-all border flex items-center justify-center gap-2",
                activeType === type 
                  ? "bg-white/20 text-white border-white/30 scale-[1.02]" 
                  : "glass text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
              )}
            >
              {type === 'field' ? '🔹 ' : '🔬 '}
              {t[type]}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {filteredTests.length > 0 ? (
          filteredTests.map((test) => (
            <motion.div 
              key={test.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ x: 8 }}
              onClick={() => setSelectedTest(test)}
              className="glass p-5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-all group border border-white/10"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shrink-0 glass border border-white/20">
                  {test.material === 'brick' ? '🧱' : 
                   test.material === 'sand' ? '⏳' :
                   test.material === 'cement' ? '🧪' :
                   test.material === 'stone' ? '🪨' :
                   test.material === 'rod' ? '🏗️' :
                   test.material === 'concrete' ? '🧱' :
                   test.material === 'soil' ? '🌱' :
                   test.material === 'water' ? '💧' :
                   test.material === 'bitumen' ? '🛣️' :
                   test.material.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                      {t[test.material]?.split(' ')[0] || test.material}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <div className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-white", test.type === 'field' ? 'bg-emerald-500/80 backdrop-blur-sm' : 'bg-blue-500/80 backdrop-blur-sm')}>
                      {t[test.type]}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-white leading-tight break-words">{test.name[lang]}</h3>
                </div>
              </div>
              <div className="p-2 rounded-xl glass hover:bg-white/10 transition-all shrink-0 ml-2 text-white border border-white/10">
                <ChevronRight size={20} />
              </div>
            </motion.div>
          ))
        ) : (
          <div className="glass p-12 text-center border border-white/10">
            <p className="text-white/40 font-bold">No tests found for this selection.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedTest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTest(null)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative card-glass w-full max-w-lg p-8 overflow-y-auto max-h-[90vh] no-scrollbar border border-white/20"
            >
              <div className={cn("absolute top-0 left-0 right-0 h-2", config.bg)} />
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", config.text)}>
                      {t[selectedTest.material] || selectedTest.material}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <div className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-white", selectedTest.type === 'field' ? 'bg-emerald-500/80 backdrop-blur-sm' : 'bg-blue-500/80 backdrop-blur-sm')}>
                      {t[selectedTest.type]}
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-white leading-tight">{selectedTest.name[lang]}</h3>
                </div>
                <button onClick={() => setSelectedTest(null)} className="p-2 rounded-full glass hover:bg-white/10 transition-all text-white border border-white/10">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Tools Section */}
                {selectedTest.tools && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1 h-4 rounded-full", config.bg)} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">{t.tools}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTest.tools[lang].map((tool: string, i: number) => (
                        <span key={i} className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl text-stone-700 dark:text-stone-300 font-bold text-xs">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Procedure Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1 h-4 rounded-full", config.bg)} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">{t.procedure}</p>
                  </div>
                  <div className="space-y-4">
                    {selectedTest.steps[lang].map((step: string, i: number) => (
                      <div key={i} className="flex gap-4 group">
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-transform group-hover:scale-110", config.bg, "text-white")}>
                          {i + 1}
                        </div>
                        <p className="text-stone-700 dark:text-stone-300 pt-1 font-medium leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formula Section */}
                {selectedTest.formula && (
                  <div className="bg-stone-900 dark:bg-black p-5 rounded-3xl border border-white/10 overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">{t.formula}</p>
                    <p className="text-white font-mono text-lg font-bold break-words">{selectedTest.formula[lang]}</p>
                  </div>
                )}

                {/* Conclusion Section */}
                {selectedTest.conclusion && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-3xl border border-emerald-100 dark:border-emerald-800/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="text-emerald-600 dark:text-emerald-400" size={16} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 dark:text-emerald-400/60">{t.conclusion}</p>
                    </div>
                    <p className="text-emerald-900 dark:text-emerald-100 font-bold leading-relaxed break-words">{selectedTest.conclusion[lang]}</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setSelectedTest(null)}
                className={cn("w-full mt-10 py-4 rounded-2xl text-white font-bold", config.bg)}
              >
                {lang === 'bn' ? 'ঠিক আছে' : 'Done'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuizTab({ t, lang, config, dept }: { t: any, lang: 'bn' | 'en', config: any, dept: string }) {
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(100);
  const [finished, setFinished] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const [selectedDept, setSelectedDept] = useState(dept);
  const quizConfig = DEPT_CONFIG[selectedDept as keyof typeof DEPT_CONFIG] || config;

  useEffect(() => {
    if (started && timeLeft > 0 && !finished) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      setFinished(true);
    }
  }, [started, timeLeft, finished]);

  const startQuiz = async () => {
    setIsLoading(true);
    const generatedQuestions = await generateQuizQuestions(selectedDept, lang);
    
    const finalQuestions = (generatedQuestions && generatedQuestions.length > 0) 
      ? generatedQuestions 
      : [...quizQuestions].sort(() => Math.random() - 0.5).slice(0, 10);

    setQuestions(finalQuestions);
    setUserAnswers(new Array(finalQuestions.length).fill(null));
    setStarted(true);
    setCurrentIdx(0);
    setScore(0);
    setTimeLeft(100);
    setFinished(false);
    setShowAnswers(false);
    setIsLoading(false);
  };

  const handleAnswer = (idx: number) => {
    if (finished) return;
    
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentIdx] = idx;
    setUserAnswers(newUserAnswers);

    // Calculate score incrementally
    if (idx === questions[currentIdx].answer) {
      setScore(prev => prev + 10);
    }

    // Auto advance after a short delay
    setTimeout(() => {
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(prev => prev + 1);
      } else {
        setFinished(true);
      }
    }, 300);
  };

  if (finished) {
    if (showAnswers) {
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center glass p-6 transition-colors duration-300">
            <h2 className="text-2xl font-black text-white">{lang === 'bn' ? "উত্তরপত্র" : "Answer Sheet"}</h2>
            <button 
              onClick={() => setShowAnswers(false)}
              className="p-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q, qIdx) => {
              const userPick = userAnswers[qIdx];
              const correctIdx = q.answer;
              const isCorrect = userPick === correctIdx;

              return (
                <div key={qIdx} className="glass p-6 space-y-4 transition-colors duration-300">
                  <div className="flex gap-3">
                    <span className={cn("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm", isCorrect ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                      {qIdx + 1}
                    </span>
                    <h4 className="font-bold text-white leading-tight">{q.question[lang]}</h4>
                  </div>

                  <div className="grid grid-cols-1 gap-2 ml-11">
                    {q.options[lang].map((opt: string, oIdx: number) => {
                      const isUserChoice = oIdx === userPick;
                      const isCorrectChoice = oIdx === correctIdx;
                      
                      let borderClass = "border-white/5";
                      let bgClass = "bg-white/5";
                      let textClass = "text-white/40";

                      if (isCorrectChoice) {
                        borderClass = "border-emerald-500/50";
                        bgClass = "bg-emerald-500/10";
                        textClass = "text-emerald-400 font-bold";
                      } else if (isUserChoice && !isCorrectChoice) {
                        borderClass = "border-red-500/50";
                        bgClass = "bg-red-500/10";
                        textClass = "text-red-400 font-bold";
                      }

                      return (
                        <div key={oIdx} className={cn("p-3 rounded-xl border text-sm flex justify-between items-center", borderClass, bgClass, textClass)}>
                          <span>{opt}</span>
                          {isCorrectChoice && <Trophy size={14} />}
                          {isUserChoice && !isCorrectChoice && <X size={14} />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="ml-11 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">{t.explanation}</p>
                    <p className="text-xs text-white/60 leading-relaxed">{q.explanation[lang]}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            onClick={() => setFinished(false)}
            className={cn("w-full py-5 rounded-2xl text-white font-black text-lg glass hover:bg-white/10 transition-all")}
          >
            {lang === 'bn' ? "ফিরে যান" : "Go Back"}
          </button>
        </div>
      );
    }

    return (
      <div className="card-glass p-10 text-center space-y-8 transition-colors duration-300">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, repeat: 2 }}
        >
          <Trophy size={80} className="mx-auto text-amber-400" />
        </motion.div>
        <h2 className="text-4xl font-black text-white">{t.quiz} Finished!</h2>
        <div className="p-8 rounded-3xl glass">
          <p className="text-white/40 font-black uppercase tracking-widest mb-2">{t.score}</p>
          <p className={cn("text-7xl font-black text-white")}>{score}</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={() => setShowAnswers(true)}
            className="w-full py-5 rounded-2xl glass text-white font-black text-lg hover:bg-white/10 transition-all"
          >
            {lang === 'bn' ? "উত্তর দেখুন" : "View Answers"}
          </button>
          <button 
            onClick={startQuiz} 
            disabled={isLoading}
            className={cn("w-full text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2", quizConfig.bg, isLoading && "opacity-70 cursor-not-allowed")}
          >
            {isLoading ? <Loader2 size={24} className="animate-spin" /> : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="card-glass p-10 text-center space-y-8 transition-colors duration-300">
        <div className={cn("w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto", quizConfig.bg, "text-white")}>
          <Trophy size={48} />
        </div>
        <div>
          <h2 className="text-3xl font-black mb-2 text-white">{t.quiz}</h2>
          <p className="text-white/40 font-medium">10 Questions • 100 Seconds</p>
        </div>
        
        <div className="space-y-3 text-left">
          <p className="text-sm font-bold text-white/40 uppercase tracking-wider">Select Department</p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(DEPT_CONFIG).map(([key, deptConfig]) => {
              const isSelected = selectedDept === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDept(key)}
                  className={cn(
                    "p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-2",
                    isSelected 
                      ? cn(deptConfig.border, deptConfig.bg, "text-white") 
                      : "bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:bg-white/10"
                  )}
                >
                  <div className={cn(!isSelected && deptConfig.text)}>
                    {deptConfig.icon}
                  </div>
                  <span className="font-bold text-sm">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button 
          onClick={startQuiz} 
          disabled={isLoading}
          className={cn("w-full text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2", quizConfig.bg, isLoading && "opacity-70 cursor-not-allowed")}
        >
          {isLoading ? <Loader2 size={24} className="animate-spin" /> : t.startQuiz}
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center glass p-5 transition-colors duration-300">
        <p className="font-black text-lg text-white">Q {currentIdx + 1}/{questions.length}</p>
        <div className="flex items-center gap-3 text-red-400 font-mono font-black text-lg">
          <Loader2 size={20} className={timeLeft < 20 ? "animate-spin" : ""} />
          {timeLeft}s
        </div>
      </div>

      <div className="glass p-8 overflow-hidden relative transition-colors duration-300">
        <h3 className="text-2xl font-black mb-10 leading-tight text-white">{currentQuestion.question[lang]}</h3>
        <div className="grid grid-cols-1 gap-4">
          {currentQuestion.options[lang].map((opt: string, i: number) => {
            const isSelected = i === userAnswers[currentIdx];
            
            return (
              <motion.button 
                key={i}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswer(i)}
                className={cn(
                  "w-full text-left p-5 rounded-2xl border transition-all font-bold text-lg",
                  isSelected 
                    ? "bg-white/20 text-white border-white/30"
                    : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10"
                )}
              >
                <div className="flex justify-between items-center">
                  <span>{opt}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}




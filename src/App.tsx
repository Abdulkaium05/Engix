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
  Trash2
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
  auth, 
  db, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  googleProvider,
  doc,
  getDoc,
  setDoc,
  handleFirestoreError,
  OperationType,
  User
} from './firebase';

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

import { serverTimestamp } from 'firebase/firestore';

type Tab = 'home' | 'survey' | 'land' | 'estimating' | 'materials' | 'quiz' | 'chat' | 'mech_design' | 'thermo' | 'fluids' | 'circuits' | 'power' | 'control' | 'software' | 'data' | 'network' | 'settings' | 'plot_planner' | 'slab_design' | 'unit_converter';
type Dept = 'civil' | 'mechanical' | 'electrical' | 'computer';

const DEPT_CONFIG = {
  civil: { color: 'emerald', icon: <HardHat />, logo: 'E', bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200', shadow: 'shadow-emerald-100' },
  mechanical: { color: 'orange', icon: <Settings />, logo: 'E', bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-200', shadow: 'shadow-orange-100' },
  electrical: { color: 'blue', icon: <Zap />, logo: 'E', bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200', shadow: 'shadow-blue-100' },
  computer: { color: 'purple', icon: <Code />, logo: 'E', bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', shadow: 'shadow-purple-100' },
};

const DEPT_TABS: Record<Dept, Tab[]> = {
  civil: ['home', 'chat', 'quiz', 'survey', 'land', 'plot_planner', 'estimating', 'materials', 'slab_design', 'unit_converter'],
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('engix_theme') as 'light' | 'dark') || 'light');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const t = translations[lang];
  const config = DEPT_CONFIG[dept];

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        await loadUserSettings(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserSettings = async (uid: string) => {
    setIsLoadingSettings(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.lang) setLang(data.lang as 'bn' | 'en');
        if (data.dept) setDept(data.dept as Dept);
        if (data.theme) setTheme(data.theme as 'light' | 'dark');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const saveUserSettings = async (newLang: 'bn' | 'en', newDept: Dept, newTheme: 'light' | 'dark' = theme) => {
    // Always save to localStorage for guest persistence
    localStorage.setItem('engix_lang', newLang);
    localStorage.setItem('engix_dept', newDept);
    localStorage.setItem('engix_theme', newTheme);

    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      const data: any = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lang: newLang,
        dept: newDept,
        theme: newTheme,
      };

      if (!userDoc.exists()) {
        data.createdAt = serverTimestamp();
      }

      await setDoc(userRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('home');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  useEffect(() => {
    if (!DEPT_TABS[dept].includes(activeTab as any) && activeTab !== 'settings') {
      setActiveTab('home');
    }
  }, [dept]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans transition-colors duration-300 flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 h-screen border-r border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 transition-colors duration-300 shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-stone-100 dark:border-stone-800/50">
          <motion.div 
            key={dept}
            initial={{ rotate: -90, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg", config.bg, config.shadow)}
          >
            {config.logo}
          </motion.div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 leading-none">Engix</h1>
            <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", config.text)}>{t[dept]}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar">
          <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest px-4 mb-2 mt-4">{t.navigation || 'Navigation'}</p>
          {DEPT_TABS[dept].map(tabId => (
            <MenuLink 
              key={tabId}
              active={activeTab === tabId} 
              onClick={() => setActiveTab(tabId)} 
              icon={TAB_ICONS[tabId]} 
              label={t[tabId]} 
              color={config.text} 
            />
          ))}
          
          <div className="pt-4 mt-4 border-t border-stone-100 dark:border-stone-800">
            <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest px-4 mb-2">{t.settings}</p>
            <MenuLink 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
              icon={TAB_ICONS.settings} 
              label={t.settings} 
              color={config.text} 
            />
          </div>
        </nav>

        <div className="p-4 border-t border-stone-100 dark:border-stone-800 space-y-4">
          {user ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800/50">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500"><UserIcon size={16} /></div>
              )}
              <div className="overflow-hidden flex-1">
                <p className="font-bold text-xs truncate text-stone-900 dark:text-stone-100">
                  {user.displayName}
                </p>
              </div>
              <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-red-500 transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className={cn("w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold shadow-lg transition-all", config.bg, config.shadow)}
            >
              <LogIn size={18} />
              <span>{t.login}</span>
            </button>
          )}
          
          <div className="flex items-center justify-between px-2">
            <button 
              onClick={() => {
                const newLang = lang === 'bn' ? 'en' : 'bn';
                setLang(newLang);
                if (user) saveUserSettings(newLang, dept, theme);
              }}
              className="text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors flex items-center gap-2"
            >
              <Languages size={14} />
              {lang === 'bn' ? 'English' : 'বাংলা'}
            </button>
            <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
              <button 
                onClick={() => { setTheme('light'); if (user) saveUserSettings(lang, dept, 'light'); }}
                className={cn("p-1.5 rounded-md transition-all", theme === 'light' ? "bg-white text-amber-500 shadow-sm" : "text-stone-400")}
              >
                <Sun size={14} />
              </button>
              <button 
                onClick={() => { setTheme('dark'); if (user) saveUserSettings(lang, dept, 'dark'); }}
                className={cn("p-1.5 rounded-md transition-all", theme === 'dark' ? "bg-stone-900 text-indigo-400 shadow-sm" : "text-stone-400")}
              >
                <Moon size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-50 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 py-3 flex items-center justify-between transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md", config.bg)}>
              {config.logo}
            </div>
            <h1 className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 leading-none">Engix</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleMenu}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Menu Overlay (Drawer) */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={toggleMenu}
                className="fixed inset-0 bg-stone-900/40 dark:bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
              />
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-stone-900 z-[70] shadow-2xl p-6 flex flex-col transition-colors duration-300 lg:hidden"
              >
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md", config.bg)}>
                      {config.logo}
                    </div>
                    <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Engix</h2>
                  </div>
                  <button onClick={toggleMenu} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    {DEPT_TABS[dept].map(tabId => (
                      <MenuLink 
                        key={tabId}
                        active={activeTab === tabId} 
                        onClick={() => { setActiveTab(tabId); toggleMenu(); }} 
                        icon={TAB_ICONS[tabId]} 
                        label={t[tabId]} 
                        color={config.text} 
                        isGrid
                      />
                    ))}
                    <MenuLink 
                      active={activeTab === 'settings'} 
                      onClick={() => { setActiveTab('settings'); toggleMenu(); }} 
                      icon={TAB_ICONS.settings} 
                      label={t.settings} 
                      color={config.text} 
                      isGrid
                    />
                  </div>

                  <div className="space-y-4 pt-6 border-t border-stone-100 dark:border-stone-800">
                    <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">{t.deptSelect}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <DeptButton active={dept === 'civil'} onClick={() => setDept('civil')} icon={<HardHat size={16} />} label={t.civil} color="emerald" />
                      <DeptButton active={dept === 'mechanical'} onClick={() => setDept('mechanical')} icon={<Settings size={16} />} label={t.mechanical} color="orange" />
                      <DeptButton active={dept === 'electrical'} onClick={() => setDept('electrical')} icon={<Zap size={16} />} label={t.electrical} color="blue" />
                      <DeptButton active={dept === 'computer'} onClick={() => setDept('computer')} icon={<Code size={16} />} label={t.computer} color="purple" />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-stone-100 dark:border-stone-800">
                  {user ? (
                    <button 
                      onClick={() => { handleLogout(); toggleMenu(); }}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <LogOut size={20} />
                      <span>{t.logout}</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => { handleLogin(); toggleMenu(); }}
                      className={cn("w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl text-white font-bold shadow-lg", config.bg)}
                    >
                      <LogIn size={20} />
                      <span>{t.login}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${dept}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'home' && <HomeTab t={t} lang={lang} dept={dept} config={config} setActiveTab={setActiveTab} />}
                {activeTab === 'survey' && <SurveyTab t={t} config={config} />}
                {activeTab === 'land' && <LandTab t={t} lang={lang} config={config} />}
                {activeTab === 'plot_planner' && <PlotPlannerTab t={t} config={config} />}
                {activeTab === 'slab_design' && <SlabDesignTab t={t} lang={lang} config={config} />}
                {activeTab === 'unit_converter' && <UnitConverterTab t={t} config={config} />}
                {activeTab === 'estimating' && <EstimatingTab t={t} config={config} />}
                {activeTab === 'materials' && <MaterialsTab t={t} lang={lang} config={config} />}
                {activeTab === 'quiz' && <QuizTab t={t} lang={lang} config={config} dept={dept} />}
                {activeTab === 'chat' && <ChatTab t={t} lang={lang} config={config} />}
                {activeTab === 'settings' && <SettingsTab t={t} lang={lang} setLang={setLang} dept={dept} setDept={setDept} theme={theme} setTheme={setTheme} user={user} handleLogin={handleLogin} handleLogout={handleLogout} saveUserSettings={saveUserSettings} config={config} />}
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
          ? cn("bg-stone-100 dark:bg-stone-800 shadow-sm", color) 
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
    emerald: active ? 'bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    orange: active ? 'bg-orange-600 text-white shadow-orange-200 dark:shadow-none' : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30',
    blue: active ? 'bg-blue-600 text-white shadow-blue-200 dark:shadow-none' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
    purple: active ? 'bg-purple-600 text-white shadow-purple-200 dark:shadow-none' : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30',
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold transition-all border shadow-sm",
        colors[color]
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// --- Tab Components ---

function SettingsTab({ t, lang, setLang, dept, setDept, theme, setTheme, user, handleLogin, handleLogout, saveUserSettings, config }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] border border-stone-200 dark:border-stone-800 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-4 mb-8">
          <div className={cn("p-4 rounded-2xl bg-stone-50 dark:bg-stone-950", config.text)}>
            <Settings size={28} />
          </div>
          <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100">{t.settings}</h2>
        </div>

        <div className="space-y-8">
          {user ? (
            <div className="flex items-center gap-4 p-6 bg-stone-50 dark:bg-stone-950 rounded-3xl border border-stone-100 dark:border-stone-800/50">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full border-4 border-white dark:border-stone-800 shadow-md" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500"><UserIcon size={32} /></div>
              )}
              <div>
                <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                  {user.displayName && user.displayName.length > 15 
                    ? `${user.displayName.substring(0, 15)}...` 
                    : user.displayName}
                </h3>
                <p className="text-stone-400 dark:text-stone-500 text-xs font-medium uppercase tracking-widest">{t.profile}</p>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-stone-50 dark:bg-stone-950 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 text-center space-y-4">
              <div className="w-12 h-12 bg-white dark:bg-stone-900 rounded-full flex items-center justify-center mx-auto text-stone-300 dark:text-stone-600">
                <UserIcon size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">{t.authRequired}</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Login to sync settings across devices.</p>
              </div>
              <button 
                onClick={handleLogin}
                className={cn("px-6 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg flex items-center gap-2 mx-auto", config.bg)}
              >
                <LogIn size={16} />
                {t.googleLogin}
              </button>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.language}</p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setLang('bn'); saveUserSettings('bn', dept, theme); }}
                className={cn("py-4 rounded-2xl font-bold border transition-all", lang === 'bn' ? cn("border-transparent text-white", config.bg) : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700")}
              >
                বাংলা
              </button>
              <button 
                onClick={() => { setLang('en'); saveUserSettings('en', dept, theme); }}
                className={cn("py-4 rounded-2xl font-bold border transition-all", lang === 'en' ? cn("border-transparent text-white", config.bg) : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700")}
              >
                English
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Theme</p>
            <div className="flex bg-stone-100 dark:bg-stone-800 p-1.5 rounded-2xl border border-stone-200 dark:border-stone-700">
              <button 
                onClick={() => { setTheme('light'); saveUserSettings(lang, dept, 'light'); }}
                className={cn(
                  "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2", 
                  theme === 'light' 
                    ? "bg-white text-amber-600 shadow-md ring-1 ring-stone-200" 
                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
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
                    ? "bg-stone-900 text-indigo-400 shadow-md ring-1 ring-stone-700" 
                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                )}
              >
                <Moon size={20} />
                Dark
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.deptSelect}</p>
            <div className="grid grid-cols-2 gap-3">
              <DeptButton active={dept === 'civil'} onClick={() => { setDept('civil'); saveUserSettings(lang, 'civil', theme); }} icon={<HardHat size={16} />} label={t.civil} color="emerald" />
              <DeptButton active={dept === 'mechanical'} onClick={() => { setDept('mechanical'); saveUserSettings(lang, 'mechanical', theme); }} icon={<Settings size={16} />} label={t.mechanical} color="orange" />
              <DeptButton active={dept === 'electrical'} onClick={() => { setDept('electrical'); saveUserSettings(lang, 'electrical', theme); }} icon={<Zap size={16} />} label={t.electrical} color="blue" />
              <DeptButton active={dept === 'computer'} onClick={() => { setDept('computer'); saveUserSettings(lang, 'computer', theme); }} icon={<Code size={16} />} label={t.computer} color="purple" />
            </div>
          </div>

          {user && (
            <button 
              onClick={handleLogout}
              className="w-full py-4 rounded-2xl border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              {t.logout}
            </button>
          )}
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
      <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] border border-stone-200 dark:border-stone-800 shadow-sm transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 text-stone-900 dark:text-stone-100">{t.plot_planner}</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <InputGroup label={t.length} value={length} onChange={setLength} />
          <InputGroup label={t.width} value={width} onChange={setWidth} />
          <InputGroup label={t.roadWidth} value={roadWidth} onChange={setRoadWidth} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-stone-900 dark:text-stone-100">
                <Info size={18} className={config.text} />
                {t.setback}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-stone-400 dark:text-stone-500">{t.front}</p><p className="font-bold text-stone-900 dark:text-stone-100">{setbacks.front} ft</p></div>
                <div><p className="text-stone-400 dark:text-stone-500">{t.back}</p><p className="font-bold text-stone-900 dark:text-stone-100">{setbacks.back} ft</p></div>
                <div><p className="text-stone-400 dark:text-stone-500">{t.side}</p><p className="font-bold text-stone-900 dark:text-stone-100">{setbacks.side} ft</p></div>
              </div>
            </div>

            <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-stone-900 dark:text-stone-100">
                <Calculator size={18} className={config.text} />
                {t.mgc}
              </h3>
              <p className="text-3xl font-black mb-1 text-stone-900 dark:text-stone-100">{mgc.toFixed(1)}%</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 font-medium uppercase tracking-widest">{t.buildableArea}: {buildableArea} sq ft</p>
            </div>

            <div className={cn("p-6 rounded-3xl border bg-stone-50 dark:bg-stone-800/50", config.border)}>
              <h3 className={cn("font-bold mb-2 flex items-center gap-2", config.text)}>
                <Zap size={18} />
                {t.advice}
              </h3>
              <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                {mgc > 65 
                  ? "আপনার গ্রাউন্ড কভারেজ অনেক বেশি। পর্যাপ্ত আলো-বাতাসের জন্য সেটব্যাক বাড়ানো উচিত।" 
                  : "আপনার প্ল্যানটি স্ট্যান্ডার্ড রুলস অনুযায়ী সঠিক আছে।"}
                {roadWidth < 12 && " রাস্তা সরু হওয়ার কারণে সামনের সেটব্যাক অন্তত ৫-৮ ফুট রাখা নিরাপদ।"}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-4">{t.plotMap}</p>
            <div className="relative border-2 border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 rounded-xl overflow-hidden" style={{ width: '200px', height: '250px' }}>
              {/* Plot Boundary */}
              <div className="absolute inset-0 border-4 border-stone-300 dark:border-stone-600 opacity-20 dark:opacity-40" />
              
              {/* Buildable Area */}
              <motion.div 
                layout
                className={cn("absolute border-2 border-dashed shadow-inner", config.border, config.bg.replace('600', '200').replace('500', '200'), "dark:bg-opacity-30")}
                style={{
                  top: `${(setbacks.front / length) * 100}%`,
                  bottom: `${(setbacks.back / length) * 100}%`,
                  left: `${(setbacks.side / width) * 100}%`,
                  right: `${(setbacks.side / width) * 100}%`,
                }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <span className={cn("text-[10px] font-black uppercase tracking-tighter", config.text)}>Building</span>
                </div>
              </motion.div>

              {/* Labels */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-stone-400 dark:text-stone-500">ROAD</div>
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
      <label className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{label}</label>
      <input 
        type="number" 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-stone-100 dark:focus:ring-stone-600 font-bold text-stone-900 dark:text-stone-100 transition-colors"
      />
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
      <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] border border-stone-200 dark:border-stone-800 shadow-sm transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-stone-900 dark:text-stone-100">
          <Layers className={config.text} size={28} />
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
          
          <div className="bg-white dark:bg-stone-950 p-6 rounded-3xl border-2 border-stone-200 dark:border-stone-800 flex flex-col items-center justify-between overflow-hidden relative min-h-[400px] shadow-inner">
            {/* Blueprint Background */}
            <div className="absolute inset-0 opacity-10 dark:opacity-[0.05] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:1rem_1rem]" />
            
            <div className="w-full flex justify-between items-center relative z-10 mb-4">
              <h3 className="font-bold flex items-center gap-2 bg-white dark:bg-stone-900 px-3 py-1.5 rounded-xl shadow-sm border border-stone-100 dark:border-stone-800 text-stone-900 dark:text-stone-100">
                <LayoutGrid size={18} className={config.text} />
                {lang === 'bn' ? 'ইন্টারেক্টিভ মডেল' : 'Interactive Model'}
              </h3>
              <div className="flex gap-2">
                <span className="text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-2 py-1 rounded-md uppercase tracking-wider">Plan</span>
                <span className="text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-2 py-1 rounded-md uppercase tracking-wider">Section</span>
              </div>
            </div>

            {/* Plan View */}
            <div className="relative w-full flex-1 flex items-center justify-center z-10 p-8">
              <motion.div
                layout
                className={cn("relative border-4 flex items-center justify-center shadow-2xl", config.border, config.bg.replace('600', '100').replace('500', '100'), "dark:bg-opacity-20")}
                animate={{
                  width: `${(lx / maxSpan) * 100}%`,
                  height: `${(ly / maxSpan) * 100}%`,
                }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
              >
                {/* Reinforcement Mesh */}
                <div className="absolute inset-2 opacity-30 dark:opacity-20 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:0.5rem_0.5rem]" />
                
                {/* Columns */}
                <div className="absolute -top-3 -left-3 w-6 h-6 bg-stone-800 dark:bg-stone-200 rounded-sm shadow-md" />
                <div className="absolute -top-3 -right-3 w-6 h-6 bg-stone-800 dark:bg-stone-200 rounded-sm shadow-md" />
                <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-stone-800 dark:bg-stone-200 rounded-sm shadow-md" />
                <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-stone-800 dark:bg-stone-200 rounded-sm shadow-md" />

                {/* Load Distribution Arrows */}
                {isTwoWay ? (
                  <div className="absolute inset-0 flex items-center justify-center opacity-70 text-stone-900 dark:text-stone-100 drop-shadow-md">
                    <ArrowRightLeft size={36} className="absolute rotate-90" />
                    <ArrowRightLeft size={36} className="absolute" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-70 text-stone-900 dark:text-stone-100 drop-shadow-md">
                    <ArrowRightLeft size={36} className={lx < ly ? "" : "rotate-90"} />
                  </div>
                )}

                {/* Dimension Ly */}
                <div className="absolute -right-10 top-0 bottom-0 flex items-center">
                  <div className="w-px h-full bg-stone-400 dark:bg-stone-600 relative">
                    <div className="absolute top-0 -left-1.5 w-3 h-px bg-stone-400 dark:bg-stone-600" />
                    <div className="absolute bottom-0 -left-1.5 w-3 h-px bg-stone-400 dark:bg-stone-600" />
                  </div>
                  <div className="absolute left-2 bg-white dark:bg-stone-800 px-1 py-0.5 rounded text-[10px] font-black text-stone-700 dark:text-stone-300 whitespace-nowrap rotate-90 origin-left translate-y-1/2">
                    Ly = {ly}'
                  </div>
                </div>

                {/* Dimension Lx */}
                <div className="absolute -bottom-10 left-0 right-0 flex justify-center">
                  <div className="h-px w-full bg-stone-400 dark:bg-stone-600 relative">
                    <div className="absolute left-0 -top-1.5 h-3 w-px bg-stone-400 dark:bg-stone-600" />
                    <div className="absolute right-0 -top-1.5 h-3 w-px bg-stone-400 dark:bg-stone-600" />
                  </div>
                  <div className="absolute top-2 bg-white dark:bg-stone-800 px-1.5 py-0.5 rounded text-[10px] font-black text-stone-700 dark:text-stone-300 whitespace-nowrap">
                    Lx = {lx}'
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Cross Section View */}
            <div className="w-full mt-8 z-10 bg-white/80 dark:bg-stone-900/80 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm backdrop-blur-md">
              <div className="relative w-full flex items-end justify-center h-24 border-b-2 border-stone-300 dark:border-stone-700 pb-2 px-12">
                
                {/* Supports */}
                <div className="w-6 h-16 bg-stone-200 dark:bg-stone-700 border-2 border-stone-400 dark:border-stone-600 border-b-0 absolute left-8 bottom-2 rounded-t-sm" />
                <div className="w-6 h-16 bg-stone-200 dark:bg-stone-700 border-2 border-stone-400 dark:border-stone-600 border-b-0 absolute right-8 bottom-2 rounded-t-sm" />

                <motion.div
                  layout
                  className={cn("w-full border-2 shadow-md relative overflow-hidden z-10", config.border, config.bg.replace('600', '300').replace('500', '300'), "dark:bg-opacity-40")}
                  animate={{
                    height: `${Math.max(16, Math.min(72, (thickness / 12) * 72))}px`
                  }}
                  transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                >
                  {/* Concrete Texture */}
                  <div className="absolute inset-0 opacity-20 dark:opacity-40 bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:4px_4px]" />
                  {/* Rebar */}
                  <div className="absolute bottom-1.5 left-0 right-0 h-1.5 border-b-2 border-dashed border-stone-700 dark:border-stone-300 opacity-60" />
                  <div className="absolute top-1.5 left-0 right-0 h-1.5 border-t-2 border-dashed border-stone-700 dark:border-stone-300 opacity-30" />
                </motion.div>
                
                {/* Thickness Dimension */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                  <div className="h-full w-px bg-stone-400 dark:bg-stone-600 relative">
                    <div className="absolute top-0 -left-1.5 w-3 h-px bg-stone-400 dark:bg-stone-600" />
                    <div className="absolute bottom-0 -left-1.5 w-3 h-px bg-stone-400 dark:bg-stone-600" />
                  </div>
                  <div className="bg-white dark:bg-stone-800 px-1 rounded text-[10px] font-black text-stone-700 dark:text-stone-300 ml-1 shadow-sm border border-stone-100 dark:border-stone-700">
                    {thickness}"
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-stone-900 dark:text-stone-100">
                <Info size={18} className={config.text} />
                {t.slabType}
              </h3>
              <p className="text-3xl font-black mb-1 text-stone-900 dark:text-stone-100">
                {isTwoWay ? t.twoWaySlab : t.oneWaySlab}
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 font-medium uppercase tracking-widest">
                Ratio = {(maxSpan / minSpan).toFixed(2)}
              </p>
            </div>

            <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-stone-900 dark:text-stone-100">
                <Calculator size={18} className={config.text} />
                {t.loadAnalysis}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500 dark:text-stone-400">{t.selfWeight}:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{selfWeight.toFixed(1)} psf</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 dark:text-stone-400">{t.floorFinish}:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{floorFinish.toFixed(1)} psf</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 dark:text-stone-400">{t.partitionWall}:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{partitionWall.toFixed(1)} psf</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-stone-200 dark:border-stone-700">
                  <span className="text-stone-500 dark:text-stone-400 font-bold">{t.totalDeadLoad}:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{totalDeadLoad.toFixed(1)} psf</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 dark:text-stone-400 font-bold">{t.liveLoad}:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{liveLoad.toFixed(1)} psf</span>
                </div>
                <div className="pt-3 border-t border-stone-200 dark:border-stone-700 flex justify-between text-base">
                  <span className="font-black text-stone-900 dark:text-stone-100">{t.factoredLoad}:</span>
                  <span className={cn("font-black", config.text)}>{factoredLoad.toFixed(1)} psf</span>
                </div>
                <div className="text-[10px] text-stone-400 dark:text-stone-500 text-right mt-2">
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
    <div className="bg-white p-12 rounded-[3rem] border border-stone-200 text-center space-y-8 shadow-xl">
      <div className={cn("w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl", config.bg, "text-white")}>
        {TAB_ICONS[tabId]}
      </div>
      <div>
        <h2 className="text-3xl font-black mb-2">{t[tabId]}</h2>
        <p className="text-stone-500 font-medium text-lg">{t.comingSoon}</p>
      </div>
      <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 text-stone-400 text-sm">
        Stay tuned for the next major update!
      </div>
    </div>
  );
}

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
      <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] border border-stone-200 dark:border-stone-800 shadow-sm transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-stone-900 dark:text-stone-100">
          <ArrowRightLeft className={config.text} size={28} />
          {t.unit_converter}
        </h2>

        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['length', 'area', 'weight', 'volume'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn("px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all", category === cat ? cn("text-white", config.bg) : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700")}
              >
                {t[cat] || cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.from}</label>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-stone-100 dark:focus:ring-stone-600 font-bold text-lg text-stone-900 dark:text-stone-100 transition-colors"
              />
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-3 focus:outline-none font-medium text-stone-600 dark:text-stone-300 transition-colors"
              >
                {Object.keys(rates).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <button onClick={handleSwap} className={cn("p-4 rounded-full text-white shadow-md hover:scale-110 transition-transform mx-auto mt-6 md:mt-0", config.bg)}>
              <ArrowRightLeft size={20} />
            </button>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.to}</label>
              <div className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-3 font-black text-lg text-stone-900 dark:text-stone-100 overflow-hidden text-ellipsis transition-colors">
                {(result || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-3 focus:outline-none font-medium text-stone-600 dark:text-stone-300 transition-colors"
              >
                {Object.keys(rates).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
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
        className={cn("text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden", config.bg)}
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
              className="px-6 py-3 bg-white text-stone-900 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform flex items-center gap-2"
            >
              <MessageSquare size={20} className={config.text} />
              {lang === 'bn' ? 'এআই চ্যাট শুরু করুন' : 'Start AI Chat'}
            </button>
            <button 
              onClick={() => setActiveTab('quiz')}
              className="px-6 py-3 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-2xl font-bold hover:bg-white/30 transition-colors flex items-center gap-2"
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
        className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-[2rem] border border-amber-200 dark:border-amber-800/30 flex items-start gap-4 shadow-sm"
      >
        <div className="p-3 bg-amber-100 dark:bg-amber-800/50 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
          <Zap size={24} />
        </div>
        <div>
          <h4 className="font-black text-amber-900 dark:text-amber-100 mb-1">{lang === 'bn' ? 'আজকের টিপস' : 'Daily Tip'}</h4>
          <p className="text-amber-800 dark:text-amber-200/80 font-medium leading-relaxed">{dailyTip[lang]}</p>
        </div>
      </motion.div>

      {/* Quick Actions Grid */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-stone-800 dark:text-stone-100 px-2 flex items-center gap-2">
          <LayoutGrid size={20} className={config.text} />
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
              className="bg-white dark:bg-stone-900 p-6 rounded-[2rem] border border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-xl dark:hover:shadow-stone-900/50 transition-all flex flex-col items-center justify-center gap-4 group"
            >
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", config.bg, "text-white shadow-md")}>
                {TAB_ICONS[tab]}
              </div>
              <span className="font-bold text-stone-700 dark:text-stone-300 text-sm text-center">{t[tab]}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Q&A Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-2xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-3">
            <div className={cn("w-2 h-8 rounded-full", config.bg)} />
            {t.qna}
          </h3>
          <button 
            onClick={refreshTopics}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors flex items-center gap-2 text-sm font-bold"
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
              className="group bg-white dark:bg-stone-900 p-6 rounded-[2rem] border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 hover:shadow-2xl dark:hover:shadow-stone-900/50 transition-all cursor-pointer flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110", config.bg, "text-white shadow-md")}>
                  <MessageSquare size={20} />
                </div>
                <div className="w-8 h-8 rounded-full bg-stone-50 dark:bg-stone-800 flex items-center justify-center text-stone-300 dark:text-stone-600 group-hover:text-stone-600 dark:group-hover:text-stone-300 group-hover:bg-stone-100 dark:group-hover:bg-stone-700 transition-all">
                  <ChevronRight size={16} />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg text-stone-900 dark:text-stone-100 group-hover:text-stone-700 dark:group-hover:text-stone-300 transition-colors mb-2 line-clamp-2">{topic.title[lang]}</h4>
                <p className="text-stone-500 dark:text-stone-400 text-sm line-clamp-2 leading-relaxed">{topic.desc[lang]}</p>
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
              className="absolute inset-0 bg-stone-900/80 dark:bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative bg-white dark:bg-stone-900 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl overflow-hidden transition-colors duration-300"
            >
              <div className={cn("absolute top-0 left-0 right-0 h-3", config.bg)} />
              
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md", config.bg)}>
                    <Info size={24} />
                  </div>
                  <h3 className="text-3xl font-black text-stone-900 dark:text-stone-100">{selectedTopic.title[lang]}</h3>
                </div>
                <button onClick={() => setSelectedTopic(null)} className="p-3 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors">
                  <X size={28} />
                </button>
              </div>

              <div className="bg-stone-50 dark:bg-stone-950 p-8 rounded-3xl border border-stone-100 dark:border-stone-800/50 mb-8">
                <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-xl font-medium italic">
                  "{selectedTopic.content[lang]}"
                </p>
              </div>

              <button 
                onClick={() => setSelectedTopic(null)}
                className={cn("w-full py-5 rounded-2xl text-white font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all", config.bg)}
              >
                Close
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
      <div className="bg-white dark:bg-stone-900 p-8 rounded-[3rem] border border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden relative transition-colors duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={cn("p-4 rounded-2xl bg-stone-50 dark:bg-stone-800", config.text)}>
              <Navigation size={28} />
            </div>
            <h2 className="text-3xl font-black text-stone-900 dark:text-stone-100">{t.survey}</h2>
          </div>
          <div className={cn("px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest", isSurveying ? "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 animate-pulse" : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500")}>
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
            <div className="relative aspect-square max-w-[280px] mx-auto bg-stone-900 rounded-full p-6 shadow-2xl border-8 border-stone-800 overflow-hidden">
              {/* Fixed Lubber Line (Needle) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-10 bg-red-500 z-20 rounded-b-full shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
              
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
                  <p className="text-4xl font-black text-white font-mono drop-shadow-lg">{Math.round(heading)}°</p>
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{t.compass}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Map View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest flex items-center gap-2">
                <MapIcon size={14} />
                {t.mapView}
              </h3>
            </div>
            <div className="aspect-square bg-stone-100 dark:bg-stone-800 rounded-[2rem] border border-stone-200 dark:border-stone-700 overflow-hidden relative shadow-inner">
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
                  {/* Overlay to prevent interaction if needed, or just leave it */}
                  <div className="absolute bottom-2 right-2 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm px-2 py-1 rounded-lg text-[8px] font-bold text-stone-500 pointer-events-none uppercase tracking-tighter">
                    Google Maps View
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-stone-300 dark:text-stone-600 p-8 text-center">
                  <MapIcon size={48} className={cn(isSurveying ? "animate-pulse" : "")} />
                  <p className="text-xs font-bold uppercase tracking-widest">
                    {error ? error : (isSurveying ? "Locating your position..." : "Start Survey to see Map")}
                  </p>
                  {error && (
                    <button 
                      onClick={() => setIsSurveying(false)}
                      className="text-[10px] text-red-500 dark:text-red-400 underline font-bold"
                    >
                      Reset & Try Again
                    </button>
                  )}
                </div>
              )}
              {coords && (
                <div className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-stone-900/80 backdrop-blur rounded-xl shadow-lg border border-white/20 dark:border-stone-700/50">
                  <Target size={20} className={config.text} />
                </div>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={() => isSurveying ? setIsSurveying(false) : requestOrientationPermission()}
          className={cn(
            "w-full mt-8 py-6 rounded-[2rem] font-black text-xl transition-all shadow-2xl hover:scale-[1.01] active:scale-[0.99]",
            isSurveying 
              ? "bg-red-500 text-white shadow-red-100 dark:shadow-red-900/20" 
              : cn("text-white", config.bg, config.shadow)
          )}
        >
          {isSurveying ? t.stopSurvey : t.startSurvey}
        </button>
      </div>
    </div>
  );
}

function SurveyCard({ label, value, config }: { label: string, value: string, config: any }) {
  return (
    <div className="bg-stone-50 dark:bg-stone-800 p-4 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden">
      <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-black tracking-widest mb-1 truncate">{label}</p>
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
  const getNormalizedPoints = () => {
    if (points.length === 0) return "";
    const lats = points.map(p => p[0]);
    const lngs = points.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;
    
    // Maintain aspect ratio
    const scale = 80 / Math.max(latRange, lngRange);
    
    return points.map(p => {
      const x = 10 + (p[1] - minLng) * scale;
      const y = 90 - (p[0] - minLat) * scale;
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-white dark:bg-stone-900 p-4 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-stone-200 dark:border-stone-800 shadow-xl transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={cn("p-3 sm:p-4 rounded-2xl bg-stone-50 dark:bg-stone-800", config.text)}>
              <MapIcon size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-stone-900 dark:text-stone-100">{t.land}</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-1 sm:gap-2 bg-stone-50 dark:bg-stone-800 p-1 rounded-2xl border border-stone-100 dark:border-stone-700 w-full md:w-auto">
            <button 
              onClick={() => setMapType('roadmap')}
              className={cn("px-2 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap w-full", mapType === 'roadmap' ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-white" : "text-stone-400")}
            >
              Roadmap
            </button>
            <button 
              onClick={() => setMapType('satellite')}
              className={cn("px-2 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap w-full", mapType === 'satellite' ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-white" : "text-stone-400")}
            >
              Satellite
            </button>
            <button 
              onClick={() => setMapType('hybrid')}
              className={cn("px-2 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap w-full", mapType === 'hybrid' ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-white" : "text-stone-400")}
            >
              Hybrid
            </button>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={undoLastPoint}
              disabled={points.length === 0}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all disabled:opacity-50"
            >
              {lang === 'bn' ? "পয়েন্ট মুছুন" : "Undo"}
            </button>
            <button 
              onClick={clearPoints}
              disabled={points.length === 0}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50"
            >
              {lang === 'bn' ? "সব মুছুন" : "Clear All"}
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-6 p-1 bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 w-full sm:w-fit">
          <button 
            onClick={() => setCalcMode('general')}
            className={cn("px-2 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all w-full", calcMode === 'general' ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-white" : "text-stone-400")}
          >
            {lang === 'bn' ? "সাধারণ" : "General"}
          </button>
          <button 
            onClick={() => setCalcMode('station')}
            className={cn("px-2 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all w-full", calcMode === 'station' ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-white" : "text-stone-400")}
          >
            {lang === 'bn' ? "স্টেশন (GPS)" : "Station (GPS)"}
          </button>
          <button 
            onClick={() => setCalcMode('coordinates')}
            className={cn("px-2 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all w-full", calcMode === 'coordinates' ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-white" : "text-stone-400")}
          >
            {lang === 'bn' ? "স্থানাঙ্ক" : "Coordinates"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Map View */}
          <div className="lg:col-span-2 space-y-4">
            {calcMode === 'coordinates' && (
              <div className="p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 space-y-4">
                <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                  {lang === 'bn' 
                    ? `${points.length + 1} নং বিন্দুর অক্ষাংশ ও দ্রাঘিমাংশ দিন` 
                    : `Enter coordinates for Point ${points.length + 1}`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-stone-400 uppercase ml-1">{lang === 'bn' ? "অক্ষাংশ (Latitude)" : "Latitude"}</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="e.g. 23.8103"
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-stone-400 uppercase ml-1">{lang === 'bn' ? "দ্রাঘিমাংশ (Longitude)" : "Longitude"}</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="e.g. 90.4125"
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700"
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
              <div className="p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                    {lang === 'bn' ? "আপনার বর্তমান অবস্থান ব্যবহার করুন" : "Use your current location"}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-stone-400 uppercase">GPS ACTIVE</span>
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
                <p className="text-[9px] text-stone-400 text-center italic">
                  {lang === 'bn' 
                    ? "* জমির এক কোণায় দাঁড়িয়ে বাটনে ক্লিক করুন, তারপর অন্য কোণায় গিয়ে আবার ক্লিক করুন।" 
                    : "* Stand at one corner of the land and click, then move to the next corner and click again."}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] sm:text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest leading-tight">{t.clickOnMap}</p>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-bold text-stone-400 uppercase whitespace-nowrap">{points.length} POINTS</span>
              </div>
            </div>
            <div className="aspect-video lg:aspect-square bg-stone-100 dark:bg-stone-800 rounded-[1.5rem] sm:rounded-[2.5rem] border border-stone-200 dark:border-stone-700 overflow-hidden relative shadow-inner z-0">
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
              <p className="text-[10px] sm:text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-3 sm:mb-4">2D Model View</p>
              <div className="aspect-square bg-stone-50 dark:bg-stone-950 rounded-[1.5rem] sm:rounded-[2rem] border border-stone-200 dark:border-stone-800 relative flex items-center justify-center overflow-hidden shadow-inner">
                {points.length > 2 ? (
                  <svg viewBox="0 0 100 100" className="w-full h-full p-4">
                    <polygon 
                      points={getNormalizedPoints()} 
                      className={cn("fill-current opacity-20 stroke-[2px] stroke-current", config.text)}
                    />
                    {getNormalizedPoints().split(" ").map((p, i) => {
                      const [x, y] = p.split(",");
                      return (
                        <circle key={i} cx={x} cy={y} r="1.5" className={cn("fill-current", config.text)} />
                      );
                    })}
                  </svg>
                ) : (
                  <div className="text-center p-6 sm:p-8">
                    <Compass size={40} className="sm:w-12 sm:h-12 mx-auto text-stone-200 dark:text-stone-800 mb-4 animate-pulse" />
                    <p className="text-[9px] sm:text-[10px] font-black text-stone-300 dark:text-stone-700 uppercase tracking-widest">Select at least 3 points on map</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] sm:text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.aiSuggestion}</p>
              <div className="relative">
                <input 
                  type="text"
                  placeholder={lang === 'bn' ? "AI কে কমান্ড দিন..." : "Command AI..."}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl py-3 sm:py-4 pl-4 sm:pl-6 pr-12 sm:pr-14 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-all"
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
                    className="p-4 sm:p-6 bg-stone-50 dark:bg-stone-800 rounded-2xl sm:rounded-3xl border border-stone-100 dark:border-stone-700 max-h-[250px] overflow-y-auto no-scrollbar"
                  >
                    <div className="prose prose-xs sm:prose-sm dark:prose-invert prose-stone">
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
    <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700 group hover:border-stone-300 dark:hover:border-stone-600 transition-all">
      <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-black tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-mono font-black", config.text)}>{value}</span>
        <span className="text-[10px] font-bold text-stone-400 uppercase">{unit}</span>
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
      <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] border border-stone-200 dark:border-stone-800 transition-colors duration-300">
        <h2 className="text-2xl font-black mb-6 text-stone-900 dark:text-stone-100">{t.estimating}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.floors}</label>
            <input 
              type="number" 
              min="1"
              value={floors}
              onChange={(e) => setFloors(Number(e.target.value))}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-600 font-bold text-stone-900 dark:text-stone-100 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.areaSqft} {t.optional}</label>
            <input 
              type="number" 
              placeholder="e.g. 1200"
              value={areaSqft}
              onChange={(e) => setAreaSqft(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-600 font-bold text-stone-900 dark:text-stone-100 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.foundationType}</label>
            <select 
              value={foundation}
              onChange={(e) => setFoundation(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-600 font-bold text-stone-900 dark:text-stone-100 transition-colors"
            >
              <option value="Spread Footing">Spread Footing</option>
              <option value="Mat/Raft Foundation">Mat/Raft Foundation</option>
              <option value="Pile Foundation">Pile Foundation</option>
              <option value="Strip Foundation">Strip Foundation</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t.buildingType}</label>
            <select 
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-600 font-bold text-stone-900 dark:text-stone-100 transition-colors"
            >
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
              <option value="Industrial">Industrial</option>
            </select>
          </div>
        </div>

        <div className="relative aspect-video bg-stone-50 dark:bg-stone-800 rounded-3xl border-2 border-dashed border-stone-200 dark:border-stone-700 mb-6 flex items-center justify-center overflow-hidden group transition-colors">
          {image ? (
            <>
              <img src={image} className="w-full h-full object-cover" alt="Plan" />
              <button onClick={() => setImage(null)} className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-stone-900/80 backdrop-blur rounded-full shadow-lg hover:bg-white dark:hover:bg-stone-800 text-stone-900 dark:text-stone-100 transition-all">
                <X size={20} />
              </button>
            </>
          ) : (
            <label className="cursor-pointer flex flex-col items-center gap-3 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">
              <div className="p-5 rounded-full bg-stone-100 dark:bg-stone-700 group-hover:bg-stone-200 dark:group-hover:bg-stone-600 transition-all">
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
          className={cn("w-full text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl", config.bg, config.shadow)}
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
            <div className="col-span-2 bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm mt-2 transition-colors duration-300">
              <h3 className="text-sm font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-4">{t.costBreakdown}</h3>
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
            className={cn("col-span-2 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden mt-2", config.bg)}
          >
            <div className="relative z-10">
              <p className="text-xs uppercase font-black opacity-60 mb-2 tracking-widest">{t.cost}</p>
              <p className="text-5xl font-black">৳ {(result.totalCost || 0).toLocaleString()}</p>
              <p className="mt-6 text-lg font-medium opacity-90 leading-relaxed">{result.summary}</p>
            </div>
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function BreakdownItem({ label, value, config }: { label: string, value: number, config: any }) {
  return (
    <div className="bg-stone-50 dark:bg-stone-800 p-4 rounded-2xl border border-stone-100 dark:border-stone-700 transition-colors duration-300">
      <p className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mb-1">{label}</p>
      <p className={cn("text-lg font-black", config.text)}>{value ? `৳ ${value.toLocaleString()}` : 'N/A'}</p>
    </div>
  );
}

function StatCard({ label, value, config }: { label: string, value: string, config: any }) {
  return (
    <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 shadow-sm transition-colors duration-300">
      <p className="text-[10px] uppercase font-black text-stone-400 dark:text-stone-500 mb-1 tracking-widest">{label}</p>
      <p className={cn("text-2xl font-black", config.text)}>{value}</p>
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
        <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100">{t.materials}</h2>
        
        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all shadow-sm border flex items-center gap-2",
                activeCategory === cat 
                   ? cn("text-white border-transparent", config.bg) 
                  : "bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700"
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
                  ? cn("text-white border-transparent", config.bg) 
                  : "bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700"
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
              className="bg-white dark:bg-stone-900 p-5 rounded-[2rem] border border-stone-200 dark:border-stone-800 flex items-center justify-between cursor-pointer hover:border-stone-300 dark:hover:border-stone-700 transition-all group shadow-sm"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg shrink-0", config.bg)}>
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
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", config.text)}>
                      {t[test.material]?.split(' ')[0] || test.material}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-stone-300 dark:bg-stone-700" />
                    <div className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-white shadow-sm", test.type === 'field' ? 'bg-emerald-500' : 'bg-blue-500')}>
                      {t[test.type]}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-stone-800 dark:text-stone-200 leading-tight break-words">{test.name[lang]}</h3>
                </div>
              </div>
              <div className={cn("p-2 rounded-xl bg-stone-50 dark:bg-stone-800 group-hover:bg-stone-100 dark:group-hover:bg-stone-700 transition-colors shrink-0 ml-2", config.text)}>
                <ChevronRight size={20} />
              </div>
            </motion.div>
          ))
        ) : (
          <div className="bg-white dark:bg-stone-900 p-12 rounded-[2.5rem] border border-stone-200 dark:border-stone-800 text-center">
            <p className="text-stone-400 dark:text-stone-500 font-bold">No tests found for this selection.</p>
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
              className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar"
            >
              <div className={cn("absolute top-0 left-0 right-0 h-2", config.bg)} />
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", config.text)}>
                      {t[selectedTest.material] || selectedTest.material}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-stone-300 dark:bg-stone-700" />
                    <div className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-white shadow-sm", selectedTest.type === 'field' ? 'bg-emerald-500' : 'bg-blue-500')}>
                      {t[selectedTest.type]}
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-stone-900 dark:text-stone-100 leading-tight">{selectedTest.name[lang]}</h3>
                </div>
                <button onClick={() => setSelectedTest(null)} className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-500 dark:text-stone-400">
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
                        <span key={i} className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl text-stone-700 dark:text-stone-300 font-bold text-xs shadow-sm">
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
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm transition-transform group-hover:scale-110", config.bg, "text-white")}>
                          {i + 1}
                        </div>
                        <p className="text-stone-700 dark:text-stone-300 pt-1 font-medium leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formula Section */}
                {selectedTest.formula && (
                  <div className="bg-stone-900 dark:bg-black p-5 rounded-3xl shadow-xl border border-white/10 overflow-hidden">
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
                className={cn("w-full mt-10 py-4 rounded-2xl text-white font-bold shadow-lg", config.bg)}
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
          <div className="flex justify-between items-center bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm transition-colors duration-300">
            <h2 className="text-2xl font-black text-stone-900 dark:text-stone-100">{lang === 'bn' ? "উত্তরপত্র" : "Answer Sheet"}</h2>
            <button 
              onClick={() => setShowAnswers(false)}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
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
                <div key={qIdx} className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm transition-colors duration-300">
                  <div className="flex gap-3">
                    <span className={cn("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm", isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>
                      {qIdx + 1}
                    </span>
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 leading-tight">{q.question[lang]}</h4>
                  </div>

                  <div className="grid grid-cols-1 gap-2 ml-11">
                    {q.options[lang].map((opt: string, oIdx: number) => {
                      const isUserChoice = oIdx === userPick;
                      const isCorrectChoice = oIdx === correctIdx;
                      
                      let borderClass = "border-stone-100 dark:border-stone-800";
                      let bgClass = "bg-stone-50/50 dark:bg-stone-800/30";
                      let textClass = "text-stone-600 dark:text-stone-400";

                      if (isCorrectChoice) {
                        borderClass = "border-emerald-500 dark:border-emerald-600";
                        bgClass = "bg-emerald-50 dark:bg-emerald-900/20";
                        textClass = "text-emerald-700 dark:text-emerald-400 font-bold";
                      } else if (isUserChoice && !isCorrectChoice) {
                        borderClass = "border-red-500 dark:border-red-600";
                        bgClass = "bg-red-50 dark:bg-red-900/20";
                        textClass = "text-red-700 dark:text-red-400 font-bold";
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

                  <div className="ml-11 p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">{t.explanation}</p>
                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{q.explanation[lang]}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            onClick={() => setFinished(false)}
            className={cn("w-full py-5 rounded-2xl text-white font-black text-lg shadow-xl", quizConfig.bg)}
          >
            {lang === 'bn' ? "ফিরে যান" : "Go Back"}
          </button>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-200 dark:border-stone-800 text-center space-y-8 shadow-xl transition-colors duration-300">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, repeat: 2 }}
        >
          <Trophy size={80} className="mx-auto text-amber-500" />
        </motion.div>
        <h2 className="text-4xl font-black text-stone-900 dark:text-stone-100">{t.quiz} Finished!</h2>
        <div className="p-8 rounded-3xl bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700">
          <p className="text-stone-400 dark:text-stone-500 font-black uppercase tracking-widest mb-2">{t.score}</p>
          <p className={cn("text-7xl font-black", quizConfig.text)}>{score}</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={() => setShowAnswers(true)}
            className="w-full py-5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-black text-lg border border-stone-200 dark:border-stone-700 transition-all hover:bg-stone-200 dark:hover:bg-stone-700"
          >
            {lang === 'bn' ? "উত্তর দেখুন" : "View Answers"}
          </button>
          <button 
            onClick={startQuiz} 
            disabled={isLoading}
            className={cn("w-full text-white py-5 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2", quizConfig.bg, quizConfig.shadow, isLoading && "opacity-70 cursor-not-allowed")}
          >
            {isLoading ? <Loader2 size={24} className="animate-spin" /> : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-200 dark:border-stone-800 text-center space-y-8 shadow-xl transition-colors duration-300">
        <div className={cn("w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl", quizConfig.bg, "text-white")}>
          <Trophy size={48} />
        </div>
        <div>
          <h2 className="text-3xl font-black mb-2 text-stone-900 dark:text-stone-100">{t.quiz}</h2>
          <p className="text-stone-500 dark:text-stone-400 font-medium">10 Questions • 100 Seconds</p>
        </div>
        
        <div className="space-y-3 text-left">
          <p className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Select Department</p>
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
                      ? cn(deptConfig.border, deptConfig.bg, "text-white shadow-md") 
                      : "border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-400 hover:border-stone-200 dark:hover:border-stone-700"
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
          className={cn("w-full text-white py-5 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2", quizConfig.bg, quizConfig.shadow, isLoading && "opacity-70 cursor-not-allowed")}
        >
          {isLoading ? <Loader2 size={24} className="animate-spin" /> : t.startQuiz}
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm transition-colors duration-300">
        <p className={cn("font-black text-lg", quizConfig.text)}>Q {currentIdx + 1}/{questions.length}</p>
        <div className="flex items-center gap-3 text-red-500 dark:text-red-400 font-mono font-black text-lg">
          <Loader2 size={20} className={timeLeft < 20 ? "animate-spin" : ""} />
          {timeLeft}s
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] border border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden relative transition-colors duration-300">
        <h3 className="text-2xl font-black mb-10 leading-tight text-stone-900 dark:text-stone-100">{currentQuestion.question[lang]}</h3>
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
                    ? cn(quizConfig.bg, "text-white border-transparent shadow-lg")
                    : "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-white dark:hover:bg-stone-700"
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

function ChatTab({ t, lang, config }: { t: any, lang: 'bn' | 'en', config: any }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string, image?: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseLength, setResponseLength] = useState<'short' | 'long'>('short');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role === 'user' ? 'user' as const : 'model' as const, parts: [{ text: m.content }] }));
      const response = await getChatResponse(userMsg, history, responseLength);
      
      let image;
      if (userMsg.toLowerCase().includes('example') || userMsg.toLowerCase().includes('উদাহরণ')) {
        image = await generateExampleImage(userMsg);
      }

      setMessages(prev => [...prev, { role: 'ai', content: response || "", image: image || undefined }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 no-scrollbar pb-4">
        {messages.length === 0 && (
          <div className="text-center py-20 text-stone-300 dark:text-stone-600">
            <div className="w-24 h-24 rounded-[2rem] bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={48} className="opacity-20" />
            </div>
            <p className="font-black text-xl">Ask Engix AI anything</p>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}
          >
            <div className={cn(
              "max-w-[85%] p-5 rounded-3xl text-lg leading-relaxed shadow-sm",
              m.role === 'user' ? cn("text-white rounded-tr-none", config.bg) : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-tl-none text-stone-900 dark:text-stone-100"
            )}>
              <div className="markdown-body prose prose-stone dark:prose-invert max-w-none">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.image && (
                <motion.img 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={m.image} 
                  className="mt-4 rounded-2xl w-full aspect-video object-cover shadow-lg" 
                  alt="Example" 
                  referrerPolicy="no-referrer" 
                />
              )}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 rounded-3xl rounded-tl-none shadow-sm">
              <Loader2 className={cn("animate-spin", config.text)} size={24} />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="mt-4">
        <div className="flex gap-2 mb-3 px-2">
          <button 
            onClick={() => setResponseLength('short')}
            className={cn("px-4 py-1.5 text-xs font-bold rounded-full transition-all border", responseLength === 'short' ? cn("text-white border-transparent shadow-md", config.bg) : "bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800")}
          >
            {lang === 'bn' ? 'সংক্ষিপ্ত উত্তর' : 'Short Answer'}
          </button>
          <button 
            onClick={() => setResponseLength('long')}
            className={cn("px-4 py-1.5 text-xs font-bold rounded-full transition-all border", responseLength === 'long' ? cn("text-white border-transparent shadow-md", config.bg) : "bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800")}
          >
            {lang === 'bn' ? 'বিস্তারিত উত্তর' : 'Detailed Answer'}
          </button>
        </div>
        <div className="relative">
          <input 
            className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-[2rem] py-5 pl-6 pr-16 focus:outline-none focus:ring-4 focus:ring-stone-100 dark:focus:ring-stone-800 shadow-xl text-lg font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 transition-colors"
            placeholder="Type your question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={cn("absolute right-2.5 top-2.5 bottom-2.5 aspect-square text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 shadow-lg", config.bg)}
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

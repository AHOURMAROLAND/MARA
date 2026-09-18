import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Users, PlusCircle, CircleDashed, User } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/discussions', icon: MessageCircle, label: 'Discussions' },
    { path: '/groups', icon: Users, label: 'Groupes' },
    { path: '/new', icon: PlusCircle, label: 'Nouveau', isCenter: true },
    { path: '/stories', icon: CircleDashed, label: 'Stories' },
    { path: '/profile', icon: User, label: 'Profil' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 bg-[#0B0E14]/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 z-50">
      {navItems.map((item) => {
        const isActive = location.pathname.startsWith(item.path);
        const Icon = item.icon;

        if (item.isCenter) {
          return (
            <button 
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-14 h-14 bg-gradient-to-tr from-mara-pink to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-mara-pink/30 -mt-8 hover:scale-105 transition-transform"
            >
              <Icon className="w-7 h-7" />
            </button>
          );
        }

        return (
          <button 
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${isActive ? 'text-mara-pink' : 'text-theme-muted hover:text-white/80'}`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-mara-pink/10' : 'bg-transparent'}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={`text-[9px] font-bold ${isActive ? 'text-white' : 'text-theme-muted'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

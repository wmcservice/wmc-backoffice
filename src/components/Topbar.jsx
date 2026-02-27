import { Sun, Moon, Menu, Bell, Search, LogOut } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabaseClient';
import './Topbar.css';

export default function Topbar({ onMenuToggle, user }) {
    const { theme, toggleTheme } = useTheme();
    const nickname = user?.user_metadata?.nickname || user?.email?.split('@')[0] || 'User';

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button className="btn-ghost mobile-menu-btn" onClick={onMenuToggle}>
                    <Menu size={20} />
                </button>
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="ค้นหางาน, พนักงาน, หรือลูกค้า..."
                        className="input"
                    />
                </div>
            </div>

            <div className="topbar-right">
                <button className="topbar-icon-btn" title="การแจ้งเตือน">
                    <Bell size={18} />
                    <span className="notification-dot"></span>
                </button>

                <button className="topbar-icon-btn" onClick={toggleTheme} title="เปลี่ยนธีม">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <div className="topbar-divider"></div>

                <div className="user-profile">
                    <div className="user-info">
                        <span className="user-name">{nickname}</span>
                    </div>
                    <div className="user-avatar" title={user?.email}>
                        <span>{nickname.charAt(0).toUpperCase()}</span>
                    </div>
                    <button className="topbar-icon-btn logout-btn" onClick={handleLogout} title="ออกจากระบบ">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
}

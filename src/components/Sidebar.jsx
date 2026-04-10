import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardList,
    Calendar,
    Users,
    BarChart3,
    FileText,
    Settings,
    ChevronLeft,
    ChevronRight,
    HardHat,
    CalendarDays
} from 'lucide-react';
import './Sidebar.css';

const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'แดชบอร์ด' },
    { path: '/jobs', icon: ClipboardList, label: 'จัดการงาน' },
    { path: '/job-calendar', icon: CalendarDays, label: 'ปฏิทินงาน' },
    { path: '/scheduler', icon: Calendar, label: 'ตารางงาน' },
    { path: '/staff', icon: Users, label: 'พนักงาน' },
    { path: '/performance', icon: BarChart3, label: 'ประสิทธิภาพ' },
    { path: '/reports', icon: FileText, label: 'รายงาน' },
    { path: '/settings', icon: Settings, label: 'ตั้งค่า' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, user }) {
    const location = useLocation();
    const nickname = user?.user_metadata?.nickname || user?.email?.split('@')[0] || 'User';

    const handleNavClick = () => {
        // Auto-close sidebar when navigating on mobile
        if (onMobileClose) onMobileClose();
    };

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-brand">
                <div className="brand-icon">
                    <HardHat size={24} />
                </div>
                {!collapsed && (
                    <div className="brand-text">
                        <span className="brand-name">WMC Ops</span>
                        <span className="brand-tag">ศูนย์บัญชาการ</span>
                    </div>
                )}
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `nav-item ${isActive ? 'active' : ''}`
                        }
                        end={item.path === '/'}
                        title={collapsed ? item.label : undefined}
                        onClick={handleNavClick}
                    >
                        <item.icon size={20} />
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-user">
                <div className="sidebar-avatar">
                    {nickname.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                    <div className="sidebar-user-info">
                        <span className="sidebar-user-name">{nickname}</span>
                        <span className="sidebar-user-email">{user?.email}</span>
                    </div>
                )}
            </div>

            <button className="sidebar-toggle" onClick={onToggle}>
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                {!collapsed && <span>พับเมนู</span>}
            </button>
        </aside>
    );
}

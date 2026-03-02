import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Menu, Bell, Search, LogOut, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabaseClient';
import { formatDateShort } from '../utils/helpers';
import './Topbar.css';

export default function Topbar({ onMenuToggle, user }) {
    const { theme, toggleTheme } = useTheme();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef(null);
    const nickname = user?.user_metadata?.nickname || user?.email?.split('@')[0] || 'User';

    useEffect(() => {
        fetchNotifications();
        
        // Setup real-time listener for jobs changes
        const channel = supabase
            .channel('jobs-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: jobs, error } = await supabase
                .from('jobs')
                .select('*')
                .neq('status', 'เสร็จสมบูรณ์')
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const newNotifications = [];

            (jobs || []).forEach(job => {
                // 1. Jobs with issues
                if (job.current_issues && job.current_issues.trim() !== '') {
                    newNotifications.push({
                        id: `issue-${job.id}`,
                        type: 'warning',
                        title: 'งานมีปัญหาติดขัด',
                        desc: `${job.project_name}: ${job.current_issues}`,
                        time: job.updated_at,
                        jobId: job.id
                    });
                }

                // 2. High priority jobs
                if (job.priority === 'ด่วนที่สุด') {
                    newNotifications.push({
                        id: `urgent-${job.id}`,
                        type: 'info',
                        title: 'งานด่วนที่สุด',
                        desc: `โปรเจกต์ ${job.project_name} ต้องการการดูแลเป็นพิเศษ`,
                        time: job.created_at,
                        jobId: job.id
                    });
                }
            });

            setNotifications(newNotifications.slice(0, 10)); // Keep only latest 10
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

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
                <div className="notifications-container" ref={notificationRef}>
                    <button 
                        className={`topbar-icon-btn ${showNotifications ? 'active' : ''}`} 
                        onClick={() => setShowNotifications(!showNotifications)}
                        title="การแจ้งเตือน"
                    >
                        <Bell size={18} />
                        {notifications.length > 0 && <span className="notification-dot"></span>}
                    </button>

                    {showNotifications && (
                        <div className="notifications-dropdown">
                            <div className="notifications-header">
                                <h3>การแจ้งเตือน</h3>
                                <span className="badge badge-sm">{notifications.length} รายการ</span>
                            </div>
                            <div className="notifications-list">
                                {notifications.length > 0 ? (
                                    notifications.map(n => (
                                        <div key={n.id} className="notification-item">
                                            <div className={`notification-icon ${n.type}`}>
                                                {n.type === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}
                                            </div>
                                            <div className="notification-content">
                                                <span className="notification-title">{n.title}</span>
                                                <span className="notification-desc">{n.desc}</span>
                                                <span className="notification-time">{formatDateShort(n.time)}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="notifications-empty">
                                        <CheckCircle2 size={32} style={{ color: 'var(--status-completed)', opacity: 0.5 }} />
                                        <p>ไม่มีการแจ้งเตือนใหม่</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

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

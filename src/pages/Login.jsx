import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Login.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                // Sign Up
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            nickname: nickname || email.split('@')[0]
                        }
                    }
                });
                if (error) throw error;
                alert('สมัครสมาชิกสำเร็จ! โปรดตรวจสอบอีเมล (ถ้ามีการตั้งค่ายืนยัน) หรือลองเข้าสู่ระบบ');
                setIsSignUp(false);
            } else {
                // Sign In
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>WMC Operations</h1>
                    <p>{isSignUp ? 'สร้างบัญชีใหม่เพื่อใช้งานระบบ' : 'กรุณาเข้าสู่ระบบเพื่อใช้งาน'}</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form className="login-form" onSubmit={handleAuth}>
                    {isSignUp && (
                        <div className="input-group">
                            <label>ชื่อเล่น / ชื่อผู้ใช้</label>
                            <input 
                                className="input" 
                                type="text" 
                                value={nickname} 
                                onChange={e => setNickname(e.target.value)} 
                                placeholder="เช่น พี่ยุ้ย, ไอซ์"
                                required 
                            />
                        </div>
                    )}
                    <div className="input-group">
                        <label>อีเมล</label>
                        <input 
                            className="input" 
                            type="email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            placeholder="admin@wmc.com"
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>รหัสผ่าน</label>
                        <input 
                            className="input" 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder="••••••••"
                            required 
                        />
                    </div>

                    <button className="btn btn-primary" type="submit" disabled={loading}>
                        {loading ? 'กำลังดำเนินการ...' : (isSignUp ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ')}
                    </button>
                </form>

                <div className="login-divider">
                    <span className="divider-text">หรือ</span>
                </div>

                <button 
                    type="button"
                    className="btn btn-google" 
                    onClick={handleGoogleLogin} 
                    disabled={loading}
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
                    <span>เข้าสู่ระบบด้วย Google</span>
                </button>

                <div className="login-footer">
                    {/* ... (ปุ่มสลับเดิม) */}
                    <button onClick={() => setIsSignUp(!isSignUp)}>
                        {isSignUp ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิกที่นี่'}
                    </button>
                </div>
            </div>
        </div>
    );
}

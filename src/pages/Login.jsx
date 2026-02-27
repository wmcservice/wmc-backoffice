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

                <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }}></div>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>หรือ</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }}></div>
                </div>

                <button 
                    className="btn btn-outline" 
                    onClick={handleGoogleLogin} 
                    disabled={loading}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '16px' }} />
                    เข้าสู่ระบบด้วย Google
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

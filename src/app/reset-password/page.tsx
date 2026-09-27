'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import styles from '@/app/login/login.module.css';
export default function ResetPasswordPage(){const router=useRouter();const [password,setPassword]=useState('');const [error,setError]=useState('');return <main className={styles.mainGrid}><form className={styles.card} onSubmit={async e=>{e.preventDefault();const r=await authClient.resetPassword({newPassword:password});if(r.error)setError(r.error.message||'Reset failed');else router.replace('/')}}><h1 className={styles.cardTitle}>Choose a new password</h1><div className={styles.formGroup}><input className={`nb-input ${styles.input}`} type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></div>{error&&<div className={styles.errorBanner}>{error}</div>}<Button type="submit" fullWidth>Reset password</Button></form></main>}

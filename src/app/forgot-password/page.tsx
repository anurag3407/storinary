'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import styles from '@/app/login/login.module.css';
export default function ForgotPasswordPage(){const [email,setEmail]=useState('');const [sent,setSent]=useState(false);return <main className={styles.mainGrid}><form className={styles.card} onSubmit={async(e)=>{e.preventDefault();await authClient.requestPasswordReset({email,redirectTo:'/reset-password'});setSent(true)}}><h1 className={styles.cardTitle}>Reset your password</h1><p className={styles.cardSubtitle}>We’ll email you a secure reset link.</p>{sent?<div className={styles.warning}>Check your inbox.</div>:<><div className={styles.formGroup}><input className={`nb-input ${styles.input}`} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="Email"/></div><Button type="submit" fullWidth>Send reset link</Button></>}</form></main>}

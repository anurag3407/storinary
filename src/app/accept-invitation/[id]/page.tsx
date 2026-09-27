'use client';
import { useParams, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import styles from '@/app/login/login.module.css';
export default function AcceptInvitationPage(){const {id}=useParams();const router=useRouter();return <main className={styles.mainGrid}><form className={styles.card} onSubmit={async e=>{e.preventDefault();const r=await authClient.organization.acceptInvitation({invitationId:String(id)});if(r.error)alert(r.error.message);else router.replace('/')}}><h1 className={styles.cardTitle}>Join this organization</h1><p className={styles.cardSubtitle}>Sign in with the invited email address before accepting.</p><Button type="submit" fullWidth>Accept invitation</Button></form></main>}

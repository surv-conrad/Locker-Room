import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const logAction = async (userId: string, action: string, details: string) => {
  try {
    const auditLogsRef = collection(db, 'users', userId, 'auditLogs');
    await addDoc(auditLogsRef, {
      action,
      details,
      timestamp: serverTimestamp(),
      userId
    });
  } catch (error) {
    console.error('Error logging action:', error);
  }
};

import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export const downloadBackup = async (userId: string) => {
  const collections = ['groups', 'teams', 'fixtures', 'settings', 'auditLogs'];
  const backup: any = {};

  for (const colName of collections) {
    const colRef = collection(db, 'users', userId, colName);
    const snapshot = await getDocs(colRef);
    backup[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-${userId}-${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

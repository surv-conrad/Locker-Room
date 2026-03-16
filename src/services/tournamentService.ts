import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Team, Fixture } from '../types';

export const publishTournament = async (userId: string, tournamentId: string, tournamentData: any) => {
  const publicRef = doc(db, 'public_tournaments', tournamentId);
  
  try {
    // Fetch teams, fixtures, and groups to include in the public snapshot
    const teamsSnapshot = await getDocs(collection(db, `users/${userId}/teams`));
    const fixturesSnapshot = await getDocs(collection(db, `users/${userId}/fixtures`));
    const groupsSnapshot = await getDocs(collection(db, `users/${userId}/groups`));
    
    const teams = teamsSnapshot.docs.map(doc => doc.data());
    const fixtures = fixturesSnapshot.docs.map(doc => doc.data());
    const groups = groupsSnapshot.docs.map(doc => doc.data());

    await setDoc(publicRef, {
      ...tournamentData,
      ownerId: userId,
      teams,
      fixtures,
      groups,
      publishedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'public_tournaments');
  }
};

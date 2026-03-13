import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Team, Fixture } from '../types';

export const publishTournament = async (userId: string, tournamentId: string, tournamentData: any) => {
  const publicRef = doc(db, 'public_tournaments', tournamentId);
  
  // Fetch teams and fixtures to include in the public snapshot
  const teamsSnapshot = await getDocs(collection(db, `users/${userId}/teams`));
  const fixturesSnapshot = await getDocs(collection(db, `users/${userId}/fixtures`));
  
  const teams = teamsSnapshot.docs.map(doc => doc.data());
  const fixtures = fixturesSnapshot.docs.map(doc => doc.data());

  await setDoc(publicRef, {
    ...tournamentData,
    ownerId: userId,
    teams,
    fixtures,
    publishedAt: new Date().toISOString()
  });
};

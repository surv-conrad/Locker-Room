import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export const getStageName = (numberOfTeams: number): string => {
  if (numberOfTeams === 2) return "Final";
  if (numberOfTeams === 4) return "Semi-finals";
  if (numberOfTeams === 8) return "Quarter-finals";
  if (numberOfTeams === 16) return "Round of 16";
  return `Round of ${numberOfTeams}`;
};

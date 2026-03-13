import React from 'react';
import { Team, Fixture } from '../types';

interface DashboardProps {
  teams: Team[];
  fixtures: Fixture[];
}

export function Dashboard({ teams, fixtures }: DashboardProps) {
  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-semibold text-white">Tournament Dashboard</h2>
      <div className="bg-[#151821]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800/50 shadow-lg">
        <p className="text-white">Dashboard content placeholder</p>
      </div>
    </div>
  );
}

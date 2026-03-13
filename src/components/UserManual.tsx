import React from 'react';
import { Book, Shield, Users, Calendar, Trophy, Settings, BarChart2, Download, Info } from 'lucide-react';

export function UserManual() {
  const sections = [
    {
      title: 'Getting Started & Roles',
      icon: Shield,
      content: [
        'Locker Room uses Role-Based Access Control (RBAC) to ensure data security.',
        'Administrators: Can manage teams, groups, fixtures, and settings. They have full control over the tournament data.',
        'Viewers: Can view fixtures, results, tables, and stats but cannot make any changes.',
        'Authentication: Sign in with your Google account to access the system. Your role is assigned based on your email address.'
      ]
    },
    {
      title: 'Team Management',
      icon: Users,
      content: [
        'Adding Teams: Go to the "Teams Database" tab. Admins can add teams manually or import them via CSV.',
        'CSV Import: Use a CSV file with headers: name, initial, manager, phone.',
        'Team Sheets: Admins can manage player rosters for each team by clicking "Team Sheet" on a team row.',
        'Groups: Assign teams to groups to organize the tournament structure.'
      ]
    },
    {
      title: 'Fixtures & Results',
      icon: Calendar,
      content: [
        'Generation: Admins can generate the full tournament schedule with a single click. This includes group stage and knockout rounds.',
        'Match Control: Matches can be marked as "Ongoing" or "Finished". Only ongoing or finished matches can have scores and events recorded.',
        'Match Events: Record goals, cards, and other events during a match. These events automatically update player statistics.',
        'Filtering: Use the filters to show all matches, hide past matches, or focus on the current matchday.'
      ]
    },
    {
      title: 'League Table & Stats',
      icon: Trophy,
      content: [
        'Real-time Standings: The league table updates instantly as match results are recorded.',
        'Tie-breakers: The system handles tie-breakers (Goal Difference, Goals For, Head-to-Head) based on tournament settings.',
        'Player Stats: Track top scorers and card counts across the entire tournament.'
      ]
    },
    {
      title: 'Tournament Settings',
      icon: Settings,
      content: [
        'Customization: Admins can change the tournament name, logo, start date, and color scheme.',
        'Pitch Management: Define the number of pitches available for matches.',
        'Stage Configuration: Configure how many teams advance from groups and the format of knockout legs.'
      ]
    },
    {
      title: 'Exporting Data',
      icon: Download,
      content: [
        'PDF/CSV: Export fixture lists and results for offline use.',
        'Images: Generate high-quality images of the fixtures or bracket for sharing on social media.',
        'Dashboard: View a comprehensive overview of the tournament status.'
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">User Manual</h2>
        <p className="text-gray-400">Everything you need to know about managing your tournament in Locker Room.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <div key={section.title} className="bg-[#151821] border border-gray-800 rounded-2xl p-6 hover:border-indigo-500/50 transition-all duration-300 shadow-lg group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-600/10 rounded-lg text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <section.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">{section.title}</h3>
            </div>
            <ul className="space-y-3">
              {section.content.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-400 leading-relaxed">
                  <span className="text-indigo-500 font-bold">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 flex gap-4 items-start">
        <div className="p-2 bg-indigo-600 rounded-lg text-white">
          <Info className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-white font-semibold mb-1">Need more help?</h4>
          <p className="text-sm text-gray-400">
            If you encounter any issues or have specific questions not covered in this manual, please contact the system administrator or refer to the technical documentation.
          </p>
        </div>
      </div>
    </div>
  );
}

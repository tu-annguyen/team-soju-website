import React from 'react';
import StaffCard from './StaffCard';

// Mock data - would be replaced with actual data from the forum
const staffData = [
  {
    id: 1,
    name: 'SojuLeader',
    role: 'Team Leader',
    avatar: 'https://images.pexels.com/photos/1462980/pexels-photo-1462980.jpeg?auto=compress&cs=tinysrgb&w=300',
    discord: 'https://discord.gg/teamsoju',
    forum: 'https://forums.pokemmo.com/index.php?/profile/123456-sojuleader/'
  },
  {
    id: 2,
    name: 'BattleExpert',
    role: 'Battle Coordinator',
    avatar: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=300',
    discord: 'https://discord.gg/teamsoju',
    forum: 'https://forums.pokemmo.com/index.php?/profile/123457-battleexpert/'
  },
  {
    id: 3,
    name: 'ShinyHunter',
    role: 'Shiny Expert',
    avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300',
    discord: 'https://discord.gg/teamsoju',
    forum: 'https://forums.pokemmo.com/index.php?/profile/123458-shinyhunter/'
  },
  {
    id: 4,
    name: 'BreederPro',
    role: 'Breeding Specialist',
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=300',
    discord: 'https://discord.gg/teamsoju'
  },
  {
    id: 5,
    name: 'GymLeader',
    role: 'Team Moderator',
    avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300',
    forum: 'https://forums.pokemmo.com/index.php?/profile/123459-gymleader/'
  },
  {
    id: 6,
    name: 'EventPlanner',
    role: 'Event Coordinator',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300',
    discord: 'https://discord.gg/teamsoju',
    forum: 'https://forums.pokemmo.com/index.php?/profile/123460-eventplanner/'
  }
];

const TeamStaff = () => {
  return (
    <section className="py-16">
      <div className="container">
        <h2 className="text-3xl font-bold mb-4 text-center text-gray-900 dark:text-white">Leaders & Moderators</h2>
        <p className="text-gray-700 dark:text-gray-300 text-center mb-12 max-w-3xl mx-auto">
          Meet the dedicated team members who manage and lead Team Soju.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {staffData.map(staff => (
            <StaffCard
              key={staff.id}
              name={staff.name}
              role={staff.role}
              avatar={staff.avatar}
              discord={staff.discord}
              forum={staff.forum}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeamStaff;
import React from 'react';
import StaffCard from './StaffCard';

// Mock data - would be replaced with actual data from the forum
const staffData = [
  {
    id: 1,
    name: 'Buddhalicious',
    role: 'Co-Leader',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2023_11/IMG_1764.thumb.webp.269359ff75c30518e5afdb5c5da5b60b.webp',
    discord: 'https://discordapp.com/users/189168387824418816',
    forum: 'https://forums.pokemmo.com/index.php?/profile/483720-buddhalicious/'
  },
  {
    id: 2,
    name: 'Aisuhoki',
    role: 'Co-Leader',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2024_04/Nagi.thumb.jpg.eab474e28a04332997b091001d4bceef.jpg',
    discord: 'https://discordapp.com/users/558122397971120133',
    forum: 'https://forums.pokemmo.com/index.php?/profile/490746-aisukohi/'
  },
  {
    id: 3,
    name: 'cubberkazookie',
    role: 'Discord Moderator',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2024_12/bearonskateboards.thumb.jpg.446c42a810225b2c64f6f43f716b89a3.jpg',
    discord: 'https://discordapp.com/users/757471359835177071',
    forum: 'https://forums.pokemmo.com/index.php?/profile/487174-cubberkazooie/'
  },
  {
    id: 4,
    name: 'ReefBarrierGreat',
    role: 'Event Coordinator',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2025_01/Screenshot2024-12-31113703.thumb.png.c371cb918eb2889245c205f2eab62721.png',
    discord: 'https://discordapp.com/users/164470609101717504',
    forum: 'https://forums.pokemmo.com/index.php?/profile/506391-reefbarriergreat/'
  },
  {
    id: 5,
    name: 'hefferson',
    role: 'Team Recruiter',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2023_12/8a97b55150df7dbf80dd1b12b3d9fc26.thumb.jpg.0fac3953b5f4365c34f2a8fd98188aa5.jpg',
    discord: 'https://discordapp.com/users/234164830779604994',
    forum: 'https://forums.pokemmo.com/index.php?/profile/478751-hefferson/'
  },
  {
    id: 6,
    name: 'tunacore',
    role: 'Developer & Designer',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2024_08/Camels_Face_pfp.thumb.webp.5f5ee343cc68a4c5b89aa09450ca7280.webp',
    discord: 'https://discordapp.com/users/272201126068092928',
    forum: 'https://forums.pokemmo.com/index.php?/profile/492263-tunacore/'
  }
];

const TeamStaff = () => {
  return (
    <section className="py-16">
      <div className="container">
        <h2 className="text-3xl font-bold mb-4 text-center text-gray-900 dark:text-white">Team Staff</h2>
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
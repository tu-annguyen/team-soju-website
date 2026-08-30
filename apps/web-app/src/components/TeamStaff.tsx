import React from 'react';
import StaffCard from './StaffCard';

// Mock data - would be replaced with actual data from the forum
const staffData = [
  {
    id: 1,
    name: 'Buddhalicious',
    role: 'Leader',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2023_11/IMG_1764.thumb.webp.269359ff75c30518e5afdb5c5da5b60b.webp',
    discord: 'https://discordapp.com/users/189168387824418816',
    forum: 'https://forums.pokemmo.com/index.php?/profile/483720-buddhalicious/'
  },
  {
    id: 2,
    name: 'Aisukohi',
    role: 'Co-Founder',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2024_04/Nagi.thumb.jpg.eab474e28a04332997b091001d4bceef.jpg',
    discord: 'https://discordapp.com/users/558122397971120133',
    forum: 'https://forums.pokemmo.com/index.php?/profile/490746-aisukohi/'
  },
  {
    id: 3,
    name: 'tunacore',
    role: 'Website & Content Lead',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2024_08/Camels_Face_pfp.thumb.webp.5f5ee343cc68a4c5b89aa09450ca7280.webp',
    discord: 'https://discordapp.com/users/272201126068092928',
    forum: 'https://forums.pokemmo.com/index.php?/profile/492263-tunacore/'
  },
  {
    id: 4,
    name: 'Pokio',
    role: 'Artist',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2025_04/IMG_96975.png.88a810cafe3782e0c82926dd2fe97e98.png',
    discord: 'https://discordapp.com/users/701127393326399558',
    forum: 'https://forums.pokemmo.com/index.php?/profile/241159-pokio/'
  },
  {
    id: 5,
    name: 'Megu',
    role: 'Event Coordinator',
    avatar: '/images/megu-pfp.png',
    discord: 'https://discordapp.com/users/406270938079035393',
    forum: 'https://forums.pokemmo.com/index.php?/profile/497080-xmegux/'
  },
  {
    id: 6,
    name: 'SsjBlueCrill',
    role: 'Team Recruiter',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2025_03/Img_2025_01_26_15_58_57.jpeg.985a0111a3dcdc373d94bdd7ea0377cd.jpeg',
    discord: 'https://discordapp.com/users/507450215096254464',
    forum: 'https://forums.pokemmo.com/index.php?/profile/531427-ssjbluecrill/'
  }
];

const TeamStaff = () => {
  const columns = 3;
  const rows = Math.ceil(staffData.length / columns);
  const lastRowCount = staffData.length % columns || columns;

  return (
    <section className="py-16">
      <div className="container">
        <h2 className="text-3xl font-bold mb-4 text-center text-gray-900 dark:text-white">Team Staff</h2>
        <p className="text-gray-700 dark:text-gray-300 text-center mb-12 max-w-3xl mx-auto">
          Meet the dedicated team members who manage and lead Team Soju.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {staffData.map((staff, idx) => {
            // If last card and it's alone in the last row, center it
            if (
              idx === staffData.length - 1 &&
              lastRowCount === 1
            ) {
              return (
                <div key={staff.id} className="col-span-full flex justify-center">
                  <div className="w-full max-w-sm">
                    <StaffCard
                      name={staff.name}
                      role={staff.role}
                      avatar={staff.avatar}
                      discord={staff.discord}
                      forum={staff.forum}
                    />
                  </div>
                </div>
              );
            }
            return (
              <StaffCard
                key={staff.id}
                name={staff.name}
                role={staff.role}
                avatar={staff.avatar}
                discord={staff.discord}
                forum={staff.forum}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TeamStaff;
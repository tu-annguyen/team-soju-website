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
    role: 'Co-Founder',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2024_04/Nagi.thumb.jpg.eab474e28a04332997b091001d4bceef.jpg',
    discord: 'https://discordapp.com/users/558122397971120133',
    forum: 'https://forums.pokemmo.com/index.php?/profile/490746-aisukohi/'
  },
  {
    id: 3,
    name: 'cubberkazookie',
    role: 'Community & Onboarding Manager',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2025_11/IMG_9484.thumb.jpg.5416c3c95048a3d58ff4465c724bbca6.jpg',
    discord: 'https://discordapp.com/users/757471359835177071',
    forum: 'https://forums.pokemmo.com/index.php?/profile/487174-cubberkazooie/'
  },
  {
    id: 4,
    name: 'Immo',
    role: 'Showcase Kid',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2025_12/image_2025-12-20_085301764.png.310774dcfab98b9757d603653d6c933c.png',
    discord: 'https://discordapp.com/users/683832833705377802',
    forum: 'https://forums.pokemmo.com/index.php?/profile/505616-immo/'
  },
  {
    id: 5,
    name: 'hefferson',
    role: 'Event Coordinator',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2023_12/8a97b55150df7dbf80dd1b12b3d9fc26.thumb.jpg.0fac3953b5f4365c34f2a8fd98188aa5.jpg',
    discord: 'https://discordapp.com/users/234164830779604994',
    forum: 'https://forums.pokemmo.com/index.php?/profile/478751-hefferson/'
  },
  {
    id: 6,
    name: 'tunacore',
    role: 'Website & Content Lead',
    avatar: 'https://forums.pokemmo.com/uploads/monthly_2024_08/Camels_Face_pfp.thumb.webp.5f5ee343cc68a4c5b89aa09450ca7280.webp',
    discord: 'https://discordapp.com/users/272201126068092928',
    forum: 'https://forums.pokemmo.com/index.php?/profile/492263-tunacore/'
  },
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
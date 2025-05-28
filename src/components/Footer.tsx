import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="/images/team-soju-logo.png" 
                alt="Team Soju Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="font-display text-lg font-bold text-primary-600 dark:text-primary-400">
                Team Soju
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              A budding PokeMMO team dedicated to fostering a growing community of rag tag friends with a good mix of veteran and new players. 
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Links</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="/" 
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  Home
                </a>
              </li>
              <li>
                <a 
                  href="/shiny-showcase" 
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  Shiny Showcase
                </a>
              </li>
              <li>
                <a 
                  href="/events" 
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  Events
                </a>
              </li>
              <li>
                <a 
                  href="https://forums.pokemmo.com/index.php?/clubs/261-soj%C3%BC-sojusanctuary/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  Forum
                </a>
              </li>
              <li>
                <a 
                  href="https://discord.gg/teamsoju" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  Discord
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Join Us</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Interested in joining Team Soju? We're always looking for talented trainers!
            </p>
            <a 
              href="https://forums.pokemmo.com/index.php?/topic/182111-team-soju-is-recruiting/#comment-2123917" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary text-sm px-4 py-2"
            >
              Apply Now
            </a>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>© {currentYear} Team Soju. All rights reserved.</p>
          <p className="mt-2">
            Pokémon is a registered trademark of Nintendo, Creatures, Inc. and GAME FREAK inc. 
            This website is not affiliated with Nintendo, Creatures, Inc., GAME FREAK inc., 
            or PokeMMO.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
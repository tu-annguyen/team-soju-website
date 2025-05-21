import React from 'react';
import { motion } from 'framer-motion';

const Hero = () => {
  return (
    <section className="relative min-h-[60vh] flex items-center overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800 z-0">
        <div className="absolute inset-0 opacity-30 dark:opacity-20 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%234CAF50%22 fill-opacity=%220.2%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
      </div>
      
      <div className="container relative z-10 py-16">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-12">
          <motion.div 
            className="md:w-1/2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Welcome to <span className="text-primary-500 dark:text-primary-400">Team Soju</span>
            </h1>
            <p className="text-xl text-gray-700 dark:text-gray-300 mb-8">
              Team Soju is a budding PokeMMO team dedicated to fostering a growing community of rag tag friends with a good mix of veteran and new players. We are a PvE team mainly focused in shiny hunting but have some dedicated PvPers! 건배!
            </p>
            <div className="flex flex-wrap gap-4">
              <a 
                href="https://discord.gg/teamsoju"
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Join Discord
              </a>
              <a 
                href="https://forums.pokemmo.com/index.php?/topic/182111-team-soju-is-recruiting/#comment-2123917"
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                Apply Now
              </a>
            </div>
          </motion.div>
          
          <motion.div 
            className="md:w-1/2 flex justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <img 
              src="/images/team-soju-logo.png" 
              alt="Team Soju Logo" 
              className="w-64 h-64 object-contain"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
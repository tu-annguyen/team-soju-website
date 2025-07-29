import React from 'react';
import { motion } from 'framer-motion';

interface LinkCardProps {
  title: string;
  description: string;
  url: string;
  icon: React.ReactNode;
  color?: string;
}

const LinkCard = ({ title, description, url, icon, color = 'bg-primary-500' }: LinkCardProps) => {
  const isExternal = /^https?:\/\//.test(url);

  return (
    <motion.a
      href={url}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="card hover:shadow-lg group bg-white dark:bg-gray-700"
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="p-6">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center mb-4 text-white`}>
          {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
    </motion.a>
  );
};

export default LinkCard;
import React from 'react';

const Anniversary = () => {
  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">SOJU 1 Year Anniversary</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8">
            This is Team Soju's first ever anniversary event! We've come a long way since when we first started to where we are now, and it's time to celebrate all our achievements with this event! For more details about the Anniversary Event, please visit our 
            <a 
              href="https://forums.pokemmo.com/index.php?/topic/190338-soju-anniversary-event/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
            >
              forum post
            </a>. 
          </p>
        </div>
      </div>
    </section>
  );
};

export default Anniversary;
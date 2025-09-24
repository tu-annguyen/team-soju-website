import React from "react";

const EventsHeader = () => {
  return (
    <div className="py-16 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Events
          </h1>
          <p className="text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
            Our team's collection of past, current, and upcoming events. Go back to the 
            <a href="/events/" className="text-primary-600 dark:text-primary-400 hover:underline ml-1">events page</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EventsHeader;
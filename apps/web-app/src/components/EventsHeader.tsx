import React from "react";

interface EventsHeaderProps {
  banner?: string;
}

const EventsHeader = ({ banner }: EventsHeaderProps) => {
  return (
    <div
      className={`relative py-16 ${
        banner
          ? "bg-cover bg-center bg-no-repeat"
          : "bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800"
      }`}
      style={banner ? { backgroundImage: `url(${banner})` } : undefined}
    >
      {banner ? <div className="absolute inset-0 bg-black/55" aria-hidden="true" /> : null}
      <div className="container relative">
        <div className="text-center mb-8">
          <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${banner ? "text-white" : "text-gray-900 dark:text-white"}`}>
            Events
          </h1>
          <p className={`max-w-3xl mx-auto ${banner ? "text-white/90" : "text-gray-700 dark:text-gray-300"}`}>
            Our team's collection of past, current, and upcoming events.
          </p>
        </div>
        <div className="mb-12 flex justify-center">
          <a href="/events/" className="mx-4 btn btn-secondary">See all events</a>
        </div>
      </div>
    </div>
  );
};

export default EventsHeader;

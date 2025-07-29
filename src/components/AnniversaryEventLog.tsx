import React, { useState, useEffect } from "react";

// Example event data; update icons, names, and winners as needed
const mainEvents = [
  { icon: "/images/2025/anniversary/main1.jpg", name: "Squirtle Catch Event", first: "tunacore - Terrific Team Tunacore", second: "TINAWATERB - Reef Squad", third: "Swifty - Reef Squad" },
  { icon: "/images/2025/anniversary/main2.png", name: "Unova Grand Prix", first: "" },
  { icon: "/images/2025/anniversary/main3.png", name: "Kecleon Metronome", first: "" },
  { icon: "/images/2025/anniversary/main4.png", name: "Secret Base Hide n Seek", first: "" },
  { icon: "/images/2025/anniversary/main5.png", name: "Spot the Spinda", first: "" },
  { icon: "/images/2025/anniversary/main6.png", name: "Shiny PvP", first: "" },
  { icon: "/images/2025/anniversary/main7.png", name: "Soju Trivia", first: "" },
];

const miniEvents = [
  { icon: "/images/2025/anniversary/mini1.png", name: "SOJUnowns", first: "" },
  { icon: "/images/2025/anniversary/mini2.png", name: "SPIN TO WIN", first: "" },
  { icon: "/images/2025/anniversary/mini3.png", name: "Where's Jaap?", first: "" },
  { icon: "/images/2025/anniversary/mini4.png", name: "Sinnoh Marathon", first: "" },
  { icon: "/images/2025/anniversary/mini5.png", name: "Clowns Going Viral", first: "" },
  { icon: "/images/2025/anniversary/mini6.png", name: "LFF :)", first: "" },
  { icon: "/images/2025/anniversary/mini7.png", name: "Magikarp Catch Event", first: "" },
];

const placeholder = "/images/2025/anniversary/placeholder.png";

const EventCard = ({
  icon,
  name,
  first,
  second,
  third,
}: {
  icon: string;
  name: string;
  first?: string;
  second?: string;
  third?: string;
}) => {
  // Always start with the placeholder (SSR-safe)
  const [imgSrc, setImgSrc] = useState(placeholder);

  // On client, try to load the real icon
  useEffect(() => {
    setImgSrc(icon);
  }, [icon]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col items-center p-4 border dark:border-gray-700">
      <img
        src={imgSrc}
        alt={name}
        className="max-h-48 w-auto object-contain mb-4"
        onError={() => {
          if (imgSrc !== placeholder) setImgSrc(placeholder);
        }}
      />
      <div className="font-bold text-lg text-center text-gray-900 dark:text-white mb-2">{name}</div>
      <div className="text-sm text-gray-700 dark:text-gray-300">
        {first ? (
          <>
            <span className="font-semibold">1st place: </span>{first} <span className="text-gray-400">(+5 pts)</span>
            {second && (
              <>
                <br />
                <span className="font-semibold">2nd place:</span>{second} <span className="text-gray-400">(+3 pts)</span>
              </>
            )}
            {third && (
              <>
                <br />
                <span className="font-semibold">3rd place: </span>{third} <span className="text-gray-400">(+1 pt)</span>
              </>
            )}
          </>
        ) : (
          <span className="text-gray-400">Winner: TBD</span>
        )}
      </div>
    </div>
  );
};

const AnniversaryEventLog = () => (
  <section className="py-8">
    <div className="container">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
        Event Log
      </h2>
      <div className="mb-8">
        <h3 className="font-bold text-primary-700 dark:text-primary-400 mb-4 text-lg">Main Events</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mainEvents.map((event, idx) => (
            <EventCard key={`main-${idx}`} {...event} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-bold text-secondary-700 dark:text-secondary-400 mb-4 text-lg">Mini Events</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {miniEvents.map((event, idx) => (
            <EventCard key={`mini-${idx}`} {...event} />
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default AnniversaryEventLog;
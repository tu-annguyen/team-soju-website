import React, { useState, useEffect } from "react";
import anniversaryData from "../data/anniversary.json";

const mainEvents = anniversaryData.mainEvents;
const miniEvents = anniversaryData.miniEvents;
const eventShinies = anniversaryData.eventShinies;

const placeholder = "/images/2025/anniversary/placeholder.png";

const EventCard = ({
    icon,
    name,
    type,
    first,
    second,
    third,
    OT,
    shinyScore,
}: {
    icon: string;
    name: string;
    type: "main" | "mini" | "shiny";
    first?: string;
    second?: string;
    third?: string;
    OT?: string;
    shinyScore?: number;
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
            <div className="font-bold text-lg text-center text-gray-900 dark:text-white mb-2">
                {name}
            </div>
            <div className="text-sm text-center text-gray-700 dark:text-gray-300">
                {type === "main" && (
                    <>
                        {first ? (
                            <>
                                <span className="font-semibold">1st place: </span>
                                {first} <span className="text-gray-400">(+5 pts)</span>
                                {second && (
                                    <>
                                        <br />
                                        <span className="font-semibold">2nd place: </span>
                                        {second} <span className="text-gray-400">(+3 pts)</span>
                                    </>
                                )}
                                {third && (
                                    <>
                                        <br />
                                        <span className="font-semibold">3rd place: </span>
                                        {third} <span className="text-gray-400">(+1 pt)</span>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="font-semibold">Winners: </span>
                                <span className="text-gray-400">TBD</span>
                            </>
                        )}
                    </>
                )}
                {type === "mini" && (
                    <>
                        <span className="font-semibold">Winner: </span>
                        {first ? (
                            <>{first} <span className="text-gray-400">(+2 pts)</span></>
                        ) : (
                            <span className="text-gray-400">TBD</span>
                        )}
                    </>
                )}
                {type === "shiny" && (
                    <>
                        <span className="font-semibold">OT: </span>
                        {OT ? (
                            <>{OT} <span className="text-gray-400">(+{shinyScore} pts)</span></>
                        ) : (
                            <span className="text-gray-400">TBD</span>
                        )}
                    </>
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
                <h3 className="font-bold text-primary-700 dark:text-primary-400 mb-4 text-lg">
                    Main Events
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {mainEvents.map((event, idx) => (
                        <EventCard key={`main-${idx}`} {...event} type="main" />
                    ))}
                </div>
            </div>
            <div className="mb-8">
                <h3 className="font-bold text-secondary-700 dark:text-secondary-400 mb-4 text-lg">
                    Mini Events
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {miniEvents.map((event, idx) => (
                        <EventCard key={`mini-${idx}`} {...event} type="mini"/>
                    ))}
                </div>
            </div>
            <div>
                <h3 className="font-bold text-accent-700 dark:text-accent-400 mb-4 text-lg">
                    Event Shinies
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {eventShinies.map((event, idx) => (
                        <EventCard key={`mini-${idx}`} {...event} type="shiny" />
                    ))}
                </div>
            </div>
        </div>
    </section>
);

export default AnniversaryEventLog;

import React, { useState, useEffect } from "react";
import type { AnniversaryData, AnniversaryEvent } from "../types/anniversary";
import { DEFAULT_SHINY_SCORE, MAIN_EVENT_POINTS, MINI_EVENT_POINTS } from "../utils/anniversaryScoring";

interface AnniversaryEventLogProps {
    year: number;
    anniversaryData: AnniversaryData;
}

const formatPointLabel = (points: number) => `+${points} ${points === 1 ? "pt" : "pts"}`;

const EventCard = ({
    icon,
    name,
    type,
    first,
    second,
    third,
    OT,
    shinyScore,
    score,
    placeholder,
}: AnniversaryEvent & {
    type: "main" | "mini" | "shiny" | "bounty";
    placeholder: string;
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
                                {first} <span className="text-gray-400">({formatPointLabel(MAIN_EVENT_POINTS.first)})</span>
                                {second && (
                                    <>
                                        <br />
                                        <span className="font-semibold">2nd place: </span>
                                        {second} <span className="text-gray-400">({formatPointLabel(MAIN_EVENT_POINTS.second)})</span>
                                    </>
                                )}
                                {third && (
                                    <>
                                        <br />
                                        <span className="font-semibold">3rd place: </span>
                                        {third} <span className="text-gray-400">({formatPointLabel(MAIN_EVENT_POINTS.third)})</span>
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
                            <>{first} <span className="text-gray-400">({formatPointLabel(MINI_EVENT_POINTS.first)})</span></>
                        ) : (
                            <span className="text-gray-400">TBD</span>
                        )}
                    </>
                )}
                {(type === "shiny" || type === "bounty") && (
                    <>
                        <span className="font-semibold">OT: </span>
                        {OT ? (
                            <>
                                {OT}{" "}
                                <span className="text-gray-400">
                                    ({formatPointLabel(type === "bounty" ? score ?? 0 : shinyScore ?? DEFAULT_SHINY_SCORE)})
                                </span>
                            </>
                        ) : (
                            <span className="text-gray-400">TBD</span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const AnniversaryEventLog = ({ year, anniversaryData }: AnniversaryEventLogProps) => {
    const { mainEvents, miniEvents } = anniversaryData;
    const eventShinies = anniversaryData.eventShinies ?? [];
    const eventBounties = anniversaryData.eventBounties ?? [];
    const placeholder = "/images/anniversary-placeholder.png";

    return (
        <section className="py-8">
            <div className="container">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
                    {year} Event Log
                </h2>
                <div className="mb-8">
                    <h3 className="font-bold text-primary-700 dark:text-primary-400 mb-4 text-lg">
                        Main Events
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {mainEvents.map((event, idx) => (
                            <EventCard key={`main-${idx}`} {...event} type="main" placeholder={placeholder} />
                        ))}
                    </div>
                </div>
                <div className="mb-8">
                    <h3 className="font-bold text-secondary-700 dark:text-secondary-400 mb-4 text-lg">
                        Mini Events
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {miniEvents.map((event, idx) => (
                            <EventCard key={`mini-${idx}`} {...event} type="mini" placeholder={placeholder} />
                        ))}
                    </div>
                </div>
                <div>
                    {eventShinies.length > 0 && (
                        <>
                            <h3 className="font-bold text-accent-700 dark:text-accent-400 mb-4 text-lg">
                                Event Shinies
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {eventShinies.map((event, idx) => (
                                    <EventCard key={`shiny-${idx}`} {...event} type="shiny" placeholder={placeholder} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
                <div>
                    {eventBounties.length > 0 && (
                        <>
                            <h3 className="font-bold text-accent-700 dark:text-accent-400 mt-8 mb-4 text-lg">
                                Event Bounties
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {eventBounties.map((event, idx) => (
                                    <EventCard key={`bounty-${idx}`} {...event} type="bounty" placeholder={placeholder} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};

export default AnniversaryEventLog;

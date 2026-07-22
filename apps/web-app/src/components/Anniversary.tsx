import React from 'react';
import Leaderboard from './Leaderboard';
import AnniversaryEventLog from './AnniversaryEventLog';
import type { AnniversaryData } from '../types/anniversary';

interface AnniversaryProps {
  year: number;
  anniversaryData: AnniversaryData;
}

const Anniversary = ({ year, anniversaryData }: AnniversaryProps) => {
  const anniversaryNumber = year - 2024;
  const contentVideos = anniversaryData.contentVideo ?? [];

  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            SOJU {anniversaryNumber} Year Anniversary
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8">
            This is Team Soju's anniversary event! We've come a long way since when we first started to where we are now, and it's time to celebrate all our achievements with this event!
            {year === 2025 && (
              <>
                {' '}For more details about the Anniversary Event, please visit our
                <a
                  href="https://forums.pokemmo.com/index.php?/topic/190338-soju-anniversary-event/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
                >
                  forum post
                </a>.
              </>
            )}
            {year === 2026 && (
              <>
                {' '}For more details about the Anniversary Event, please visit our
                <a
                  href="https://forums.pokemmo.com/index.php?/topic/199319-soju-2nd-anniversary-event/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
                >
                  forum post
                </a>.
              </>
            )}
          </p>
        </div>
        {contentVideos.length > 0 && (
          <div className="mb-12">
            <h3 className="text-center text-2xl font-bold mb-6 text-gray-900 dark:text-white">Content</h3>
            <div className="grid gap-6 md:grid-cols-1">
              {contentVideos.map((video) => (
                <div key={video.id} className="overflow-hidden rounded-xl bg-black shadow-lg">
                  <div className="aspect-video">
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube.com/embed/${video.id}`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Leaderboard teams={anniversaryData.teams} />
      <AnniversaryEventLog year={year} anniversaryData={anniversaryData} />
    </section>
  );
};

export default Anniversary;

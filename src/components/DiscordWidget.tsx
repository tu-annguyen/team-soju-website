import React, { useEffect, useState } from "react";

type DiscordUser = {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  status: string;
  bot?: boolean;
};

type DiscordChannel = {
  id: string;
  name: string;
  position: number;
};

type DiscordWidgetData = {
  id: string;
  name: string;
  instant_invite: string;
  presence_count: number;
  channels: DiscordChannel[];
  members: DiscordUser[];
};

const DiscordWidget = () => {
  const [data, setData] = useState<DiscordWidgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://discord.com/api/guilds/1267051048241991682/widget.json")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center">
        <span className="text-gray-500 dark:text-gray-400">Loading Discord widget...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center">
        <span className="text-red-500">Unable to load Discord widget.</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <img
          src="/images/team-soju-logo.png"
          alt="Discord"
          className="h-8 w-8 mr-2"
        />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex-1">
          {data.name} Discord
        </h3>
        <span className="text-sm text-primary-600 dark:text-primary-400 font-semibold">
          {data.presence_count} Online
        </span>
      </div>
      <div className="mb-4">
        <a
          href={data.instant_invite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 transition"
        >
          Join Discord
        </a>
      </div>
      <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm">
          Online Members
        </h4>
        <div className="flex flex-wrap gap-3">
          {data.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center bg-gray-100 dark:bg-gray-800 rounded px-2 py-1"
            >
              <img
                src={member.avatar_url}
                alt={member.username}
                className="h-6 w-6 rounded-full mr-2"
              />
              <span className="text-gray-900 dark:text-white text-sm">{member.username}</span>
              {member.bot && (
                <span className="ml-1 text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 rounded px-1">
                  BOT
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscordWidget;
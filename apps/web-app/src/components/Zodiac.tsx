import React from "react";

const Zodiac = () => {
  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            SOJU Zodiac War
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8">
            Join us for our second Zodiac Shiny War on March 20-29! Sign up in
            the{" "}
            <code className="font-mono bg-gray-100 dark:bg-gray-700 p-1 rounded">
              #event-ideas💡
            </code>{" "}
            <a
              href="../../discord"
              className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
            >
              Discord
            </a>{" "}
            channel. Stay tuned for more details.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Zodiac;

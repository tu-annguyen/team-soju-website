const en = {
  meta: {
    defaultTitle: 'Team Soju - PokeMMO Team',
    defaultDescription:
      'Team Soju is a premier PokeMMO team dedicated to excellence, community, and the thrill of competitive Pokemon battles.',
  },
  nav: {
    home: 'Home',
    shinyShowcase: 'Shiny Showcase',
    events: 'Events',
    tools: 'Tools',
    forum: 'Forum',
    discord: 'Discord',
    toggleMenu: 'Toggle menu',
  },
  footer: {
    blurb:
      'A budding PokeMMO team dedicated to fostering a growing community of rag tag friends with a good mix of veteran and new players.',
    linksTitle: 'Links',
    joinTitle: 'Join Us',
    joinDescription: "Interested in joining Team Soju? We're always looking for talented trainers!",
    applyNow: 'Apply Now',
    rightsReserved: 'All rights reserved.',
    legal:
      'Pokemon is a registered trademark of Nintendo, Creatures, Inc. and GAME FREAK inc. This website is not affiliated with Nintendo, Creatures, Inc., GAME FREAK inc., or PokeMMO.',
  },
  home: {
    title: 'Team Soju - PokeMMO Team',
    description:
      'Team Soju is a budding PokeMMO team dedicated to fostering a growing community of rag tag friends with a good mix of veteran and new players. We are a PvE team mainly focused in shiny hunting but have some dedicated PvPers! 건배!',
    hero: {
      headingPrefix: 'Welcome to',
      headingHighlight: 'Team Soju',
      body:
        'Team Soju is a budding PokeMMO team dedicated to fostering a growing community of rag tag friends with a good mix of veteran and new players. We are a PvE team mainly focused in shiny hunting but have some dedicated PvPers! 건배!',
      primaryCta: 'Apply Now',
      secondaryCta: 'Join Discord',
      logoAlt: 'Team Soju Logo',
    },
  },
  tools: {
    index: {
      title: 'Tools - Team Soju',
      description: "Explore Team Soju's community tools and utilities.",
      eyebrow: 'Tools',
      heading: 'Tools',
      intro:
        'Handy utilities built for the PokeMMO community to coordinate faster and play smarter.',
      availableTitle: 'Available Tools',
      availableDescription:
        'Jump into the tools we use to organize hunts, share progress, and keep everyone on the same page.',
      openTool: 'Open tool',
      categories: {
        liveCoordination: 'Live Coordination',
      },
      feebasCard: {
        title: 'Feebas Tile Tracker',
        description:
          'Coordinate Feebas tile checks in real time with a shared tile board for checked, found, or confirmed calls. Each call has a translucent color so the board behaves like a live heatmap of group opinion.',
      },
    },
    feebas: {
      title: 'Feebas Tile Checker - Team Soju',
      description: 'Coordinate Feebas tile checks live with a shared board.',
      eyebrow: 'Live Coordination Tool',
      heading: 'Feebas Tile Checker',
      intro:
        'Coordinate Feebas tile checks in real time. Vote tiles as checked, pending, or confirmed. Colors stack at 25% opacity per vote so the board behaves like a live heatmap of group opinion.',
    },
    feebasChecker: {
      locationsTabLabel: 'Feebas locations',
      locations: {
        route119: {
          tabLabel: 'Route 119',
          displayName: 'Route 119, Hoenn',
        },
        mtCoronet: {
          tabLabel: 'Mt. Coronet',
          displayName: 'Mt. Coronet, Sinnoh',
        },
      },
      status: {
        unchecked: 'Unchecked',
        checked: 'Checked',
        pending: 'Feebas Found',
        confirmed: 'Feebas Confirmed',
      },
      voteSummary: {
        checked: 'checked',
        pending: 'pending',
        confirmed: 'confirmed',
      },
      actions: {
        clearedVote: 'cleared their vote on',
        statusSuffix: 'on',
      },
      general: {
        anonymousName: 'Anonymous',
        optionalDisplayName: 'Optional display name',
        displayNamePlaceholder: 'Anonymous Feebas Hunter',
        nextReset: 'Next Reset',
        resetsEvery: 'Resets every {minutes} real-time minutes',
        rules:
          'Each browser can keep one active vote per tile. Only one pending nomination can exist at a time per tile, and the player who marked it pending cannot confirm it.',
        scrollHint: 'Scroll sideways to view the full board.',
        mixedVotesHint: 'Mixed colors mean mixed opinions. More votes make a tile overlay stronger.',
        loadingBoard: 'Loading the Feebas board...',
      },
      boardStatus: {
        heading: 'Board Status',
        checkedTiles: 'Checked tiles',
        pendingTiles: 'Pending Feebas tiles',
        confirmedTiles: 'Confirmed Feebas tiles',
      },
      selectedTile: {
        heading: 'Selected Tile',
        tileLabel: 'Tile',
        leadingStatus: 'Leading status: {status}',
        checkedVotes: '{count} checked vote(s)',
        pendingVotes: '{count} pending vote(s)',
        confirmedVotes: '{count} confirmed vote(s)',
        yourVote: 'Your vote: {status}',
        noFeebas: 'No Feebas',
        feebasFound: 'Feebas Found',
        feebasConfirmed: 'Feebas Confirmed',
        clearVote: 'Clear My Vote',
        needsPendingBeforeConfirm:
          'This tile needs at least one pending vote before confirmed votes are allowed.',
        pendingOwnerHint:
          'You placed the active pending vote, so another player can confirm it, or you can clear your pending mark.',
        otherPendingHint:
          'Another player already has the pending nomination on this tile, so you can only resolve it as checked or confirmed.',
        emptyState: 'Select a tile to cast your vote or clear it.',
      },
      activity: {
        heading: 'Activity',
        emptyState: 'Tile changes will appear here as players shape the board together.',
      },
      errors: {
        loadBoard: 'Unable to load the Feebas board',
        refreshBoard: 'Unable to refresh the Feebas board',
        updateTile: 'Unable to update the Feebas tile',
        liveUpdatesDisconnected: 'Live updates disconnected. The board will refresh again shortly.',
      },
    },
  },
} as const;

export default en;

import catchEventManager from './catch-events/en';

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
    signIn: 'Sign in',
    signOut: 'Sign out',
    account: 'Account',
    language: 'Language',
    toggleMenu: 'Toggle menu',
  },
  auth: {
    title: 'Account - Team Soju',
    description: 'Create or access your Team Soju account.',
    heading: 'Team Soju Account',
    signedInHeading: 'Signed in',
    signedInCopy: 'Welcome back, {ign}.',
    email: 'Email',
    password: 'Password',
    passwordRequirements: 'Use 8 or more characters with at least one number and one special character.',
    confirmPassword: 'Re-type new password',
    ign: 'In-game name',
    loginTab: 'Sign in',
    registerTab: 'Create account',
    loginSubmit: 'Sign in',
    registerSubmit: 'Create account',
    forgotPassword: 'Forgot password?',
    forgotPasswordHeading: 'Reset your password',
    forgotPasswordCopy: 'Enter the email on your Team Soju account and we will send you a reset link.',
    sendResetLink: 'Send reset link',
    resetEmailSent: 'If an account uses that email, a reset link has been sent.',
    resetPasswordHeading: 'Choose a new password',
    resetPasswordCopy: 'Enter a new password for your Team Soju account.',
    newPassword: 'New password',
    resetPasswordSubmit: 'Reset password',
    successPasswordReset: 'Password reset successfully.',
    backToSignIn: 'Back to sign in',
    discordLogin: 'Continue with Discord',
    discordRegister: 'Create with Discord',
    signOut: 'Sign out',
    loading: 'Checking your session...',
    successLogin: 'Signed in successfully.',
    successRegister: 'Account created. Check your email to verify it before signing in.',
    successEmailVerified: 'Email verified. You can sign in now.',
    accountDetailsHeading: 'Account details',
    accountSettingsHeading: 'Account settings',
    accountSettingsCopy: 'Manage your email, password, and linked sign-in methods.',
    changeEmailHeading: 'Change email',
    changeEmailCopy: 'Updating your email sends a new verification link to that address.',
    newEmail: 'New email',
    changeEmailSubmit: 'Update email',
    changePasswordHeading: 'Change password',
    setPasswordHeading: 'Add a password',
    changePasswordCopy: 'Use 8 or more characters with at least one number and one special character.',
    currentPassword: 'Current password',
    currentPasswordOptional: 'Current password (not required yet)',
    changePasswordSubmit: 'Update password',
    setPasswordSubmit: 'Save password',
    connectDiscordHeading: 'Discord connection',
    connectDiscordCopy: 'Link Discord to sign in faster and keep your account connected.',
    connectDiscordSubmit: 'Connect Discord',
    discordLinked: 'Discord connected',
    discordNotLinked: 'Discord not connected',
    errors: {
      generic: 'Something went wrong. Please try again.',
      discordIgnRequired: 'Enter your IGN before continuing with Discord.',
      discordSessionExpired: 'We could not finish the Discord sign-in. Please try again.',
      resetTokenMissing: 'Password reset link is missing. Request a new reset link.',
      passwordMismatch: 'Passwords do not match.',
    },
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
        eventOps: 'Event Operations',
        liveCoordination: 'Live Coordination',
      },
      catchEventsCard: {
        title: 'Catch Event Manager',
        description:
          'Create catch events, collect player submissions, calculate species and nature bonuses, and generate ranked winner output for staff review.',
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
    catchEventManager,
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
        checkedVote: 'checked',
        pendingVote: 'found Feebas on',
        confirmedVote: 'confirmed Feebas on',
      },
      general: {
        anonymousName: 'Anonymous',
        optionalDisplayName: 'Temporary display name',
        displayNamePlaceholder: 'Anonymous Feebas Hunter',
        signedInAs: 'Currently signed in as {ign}',
        signInToTrackLeaderboardStats: 'Sign in to track leaderboard statistics',
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
      notifications: {
        pendingNominationTitle: 'Pending nomination',
        pendingNominationBody: '{actorName} nominated {tileLabel} at {location}.',
        pendingNominationSelfTitle: 'Nomination sent',
        pendingNominationSelfBody: 'Your nomination for {tileLabel} at {location} has notified everyone here.',
        dismiss: 'Dismiss notification',
      },
      heatmap: {
        toggleLabel: 'Board display mode',
        votingMode: 'Voting',
        heatmapMode: 'Heatmap',
        shortcutLabel: 'Shortcut: {key}',
        changeShortcut: 'Change',
        resetShortcut: 'Reset',
        shortcutCaptureHint: 'Press a key',
        invalidShortcut: 'Use a single non-space key without modifiers.',
        lowLegend: 'Low history',
        highLegend: 'High history',
        description: 'Historical confirmed Feebas tiles glow brighter as more past confirmations stack up.',
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
        previousPage: 'Previous',
        nextPage: 'Next',
        pageStatus: 'Page {current} of {total}',
        emptyState: 'Tile changes will appear here as players shape the board together.',
      },
      leaderboard: {
        heading: 'Feebas Leaderboard',
        description: 'Logged-in contributors ranked by verified discoveries, uptime created, confirmations, and search coverage.',
        emptyState: 'Leaderboard stats appear after signed-in players contribute to verified Feebas cycles.',
        columns: {
          rank: 'Rank',
          trainer: 'Trainer',
          weeklyScore: 'Weekly',
          allTimeScore: 'All-time',
          discoveries: 'Discoveries',
          uptime: 'Uptime',
          confirmations: 'Confirms',
          coverage: 'Coverage',
          accuracy: 'Accuracy',
          efficiency: 'Efficiency',
          streak: 'Streak',
        },
        tooltips: {
          rank: 'Current position after applying the selected leaderboard sort.',
          trainer: 'Signed-in account IGN. Only activity submitted while logged in is counted.',
          weeklyScore:
            'Score from the last 7 days: verified discoveries x100, uptime hours, confirmations x25, and search coverage x2.',
          allTimeScore:
            'Lifetime score: verified discoveries x100, uptime hours, confirmations x25, and search coverage x2.',
          discoveries:
            'Unique tiles where this player was the first logged-in pending reporter and the tile was later confirmed.',
          uptime:
            'Community uptime created by verified discoveries: minutes remaining in the cycle after the report multiplied by active logged-in contributors in that cycle.',
          confirmations:
            'Unique cycle/tile confirmations submitted by this logged-in player.',
          coverage:
            'Unique cycle/tile checks or pending reports submitted by this logged-in player.',
          accuracy:
            'Verified pending reports divided by pending reports that were later resolved as confirmed or no Feebas.',
          efficiency:
            'Verified discoveries divided by search coverage.',
          streak:
            'Consecutive recent Feebas cycles where this player made at least one logged-in contribution.',
        },
        notables: {
          heading: 'Tracked records',
          fastestFinder: 'Fastest finder',
          earlyScout: 'Early scout',
          mostPersistent: 'Most persistent',
          noData: 'No verified find yet',
          fastestValue: '{ign} in {value}',
          checksValue: '{ign} after {value} tile(s)',
        },
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

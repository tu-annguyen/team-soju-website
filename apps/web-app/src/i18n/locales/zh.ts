const zh = {
  meta: {
    defaultTitle: 'Team Soju - PokeMMO 团队',
    defaultDescription: 'Team Soju 是一个重视社区、实力与对 Pokemon 对战热情的 PokeMMO 团队。',
  },
  nav: {
    home: '首页',
    shinyShowcase: '闪光展示',
    events: '活动',
    tools: '工具',
    forum: '论坛',
    discord: 'Discord',
    toggleMenu: '切换菜单',
  },
  footer: {
    blurb: '一个不断成长的 PokeMMO 团队，由新老玩家共同组成，致力于建立友好活跃的社区。',
    linksTitle: '链接',
    joinTitle: '加入我们',
    joinDescription: '想加入 Team Soju 吗？我们一直在寻找优秀的训练家。',
    applyNow: '立即申请',
    rightsReserved: '保留所有权利。',
    legal:
      'Pokemon 是 Nintendo、Creatures, Inc. 和 GAME FREAK inc. 的注册商标。本网站与 Nintendo、Creatures, Inc.、GAME FREAK inc. 或 PokeMMO 无任何隶属关系。',
  },
  home: {
    title: 'Team Soju - PokeMMO 团队',
    description:
      'Team Soju 是一个不断成长的 PokeMMO 团队，致力于建立由新老玩家共同组成的友好社区。我们主要专注于 PvE 和闪光狩猎，同时也有热衷 PvP 的成员。건배!',
    hero: {
      headingPrefix: '欢迎来到',
      headingHighlight: 'Team Soju',
      body:
        'Team Soju 是一个不断成长的 PokeMMO 团队，致力于建立由新老玩家共同组成的友好社区。我们主要专注于 PvE 和闪光狩猎，同时也有热衷 PvP 的成员。건배!',
      primaryCta: '立即申请',
      secondaryCta: '加入 Discord',
      logoAlt: 'Team Soju 标志',
    },
  },
  tools: {
    index: {
      title: '工具 - Team Soju',
      description: '探索 Team Soju 为社区制作的工具与实用程序。',
      eyebrow: '工具',
      heading: '工具',
      intro: '为 PokeMMO 社区打造的实用工具，帮助大家更快协作、更聪明地游玩。',
      availableTitle: '可用工具',
      availableDescription: '进入我们用来组织狩猎、分享进度并让大家保持同步的工具。',
      openTool: '打开工具',
      categories: {
        liveCoordination: '实时协作',
      },
      feebasCard: {
        title: '丑丑鱼格子追踪器',
        description:
          '通过共享棋盘实时协调 丑丑鱼 格子检查，可标记为已检查、发现或已确认。每次标记都会叠加半透明颜色，让棋盘像团队判断的实时热力图。',
      },
    },
    feebas: {
      title: '丑丑鱼 格子检查器 - Team Soju',
      description: '使用共享棋盘实时协调 丑丑鱼 格子检查。',
      eyebrow: '实时协作工具',
      heading: '丑丑鱼 格子检查器',
      intro:
        '实时协调 丑丑鱼 格子检查。你可以将格子投票为已检查、待确认或已确认。每一票都会以 25% 不透明度叠加颜色，让棋盘呈现团队判断的实时热力图。',
    },
    feebasChecker: {
      locationsTabLabel: '丑丑鱼地点',
      locations: {
        route119: {
          tabLabel: '119 号道路',
          displayName: '119 号道路，豐緣',
        },
        mtCoronet: {
          tabLabel: '天冠山',
          displayName: '天冠山，神奧',
        },
      },
      status: {
        unchecked: '未检查',
        checked: '已检查',
        pending: '发现丑丑鱼',
        confirmed: '确认丑丑鱼',
      },
      voteSummary: {
        checked: '已检查',
        pending: '待确认',
        confirmed: '已确认',
      },
      actions: {
        clearedVote: '清除了对以下格子的投票',
        checkedVote: '检查了',
        pendingVote: '在以下格子发现了丑丑鱼',
        confirmedVote: '确认以下格子有丑丑鱼',
      },
      general: {
        anonymousName: '匿名',
        optionalDisplayName: '可选显示名称',
        displayNamePlaceholder: '匿名丑丑鱼猎人',
        nextReset: '下次重置',
        resetsEvery: '每 {minutes} 分钟实时重置一次',
        rules:
          '每个浏览器在每个格子上只能保留一个有效投票。每个格子同一时间只能有一个待确认提名，发起待确认标记的玩家不能自己确认它。',
        scrollHint: '左右滚动可查看完整棋盘。',
        mixedVotesHint: '颜色混合表示团队意见不一致。投票越多，格子的覆盖色就越明显。',
        loadingBoard: '正在加载丑丑鱼棋盘...',
      },
      boardStatus: {
        heading: '棋盘状态',
        checkedTiles: '已检查格子',
        pendingTiles: '待确认丑丑鱼格子',
        confirmedTiles: '已确认丑丑鱼格子',
      },
      selectedTile: {
        heading: '已选格子',
        tileLabel: '格子',
        leadingStatus: '当前主状态：{status}',
        checkedVotes: '{count} 个已检查投票',
        pendingVotes: '{count} 个待确认投票',
        confirmedVotes: '{count} 个已确认投票',
        yourVote: '你的投票：{status}',
        noFeebas: '没有丑丑鱼',
        feebasFound: '发现丑丑鱼',
        feebasConfirmed: '确认丑丑鱼',
        clearVote: '清除我的投票',
        needsPendingBeforeConfirm: '该格子至少需要一个待确认投票后，才能进行确认投票。',
        pendingOwnerHint: '当前待确认投票是你发起的，因此需要其他玩家来确认，或者你可以清除自己的待确认标记。',
        otherPendingHint: '该格子已经有其他玩家发起待确认提名，所以你只能将其处理为已检查或已确认。',
        emptyState: '请选择一个格子来投票或清除投票。',
      },
      activity: {
        heading: '活动记录',
        emptyState: '当玩家共同更新棋盘时，格子变更会显示在这里。',
      },
      errors: {
        loadBoard: '无法加载丑丑鱼棋盘',
        refreshBoard: '无法刷新丑丑鱼棋盘',
        updateTile: '无法更新丑丑鱼格子',
        liveUpdatesDisconnected: '实时更新已断开。棋盘稍后会再次刷新。',
      },
    },
  },
} as const;

export default zh;

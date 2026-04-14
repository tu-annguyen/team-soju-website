const es = {
  meta: {
    defaultTitle: 'Team Soju - Equipo de PokeMMO',
    defaultDescription:
      'Team Soju es un equipo de PokeMMO dedicado a la comunidad, la excelencia y la emocion de las batallas competitivas de Pokemon.',
  },
  nav: {
    home: 'Inicio',
    shinyShowcase: 'Vitrina de Shinies',
    events: 'Eventos',
    tools: 'Herramientas',
    forum: 'Foro',
    discord: 'Discord',
    toggleMenu: 'Abrir o cerrar menu',
  },
  footer: {
    blurb:
      'Un equipo de PokeMMO en crecimiento dedicado a formar una comunidad de amigos diversa, con una buena mezcla de jugadores veteranos y nuevos.',
    linksTitle: 'Enlaces',
    joinTitle: 'Unete',
    joinDescription:
      'Te interesa unirte a Team Soju? Siempre buscamos entrenadores con talento.',
    applyNow: 'Postulate',
    rightsReserved: 'Todos los derechos reservados.',
    legal:
      'Pokemon es una marca registrada de Nintendo, Creatures, Inc. y GAME FREAK inc. Este sitio web no esta afiliado con Nintendo, Creatures, Inc., GAME FREAK inc. ni PokeMMO.',
  },
  home: {
    title: 'Team Soju - Equipo de PokeMMO',
    description:
      'Team Soju es un equipo de PokeMMO en crecimiento dedicado a formar una comunidad de amigos diversa, con una buena mezcla de jugadores veteranos y nuevos. Somos un equipo PvE enfocado principalmente en la caza de shinies, aunque tambien contamos con jugadores dedicados al PvP. 건배!',
    hero: {
      headingPrefix: 'Bienvenido a',
      headingHighlight: 'Team Soju',
      body:
        'Team Soju es un equipo de PokeMMO en crecimiento dedicado a formar una comunidad de amigos diversa, con una buena mezcla de jugadores veteranos y nuevos. Somos un equipo PvE enfocado principalmente en la caza de shinies, aunque tambien contamos con jugadores dedicados al PvP. 건배!',
      primaryCta: 'Postulate',
      secondaryCta: 'Unete a Discord',
      logoAlt: 'Logo de Team Soju',
    },
  },
  tools: {
    index: {
      title: 'Herramientas - Team Soju',
      description: 'Explora las herramientas y utilidades de la comunidad de Team Soju.',
      eyebrow: 'Herramientas',
      heading: 'Herramientas',
      intro:
        'Utilidades creadas para la comunidad de PokeMMO para coordinarse mas rapido y jugar mejor.',
      availableTitle: 'Herramientas disponibles',
      availableDescription:
        'Entra en las herramientas que usamos para organizar hunts, compartir progreso y mantener a todos alineados.',
      openTool: 'Abrir herramienta',
      categories: {
        liveCoordination: 'Coordinacion en vivo',
      },
      feebasCard: {
        title: 'Rastreador de casillas de Feebas',
        description:
          'Coordina las comprobaciones de casillas de Feebas en tiempo real con un tablero compartido para casillas revisadas, encontradas o confirmadas. Cada marca usa un color translucido para que el tablero funcione como un mapa de calor de la opinion del grupo.',
      },
    },
    feebas: {
      title: 'Comprobador de casillas de Feebas - Team Soju',
      description: 'Coordina las comprobaciones de casillas de Feebas en vivo con un tablero compartido.',
      eyebrow: 'Herramienta de coordinacion en vivo',
      heading: 'Comprobador de casillas de Feebas',
      intro:
        'Coordina las comprobaciones de casillas de Feebas en tiempo real. Vota las casillas como revisadas, pendientes o confirmadas. Los colores se acumulan al 25% de opacidad por voto para que el tablero funcione como un mapa de calor de la opinion del grupo.',
    },
    feebasChecker: {
      locationsTabLabel: 'Ubicaciones de Feebas',
      locations: {
        route119: {
          tabLabel: 'Ruta 119',
          displayName: 'Ruta 119, Hoenn',
        },
        mtCoronet: {
          tabLabel: 'Monte Corona',
          displayName: 'Monte Corona, Sinnoh',
        },
      },
      status: {
        unchecked: 'Sin revisar',
        checked: 'Revisada',
        pending: 'Feebas encontrado',
        confirmed: 'Feebas confirmado',
      },
      voteSummary: {
        checked: 'revisadas',
        pending: 'pendientes',
        confirmed: 'confirmadas',
      },
      actions: {
        clearedVote: 'quito su voto de',
        checkedVote: 'reviso',
        pendingVote: 'encontro a Feebas en',
        confirmedVote: 'confirmo a Feebas en',
      },
      general: {
        anonymousName: 'Anonimo',
        optionalDisplayName: 'Nombre visible opcional',
        displayNamePlaceholder: 'Cazador anonimo de Feebas',
        nextReset: 'Siguiente reinicio',
        resetsEvery: 'Se reinicia cada {minutes} minutos en tiempo real',
        rules:
          'Cada navegador puede mantener un voto activo por casilla. Solo puede existir una nominacion pendiente por casilla, y quien la marco como pendiente no puede confirmarla.',
        scrollHint: 'Desplazate lateralmente para ver todo el tablero.',
        mixedVotesHint:
          'Los colores mezclados significan opiniones mezcladas. Mas votos hacen que la capa de una casilla se vea mas fuerte.',
        loadingBoard: 'Cargando el tablero de Feebas...',
      },
      boardStatus: {
        heading: 'Estado del tablero',
        checkedTiles: 'Casillas revisadas',
        pendingTiles: 'Casillas de Feebas pendientes',
        confirmedTiles: 'Casillas de Feebas confirmadas',
      },
      selectedTile: {
        heading: 'Casilla seleccionada',
        tileLabel: 'Casilla',
        leadingStatus: 'Estado principal: {status}',
        checkedVotes: '{count} voto(s) revisada(s)',
        pendingVotes: '{count} voto(s) pendiente(s)',
        confirmedVotes: '{count} voto(s) confirmada(s)',
        yourVote: 'Tu voto: {status}',
        noFeebas: 'No hay Feebas',
        feebasFound: 'Feebas encontrado',
        feebasConfirmed: 'Feebas confirmado',
        clearVote: 'Quitar mi voto',
        needsPendingBeforeConfirm:
          'Esta casilla necesita al menos un voto pendiente antes de permitir votos confirmados.',
        pendingOwnerHint:
          'Tu colocaste el voto pendiente activo, asi que otro jugador puede confirmarlo, o puedes quitar tu marca pendiente.',
        otherPendingHint:
          'Otro jugador ya tiene la nominacion pendiente en esta casilla, asi que solo puedes resolverla como revisada o confirmada.',
        emptyState: 'Selecciona una casilla para votar o quitar tu voto.',
      },
      activity: {
        heading: 'Actividad',
        emptyState: 'Los cambios de casillas apareceran aqui mientras los jugadores dan forma al tablero juntos.',
      },
      errors: {
        loadBoard: 'No se pudo cargar el tablero de Feebas',
        refreshBoard: 'No se pudo actualizar el tablero de Feebas',
        updateTile: 'No se pudo actualizar la casilla de Feebas',
        liveUpdatesDisconnected:
          'Las actualizaciones en vivo se desconectaron. El tablero volvera a refrescarse pronto.',
      },
    },
  },
} as const;

export default es;

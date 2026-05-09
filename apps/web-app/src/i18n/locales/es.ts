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
    language: 'Idioma',
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
        optionalDisplayName: 'Nombre visualización temporal',
        displayNamePlaceholder: 'Cazador anonimo de Feebas',
        signedInAs: 'Sesion iniciada como {ign}',
        signInToTrackLeaderboardStats: 'Inicia sesion para registrar estadisticas de clasificacion',
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
      heatmap: {
        toggleLabel: 'Modo de visualizacion del tablero',
        votingMode: 'Votacion',
        heatmapMode: 'Mapa de calor',
        lowLegend: 'Poco historial',
        highLegend: 'Mucho historial',
        description: 'Las casillas confirmadas historicamente brillan mas fuerte mientras se acumulan confirmaciones pasadas.',
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
        previousPage: 'Anterior',
        nextPage: 'Siguiente',
        pageStatus: 'Pagina {current} de {total}',
        emptyState: 'Los cambios de casillas apareceran aqui mientras los jugadores dan forma al tablero juntos.',
      },
      leaderboard: {
        heading: 'Clasificacion de Feebas',
        description:
          'Contribuidores con sesion iniciada ordenados por descubrimientos verificados, tiempo activo creado, confirmaciones y cobertura de busqueda.',
        emptyState:
          'Las estadisticas de la clasificacion apareceran despues de que jugadores con sesion iniciada contribuyan a ciclos verificados de Feebas.',
        columns: {
          rank: 'Puesto',
          trainer: 'Entrenador',
          weeklyScore: 'Semanal',
          allTimeScore: 'Historico',
          discoveries: 'Hallazgos',
          uptime: 'Tiempo activo',
          confirmations: 'Confirma',
          coverage: 'Cobertura',
          accuracy: 'Precision',
          efficiency: 'Eficiencia',
          streak: 'Racha',
        },
        tooltips: {
          rank: 'Posicion actual despues de aplicar el orden seleccionado de la clasificacion.',
          trainer: 'IGN de la cuenta con sesion iniciada. Solo cuenta la actividad enviada con sesion iniciada.',
          weeklyScore:
            'Puntuacion de los ultimos 7 dias: descubrimientos verificados x100, horas de tiempo activo, confirmaciones x25 y cobertura de busqueda x2.',
          allTimeScore:
            'Puntuacion historica: descubrimientos verificados x100, horas de tiempo activo, confirmaciones x25 y cobertura de busqueda x2.',
          discoveries:
            'Casillas unicas donde este jugador fue el primer reportero pendiente con sesion iniciada y la casilla luego fue confirmada.',
          uptime:
            'Tiempo activo comunitario creado por descubrimientos verificados: minutos restantes del ciclo despues del reporte multiplicados por contribuidores activos con sesion iniciada en ese ciclo.',
          confirmations:
            'Confirmaciones unicas de ciclo/casilla enviadas por este jugador con sesion iniciada.',
          coverage:
            'Comprobaciones de ciclo/casilla o reportes pendientes unicos enviados por este jugador con sesion iniciada.',
          accuracy:
            'Reportes pendientes verificados divididos por todos los reportes pendientes enviados por este jugador con sesion iniciada.',
          efficiency:
            'Descubrimientos verificados divididos por cobertura de busqueda.',
          streak:
            'Ciclos recientes consecutivos de Feebas en los que este jugador hizo al menos una contribucion con sesion iniciada.',
        },
        notables: {
          heading: 'Records registrados',
          fastestFinder: 'Buscador mas rapido',
          luckyFinder: 'Buscador con mas suerte',
          mostPersistent: 'Mas persistente',
          noData: 'Aun no hay hallazgos verificados',
          fastestValue: '{ign} en {value}',
          checksValue: '{ign} despues de {value} casilla(s)',
        },
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

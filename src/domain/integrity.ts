import { Tournament, Match, Player } from './tournament';

export const TOURNAMENT_LIMITS = {
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 64,
  MAX_TOURNAMENT_NAME_LENGTH: 60,
  MIN_TOURNAMENT_NAME_LENGTH: 2,
  MAX_PLAYER_NAME_LENGTH: 32,
  MIN_PLAYER_NAME_LENGTH: 1,
  MAX_ROUNDS: 50,
  MAX_MATCHES: 500,
  MAX_POINTS_PER_MATCH: 100,
  VALID_FORMATS: ['americano', 'mexicano', 'king'] as const,
  VALID_STATUSES: ['active', 'completed', 'draft'] as const
};

export interface TournamentIntegrityResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateTournamentIntegrity(tournament: Tournament | any): TournamentIntegrityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tournament || typeof tournament !== 'object') {
    return {
      isValid: false,
      errors: ['El torneo no es un objeto válido.'],
      warnings: []
    };
  }

  // 1. Basic properties and name limits
  if (!tournament.id || typeof tournament.id !== 'string') {
    errors.push('El torneo carece de un ID válido.');
  }

  if (!tournament.name || typeof tournament.name !== 'string') {
    errors.push('El nombre del torneo es obligatorio.');
  } else {
    const trimmed = tournament.name.trim();
    if (trimmed.length < TOURNAMENT_LIMITS.MIN_TOURNAMENT_NAME_LENGTH) {
      errors.push(`El nombre del torneo debe tener al menos ${TOURNAMENT_LIMITS.MIN_TOURNAMENT_NAME_LENGTH} caracteres.`);
    } else if (trimmed.length > TOURNAMENT_LIMITS.MAX_TOURNAMENT_NAME_LENGTH) {
      errors.push(`El nombre del torneo no puede superar ${TOURNAMENT_LIMITS.MAX_TOURNAMENT_NAME_LENGTH} caracteres.`);
    }
  }

  // 2. Format & Status
  if (!TOURNAMENT_LIMITS.VALID_FORMATS.includes(tournament.type)) {
    errors.push(`Formato desconocido "${tournament.type}". Valores permitidos: ${TOURNAMENT_LIMITS.VALID_FORMATS.join(', ')}.`);
  }

  const tournamentStatus = tournament.status || 'active';
  if (!TOURNAMENT_LIMITS.VALID_STATUSES.includes(tournamentStatus)) {
    errors.push(`Estado desconocido "${tournamentStatus}". Valores permitidos: ${TOURNAMENT_LIMITS.VALID_STATUSES.join(', ')}.`);
  }

  // 3. Players list verification
  const players: Player[] = Array.isArray(tournament.players) ? tournament.players : [];
  if (players.length < TOURNAMENT_LIMITS.MIN_PLAYERS) {
    errors.push(`Se requieren al menos ${TOURNAMENT_LIMITS.MIN_PLAYERS} jugadores (actual: ${players.length}).`);
  } else if (players.length > TOURNAMENT_LIMITS.MAX_PLAYERS) {
    errors.push(`El límite máximo es de ${TOURNAMENT_LIMITS.MAX_PLAYERS} jugadores (actual: ${players.length}).`);
  }

  const seenPlayerIds = new Set<string>();
  const seenPlayerNames = new Set<string>();

  players.forEach((p, idx) => {
    if (!p || typeof p !== 'object' || !p.id) {
      errors.push(`El jugador #${idx + 1} tiene un identificador no válido.`);
      return;
    }
    if (seenPlayerIds.has(p.id)) {
      errors.push(`ID de jugador duplicado detectado: "${p.id}".`);
    }
    seenPlayerIds.add(p.id);

    const name = (p.name || '').trim();
    if (!name || name.length < TOURNAMENT_LIMITS.MIN_PLAYER_NAME_LENGTH) {
      errors.push(`El jugador con ID "${p.id}" tiene un nombre vacío.`);
    } else if (name.length > TOURNAMENT_LIMITS.MAX_PLAYER_NAME_LENGTH) {
      warnings.push(`El nombre "${name.slice(0, 15)}..." supera los ${TOURNAMENT_LIMITS.MAX_PLAYER_NAME_LENGTH} caracteres recomendados.`);
    }

    const lowerName = name.toLowerCase();
    if (seenPlayerNames.has(lowerName)) {
      warnings.push(`Existe más de un jugador con el nombre "${name}".`);
    }
    seenPlayerNames.add(lowerName);
  });

  // 4. Matches verification
  const matches: Match[] = Array.isArray(tournament.matches) ? tournament.matches : [];
  if (matches.length > TOURNAMENT_LIMITS.MAX_MATCHES) {
    errors.push(`El número de partidos (${matches.length}) excede el límite máximo de ${TOURNAMENT_LIMITS.MAX_MATCHES}.`);
  }

  const matchIds = new Set<string>();
  let highestRound = 0;

  matches.forEach((m, idx) => {
    if (!m || typeof m !== 'object') {
      errors.push(`El partido #${idx + 1} no es un objeto válido.`);
      return;
    }

    if (!m.id) {
      errors.push(`El partido #${idx + 1} no tiene un ID asignado.`);
    } else {
      if (matchIds.has(m.id)) {
        errors.push(`ID de partido duplicado: "${m.id}".`);
      }
      matchIds.add(m.id);
    }

    if (typeof m.round !== 'number' || m.round < 1) {
      errors.push(`El partido "${m.id || idx}" tiene una ronda inválida (${m.round}).`);
    } else {
      if (m.round > highestRound) highestRound = m.round;
      if (m.round > TOURNAMENT_LIMITS.MAX_ROUNDS) {
        errors.push(`El partido "${m.id}" supera el máximo de rondas permitidas (${TOURNAMENT_LIMITS.MAX_ROUNDS}).`);
      }
    }

    // Teams validation
    const team1 = Array.isArray(m.team1) ? m.team1 : [];
    const team2 = Array.isArray(m.team2) ? m.team2 : [];

    if (team1.length !== 2 || team2.length !== 2) {
      errors.push(`El partido "${m.id}" debe tener exactamente 2 jugadores por pareja.`);
    }

    const matchPlayerIds = [...team1, ...team2];
    const uniqueMatchPlayers = new Set(matchPlayerIds);

    if (uniqueMatchPlayers.size !== matchPlayerIds.length) {
      errors.push(`El partido "${m.id}" contiene un jugador repetido en la misma pista.`);
    }

    // Verify all players exist in tournament.players
    matchPlayerIds.forEach(pId => {
      if (!seenPlayerIds.has(pId)) {
        errors.push(`El partido "${m.id}" referencia a un jugador con ID "${pId}" que no figura en la lista de jugadores.`);
      }
    });

    // Score validation
    if (m.score1 !== null && m.score1 !== undefined) {
      if (typeof m.score1 !== 'number' || isNaN(m.score1) || m.score1 < 0) {
        errors.push(`El marcador 1 del partido "${m.id}" no es un número positivo válido.`);
      }
    }
    if (m.score2 !== null && m.score2 !== undefined) {
      if (typeof m.score2 !== 'number' || isNaN(m.score2) || m.score2 < 0) {
        errors.push(`El marcador 2 del partido "${m.id}" no es un número positivo válido.`);
      }
    }
    if ((m.score1 !== null && m.score2 === null) || (m.score1 === null && m.score2 !== null)) {
      errors.push(`El partido "${m.id}" tiene un marcador incompleto (solo un equipo tiene puntuación).`);
    }

    // Playoff progression validation
    if (m.isPlayoff) {
      const validPlayoffTypes = ['quarterfinal', 'semifinal', 'third_place', 'final'];
      if (m.playoffType && !validPlayoffTypes.includes(m.playoffType)) {
        errors.push(`Tipo de playoff no reconocido "${m.playoffType}" en el partido "${m.id}".`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

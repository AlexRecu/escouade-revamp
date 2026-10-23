import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWorld } from './api/client';
import { getToken, getUsername, clearSession, getPlayerId } from './api/auth';
import type { WorldSummary, Hub } from './types/world';
import WorldTree from './components/WorldTree';
import City from './components/City';
import DungeonView from './components/DungeonView';
import CombatView from './components/CombatView';
import AuthScreen from './components/AuthScreen';
import PartySidebar from './components/PartySidebar';
import LobbyScreen from './components/LobbyScreen';
import CharacterCreationScreen from './components/CharacterCreationScreen';
import StatChoiceModal from './components/StatChoiceModal';
import CharacterDetailModal from './components/CharacterDetailModal';
import { useGame } from './game/useGame';

type View =
  | { name: 'world' }
  | { name: 'city'; hub: Hub }
  | { name: 'dungeon'; dungeonId: string };

function App() {
  // Session (JWT) : null = pas connecté → écran d'auth.
  const [user, setUser] = useState<string | null>(() =>
    getToken() ? getUsername() : null
  );
  const [world, setWorld] = useState<WorldSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: 'world' });
  // Membre sélectionné pour le panneau de détail (id, null = fermé).
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  // Menu déroulant du bandeau (bouton pseudo → Changer de partie / Déconnexion).
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Partie temps réel (socket) : levée ici pour que l'équipe soit visible
  // sur la mappemonde ET en ville (colonne latérale permanente). Le token est
  // passé en paramètre : quand il devient disponible (premier login), le
  // socket est re-connecté avec le JWT (sinon il serait refusé par le back).
  const { state, logs: gameLogs, connected, actions, rooms, error: gameError, inRoom, exploration, combat, pendingLevelUps, setExplorationExitedHandler, setAuthErrorHandler } = useGame(getToken());

  // Identité du joueur connecté (pour savoir s'il a déjà un personnage dans
  // la partie, et s'il est spectateur).
  const myPlayerId = useMemo(() => getPlayerId(), []);
  const hasCharacter = useMemo(
    () => (state?.party.members ?? []).some((m) => m.ownerId === myPlayerId),
    [state, myPlayerId]
  );
  const isSpectator = useMemo(
    () => state?.room?.members.find((m) => m.playerId === myPlayerId)?.isSpectator ?? false,
    [state, myPlayerId]
  );
  // Ferme le menu déroulant quand on clique en dehors.
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);
  // Membre sélectionné (pour le panneau de détail) — résolu depuis l'état.
  // Pendant le donjon, l'état de ville n'est pas mis à jour : on fusionne les
  // données d'exploration (XP, PV, niveau…) sur le membre de base, comme le
  // fait `PartySidebar`.
  const selectedMember = useMemo(() => {
    if (!selectedMemberId) return null;
    const base = (state?.party.members ?? []).find((m) => m.id === selectedMemberId);
    if (!base) return null;
    const exp = exploration?.party.members.find((e) => e.id === base.id);
    if (!exp) return base;
    return {
      ...base,
      level: exp.level ?? base.level,
      xp: exp.xp ?? base.xp,
      xpToNext: exp.xpToNext ?? base.xpToNext,
      xpNeeded: exp.xpNeeded ?? base.xpNeeded,
      hp: exp.hp,
      maxHp: exp.maxHp,
      mp: exp.mp,
      maxMp: exp.maxMp,
      isDead: exp.isDead,
      // Détails de fiche à jour pendant le donjon (coffres, équipement, soins).
      avatar: exp.avatar ?? base.avatar,
      equippableWeapons: exp.equippableWeapons ?? base.equippableWeapons,
      canDualWield: exp.canDualWield ?? base.canDualWield,
      stats: exp.stats ?? base.stats,
      skills: exp.skills ?? base.skills,
      spells: exp.spells ?? base.spells,
      rightHand: exp.rightHand ?? base.rightHand,
      leftHand: exp.leftHand ?? base.leftHand,
      bag: exp.bag ?? base.bag,
    };
  }, [selectedMemberId, state, exploration]);
  // Dans une partie, sans personnage, et non spectateur → écran de création.
  const needsCharacter = inRoom && !hasCharacter && !isSpectator;

  // Auto-sortie : quand le donjon est terminé (porte de sortie atteinte), le
  // serveur émet `exploration:exited` → on revient à la mappemonde.
  useEffect(() => {
    setExplorationExitedHandler(() => setView({ name: 'world' }));
  }, [setExplorationExitedHandler]);

  // Ville dans laquelle on est en train d'entrer (id de hub). Sert à ne pas
  // annuler l'entrée en ville pendant la fenêtre avant la réponse du serveur
  // (voir l'effet de synchro ci-dessous).
  const pendingCityRef = useRef<string | null>(null);

  // Fin de voyage en caravane : quand le hub de base change alors qu'on est
  // en ville, on revient sur la **mappemonde** (pas dans la ville). Le joueur
  // choisit alors d'entrer en ville ou de repartir à l'aventure. (Le seul
  // moyen de changer de hub en ville est la caravane — `changeHub` est bloqué
  // pour les autres villes.) On ignore le cas où on vient de demander
  // d'entrer dans la ville `view.hub` (sortie de zone) : le serveur n'a pas
  // encore confirmé, `state.hub` est encore l'ancien hub.
  useEffect(() => {
    if (view.name !== 'city' || !state?.hub) return;
    // Le serveur a confirmé l'entrée dans la ville `view.hub` → on peut
    // effacer la ville cible en attente.
    if (state.hub.id === view.hub.id) {
      pendingCityRef.current = null;
      return;
    }
    // Le hub de base a changé vers une autre ville (caravane) → mappemonde.
    // On ignore le cas où on vient de demander d'entrer dans `view.hub`
    // (sortie de zone) : le serveur n'a pas encore confirmé.
    if (view.hub.id !== pendingCityRef.current) {
      setView({ name: 'world' });
    }
  }, [state?.hub, view]);

  // Token expiré / invalide : le socket est refusé → on renvoie vers l'écran
  // de connexion (re-login) au lieu de rester bloqué sur « Connexion… ».
  useEffect(() => {
    setAuthErrorHandler(() => {
      clearSession();
      setUser(null);
      setWorld(null);
      setView({ name: 'world' });
    });
  }, [setAuthErrorHandler]);

  // Quand le joueur entre dans une partie (création / rejoindre), on repart
  // de la mappemonde. Quand il en sort (retour au lobby), idem.
  useEffect(() => {
    setView({ name: 'world' });
  }, [inRoom]);

  // **Source de vérité** : le niveau du monde, les zones terminées et le
  // bestiaire viennent de l'état serveur (state.party), pas d'un état local.
  // C'est ce qui garantit que la boutique (filtrée par worldLevel), la
  // mappemonde et le bestiaire restent synchronisés — et survivent au
  // rechargement de la page (persisté côté serveur).
  const worldLevel = state?.party.worldLevel ?? 0;
  const completedZones = useMemo(
    () => new Set(state?.party.completedZones ?? []),
    [state]
  );
  const seenMonsters = useMemo(
    () => new Set(state?.party.seenMonsters ?? []),
    [state]
  );
  // Villes visitées (brouillard de guerre des villes, source de vérité serveur).
  const visitedHubs = useMemo(
    () => new Set(state?.party.visitedHubs ?? []),
    [state]
  );
  // Hub de base (services de ville).
  const currentHubId = state?.hub.id ?? null;
  // Nœud de position (hub OU donjon) : le cercle blanc de la mappemonde suit
  // cette position. En ville c'est le hub ; dans une zone, l'id du donjon.
  const currentNodeId = state?.currentNodeId ?? state?.hub.id ?? null;

  useEffect(() => {
    if (!user) return;
    fetchWorld()
      .then(setWorld)
      .catch((e) => setError(e.message));
  }, [user]);

  const logout = () => {
    clearSession();
    setUser(null);
    setWorld(null);
    setView({ name: 'world' });
  };

  // Pas connecté → écran d'authentification.
  if (!user) {
    return (
      <AuthScreen
        onAuthed={(username) => {
          setUser(username);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>ESCOUADE</h1>
        {inRoom && state?.room ? (
          <span className="room-badge" title="Partie en cours">
            🎮 {state.room.name}
            <button
              className="room-icon"
              onClick={() => actions.partySave()}
              title="Sauvegarder la partie"
            >
              💾
            </button>
          </span>
        ) : (
          <span className="room-badge" title="Pas de partie en cours">
            ⚪ Hors ligne
          </span>
        )}
        <span className="spacer" />
        {view.name === 'city' && (
          <span className="subtitle">📍 {view.hub.name}</span>
        )}
        {view.name === 'dungeon' && exploration && (
          <span className="subtitle">
            ⚔️ {exploration.dungeonName} — Étage {exploration.floor}/{exploration.totalFloors}
          </span>
        )}
        <div className="user-menu" ref={userMenuRef}>
          <button
            className="user-menu-toggle"
            onClick={() => setUserMenuOpen((o) => !o)}
            title="Menu"
          >
            👤 {user} ▾
          </button>
          {userMenuOpen && (
            <div className="user-menu-dropdown">
              {inRoom && (
                <button
                  className="user-menu-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    actions.partyLeave();
                  }}
                >
                  Changer de partie
                </button>
              )}
              <button
                className="user-menu-item"
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="app-body">
        {/* Colonne latérale permanente : l'équipe (visible dans une partie). */}
        {inRoom && (
          <PartySidebar
            state={state}
            connected={connected}
            exploration={exploration}
            myPlayerId={myPlayerId}
            onSelectMember={(id) => setSelectedMemberId(id)}
          />
        )}
        <main className="app-main">
          {/* Pas dans une partie → écran de lobby (créer / rejoindre / spectateur). */}
          {!inRoom && (
            <LobbyScreen
              rooms={rooms}
              connected={connected}
              myPlayerId={myPlayerId}
              onCreate={(opts) => actions.partyCreate(opts)}
              onJoin={(roomId, isSpectator) => actions.partyJoin(roomId, isSpectator)}
              onDelete={(roomId) => actions.partyDelete(roomId)}
            />
          )}
          {inRoom && error && <div className="worldmap">Erreur : {error}</div>}
          {inRoom && !world && !error && <div className="worldmap">Chargement du monde…</div>}
          {inRoom && needsCharacter && (
            <CharacterCreationScreen
              defaultName={user ?? ''}
              error={gameError}
              onCreate={(data) => actions.partyCreateCharacter(data)}
            />
          )}
          {inRoom && !needsCharacter && world && view.name === 'world' && (
            <WorldTree
              world={world}
              completedZones={completedZones}
              visitedHubs={visitedHubs}
              worldLevel={worldLevel}
              seenMonsters={seenMonsters}
              currentHubId={currentHubId}
              currentNodeId={currentNodeId}
              onEnterHub={(hub) => {
                // Le serveur persiste le hub courant (position de l'équipe) —
                // c'est ce que le cercle blanc de la mappemonde suit. On note
                // la ville cible pour que l'effet de synchro caravane ne
                // l'annule pas avant la réponse du serveur.
                pendingCityRef.current = hub.id;
                actions.changeHub(hub.id);
                setView({ name: 'city', hub });
              }}
              onEnterDungeon={(dungeonId) => {
                // Entre dans le donjon : le serveur régénère la map (nouveau
                // seed) et renvoie l'état d'exploration via `exploration:state`.
                actions.explorationEnter(dungeonId);
                setView({ name: 'dungeon', dungeonId });
              }}
            />
          )}
          {inRoom && !needsCharacter && world && view.name === 'city' && (
            <City
              hub={view.hub}
              onBack={() => setView({ name: 'world' })}
              world={world}
              state={state}
              gameLogs={gameLogs}
              actions={actions}
            />
          )}
          {inRoom && !needsCharacter && view.name === 'dungeon' && (
            combat ? (
              <CombatView
                combat={combat}
                logs={gameLogs}
                onPlace={(unitId, position) => actions.combatPlace(unitId, position)}
                onConfirmPlacement={() => actions.combatConfirmPlacement()}
                onMove={(unitId, position) => actions.combatMove(unitId, position)}
                onAct={(unitId, action, targetId, extra) => actions.combatAct(unitId, action, targetId, extra)}
                onEndTurn={(unitId) => actions.combatEndTurn(unitId)}
                onAiStep={() => actions.combatAiStep()}
                onFlee={() => actions.combatFlee()}
              />
            ) : exploration ? (
              <DungeonView
                exploration={exploration}
                logs={gameLogs}
                onMove={(dir) => actions.explorationMove(dir)}
                onRest={() => actions.explorationRest()}
                onOpenChest={() => actions.explorationChest()}
              />
            ) : (
              <div className="worldmap">Entrée dans le donjon…</div>
            )
          )}
        </main>
      </div>
      {/* Écran de choix de stat (montée de niveau reportée après un combat). */}
      {inRoom && pendingLevelUps.length > 0 && (
        <StatChoiceModal
          levelUps={pendingLevelUps}
          onSubmit={(choices) => actions.combatSubmitStats(choices)}
        />
      )}
      {/* Panneau de détail d'un personnage (stats, compétences, sorts, équipement). */}
      {inRoom && selectedMember && (
        <CharacterDetailModal
          member={selectedMember}
          onClose={() => setSelectedMemberId(null)}
          actions={actions}
          inCombat={!!combat}
        />
      )}
    </div>
  );
}

export default App;

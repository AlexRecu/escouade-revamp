import React, { createContext, useReducer, useContext } from 'react';

// Initial game state based on the RPG document
const initialState = {
    party: [],
    currentLocation: 'qal-far', // Starting town
    gold: 100,
    inventory: [],
    quests: [],
    gamePhase: 'town', // town, dungeon, combat
    combatState: null,
    dungeonState: null,
    turnCounter: 0,
    eventLog: [],
};

// Game reducer to handle all actions
function gameReducer(state, action) {
    switch (action.type) {
        case 'ADD_CHARACTER':
            return {
                ...state,
                party: [...state.party, action.payload],
            };
        case 'REMOVE_CHARACTER':
            return {
                ...state,
                party: state.party.filter(char => char.id !== action.payload),
            };
        case 'SET_LOCATION':
            return {
                ...state,
                currentLocation: action.payload,
                gamePhase: 'town',
            };
        case 'ENTER_DUNGEON':
            return {
                ...state,
                gamePhase: 'dungeon',
                dungeonState: action.payload,
            };
        case 'START_COMBAT':
            return {
                ...state,
                gamePhase: 'combat',
                combatState: action.payload,
            };
        case 'END_COMBAT':
            return {
                ...state,
                gamePhase: action.payload.nextPhase || 'dungeon',
                combatState: null,
                party: action.payload.updatedParty || state.party,
                gold: state.gold + (action.payload.goldReward || 0),
                inventory: [...state.inventory, ...(action.payload.itemRewards || [])],
            };
        case 'UPDATE_PARTY':
            return {
                ...state,
                party: action.payload,
            };
        case 'ADD_ITEM':
            return {
                ...state,
                inventory: [...state.inventory, action.payload],
            };
        case 'USE_ITEM':
            return {
                ...state,
                inventory: state.inventory.filter(item => item.id !== action.payload.itemId),
                party: action.payload.updatedParty || state.party,
            };
        case 'MODIFY_GOLD':
            return {
                ...state,
                gold: Math.max(0, state.gold + action.payload),
            };
        case 'ADD_QUEST':
            return {
                ...state,
                quests: [...state.quests, action.payload],
            };
        case 'UPDATE_QUEST':
            return {
                ...state,
                quests: state.quests.map(quest =>
                    quest.id === action.payload.id ? { ...quest, ...action.payload } : quest
                ),
            };
        case 'LOG_EVENT':
            return {
                ...state,
                eventLog: [action.payload, ...state.eventLog].slice(0, 50), // Keep last 50 events
            };
        default:
            return state;
    }
}

// Create context
const GameContext = createContext();

// Provider component
export const GameProvider = ({ children }) => {
    const [state, dispatch] = useReducer(gameReducer, initialState);

    return (
        <GameContext.Provider value={{ state, dispatch }}>
            {children}
        </GameContext.Provider>
    );
};

// Custom hook to use the game context
export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
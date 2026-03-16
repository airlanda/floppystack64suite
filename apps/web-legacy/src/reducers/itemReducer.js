import { v4 as uuid } from "uuid";
import {
  GET_ITEMS,
  DELETE_ITEM,
  ADD_ITEM,
  ITEMS_LOADING,
  FILTER_DISKS,
  UPDATE_GAME_RATING_OPTIMISTIC,
  UPDATE_GAME_RATING_ROLLBACK,
} from "../actions/types";

// State goes here
const initialState = {
  itemsArrayInsideState: [],
  loading: false,
  originalList: [],
};

function patchRatingInDiskList(list, payload, mode = "set") {
  if (!Array.isArray(list)) return list;

  const { diskId, side, gameIndex, gameName } = payload || {};
  const nextRating =
    mode === "rollback" ? payload?.previousRating : payload?.rating;

  return list.map((disk) => {
    if (!disk || String(disk._id) !== String(diskId)) return disk;
    if (!["sideA", "sideB"].includes(side)) return disk;

    const games = Array.isArray(disk[side]) ? disk[side] : [];
    const idx = Number(gameIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= games.length) return disk;

    const target = games[idx];
    const targetName =
      target && typeof target === "object" ? target.gameName : target;

    if (String(targetName) !== String(gameName)) return disk;

    const nextGames = [...games];
    const nextValue =
      target && typeof target === "object" ? { ...target } : { gameName: targetName };

    if (nextRating == null || Number(nextRating) <= 0 || Number.isNaN(Number(nextRating))) {
      delete nextValue.rating;
    } else {
      nextValue.rating = Number(nextRating);
    }

    nextGames[idx] = nextValue;

    return {
      ...disk,
      [side]: nextGames,
    };
  });
}

export default function (state = initialState, action) {
  switch (action.type) {
    case GET_ITEMS:
      return {
        ...state,
        itemsArrayInsideState: action.payload,
        loading: false,
        originalList: action.payload,
      };

    case DELETE_ITEM:
      return {
        ...state,
        itemsArrayInsideState: state.itemsArrayInsideState.filter(
          (item) => item._id !== action.payload
        ),
      };

    case ADD_ITEM:
      return {
        ...state,
        itemsArrayInsideState: [action.payload, ...state.itemsArrayInsideState],
      };

    case ITEMS_LOADING:
      return {
        ...state,
        loading: true,
      };

    case FILTER_DISKS: {
      const sourceList =
        Array.isArray(state.originalList) && state.originalList.length > 0
          ? state.originalList
          : state.itemsArrayInsideState;

      const needle = String(action.payload || "").trim().toLowerCase();

      // If empty filter, restore full list immediately
      if (!needle) {
        return {
          ...state,
          itemsArrayInsideState: sourceList,
        };
      }

      return {
        ...state,
        itemsArrayInsideState: sourceList
          .filter((item) => item && typeof item === "object")
          .filter((item) => {
            const sideA = Array.isArray(item.sideA) ? item.sideA : [];
            const sideB = Array.isArray(item.sideB) ? item.sideB : [];

            const getName = (element) =>
              element && typeof element === "object" && element.gameName
                ? element.gameName
                : element;

            const foundInsideA = sideA.some((element) =>
              String(getName(element)).toLowerCase().includes(needle)
            );
            const foundInsideB = sideB.some((element) =>
              String(getName(element)).toLowerCase().includes(needle)
            );

            return foundInsideA || foundInsideB;
          }),
      };
    }

    case UPDATE_GAME_RATING_OPTIMISTIC:
      return {
        ...state,
        itemsArrayInsideState: patchRatingInDiskList(
          state.itemsArrayInsideState,
          action.payload,
          "set"
        ),
        originalList: patchRatingInDiskList(state.originalList, action.payload, "set"),
      };

    case UPDATE_GAME_RATING_ROLLBACK:
      return {
        ...state,
        itemsArrayInsideState: patchRatingInDiskList(
          state.itemsArrayInsideState,
          action.payload,
          "rollback"
        ),
        originalList: patchRatingInDiskList(state.originalList, action.payload, "rollback"),
      };

    default:
      return state;
  }
}

import axios from "axios";
import {
  GET_ITEMS,
  ADD_ITEM,
  DELETE_ITEM,
  ITEMS_LOADING,
  FILTER_DISKS,
  UPDATE_GAME_RATING_OPTIMISTIC,
  UPDATE_GAME_RATING_ROLLBACK,
} from "./types";

export const getItems = () => (dispatch) => {
  dispatch(setItemsLoading());

  const fetchWithRetry = async (retries = 1) => {
    try {
      const res = await axios.get("/api/items/disks");
      dispatch({
        type: GET_ITEMS,
        payload: res.data,
      });
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 650));
        return fetchWithRetry(retries - 1);
      }
      console.error("Failed to load disks:", error);
      dispatch({
        type: GET_ITEMS,
        payload: [],
      });
    }
  };

  fetchWithRetry();
};

export const deleteItem = (id) => (dispatch) => {
  axios.delete(`/api/items/${id}`).then(() =>
    dispatch({
      type: DELETE_ITEM,
      payload: id,
    })
  );
};

export const addItem = (item) => (dispatch) => {
  axios.post("/api/items", item).then((res) =>
    dispatch({
      type: ADD_ITEM,
      payload: res.data,
    })
  );
};

export const setItemsLoading = () => {
  return {
    type: ITEMS_LOADING,
  };
};

export const filterDisks = (gameName) => (dispatch) => {
  dispatch({
    type: FILTER_DISKS,
    payload: gameName,
  });
};

export const updateGameRating = (payload) => async (dispatch) => {
  dispatch({
    type: UPDATE_GAME_RATING_OPTIMISTIC,
    payload,
  });

  try {
    await axios.patch("/api/items/ratings", payload);
  } catch (error) {
    dispatch({
      type: UPDATE_GAME_RATING_ROLLBACK,
      payload,
    });
    throw error;
  }
};

export const saveGameTitles = async (payload) => {
  const response = await axios.patch("/api/items/titles", payload);
  return response.data;
};

export const deleteDiskFromDataset = async ({ dataset, diskId }) => {
  const response = await axios.delete(`/api/items/disks/${encodeURIComponent(diskId)}`, {
    params: { dataset: dataset || "default" },
  });
  return response.data;
};

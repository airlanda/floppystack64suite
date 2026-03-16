// Associate all reducer (item, auth, error)
// meeting place for 
import { combineReducers } from "redux";
import itemReducer from './itemReducer'

export default combineReducers({
  itemReducer
})
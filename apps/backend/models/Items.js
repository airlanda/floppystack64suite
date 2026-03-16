const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//Schema
const ItemSchema = new Schema({
    name: {
        type:String,
        required: true
    },
    date: {
        type:Date,
        default: Date.now
    }
});
// model(<collection>, <schema>) - if the collection does not exist, It'll create a new one
module.exports = Item = mongoose.model('item', ItemSchema)
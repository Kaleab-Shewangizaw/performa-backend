const mongoose = require('mongoose');
const { STONE_CATEGORIES, FINISHES, THICKNESS_OPTIONS } = require('../utils/constants');

// Embedded in Proforma. Product details are denormalized so the proforma
// remains accurate even if the catalog changes later.
const proformaItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, trim: true },
    stoneCategory: { type: String, enum: STONE_CATEGORIES, required: true },
    stoneColor: { type: String, required: true, trim: true },
    finish: { type: String, enum: FINISHES, required: true },
    width: { type: Number, required: true, min: 0.01 },
    height: { type: Number, required: true, min: 0.01 },
    area: { type: Number, required: true, min: 0 },
    thickness: { type: Number, enum: THICKNESS_OPTIONS, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  {
    _id: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

module.exports = proformaItemSchema;

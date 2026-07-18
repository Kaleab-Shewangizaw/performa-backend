const mongoose = require('mongoose');
const {
  STONE_CATEGORIES,
  FINISHES,
  THICKNESS_OPTIONS,
  PRODUCT_STATUSES,
} = require('../utils/constants');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    stoneCategory: { type: String, enum: STONE_CATEGORIES, required: true },
    stoneColor: { type: String, required: true, trim: true, maxlength: 100 },
    finish: { type: String, enum: FINISHES, required: true },
    thicknessOptions: {
      type: [Number],
      enum: THICKNESS_OPTIONS,
      validate: [(v) => v.length > 0, 'At least one thickness option is required'],
    },
    defaultUnitPrice: { type: Number, required: true, min: 0 },
    status: { type: String, enum: PRODUCT_STATUSES, default: 'active' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

productSchema.index({ name: 'text', stoneColor: 'text' });

module.exports = mongoose.model('Product', productSchema);

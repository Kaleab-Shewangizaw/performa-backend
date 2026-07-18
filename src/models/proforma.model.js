const mongoose = require('mongoose');
const proformaItemSchema = require('./proformaItem.model');
const { PROFORMA_STATUSES } = require('../utils/constants');

const proformaSchema = new mongoose.Schema(
  {
    proformaNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    salesPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    issueDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, required: true },
    items: {
      type: [proformaItemSchema],
      validate: [(v) => v.length > 0, 'A proforma needs at least one item'],
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    vatRate: { type: Number, default: 15, min: 0, max: 100 },
    vatAmount: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentTerms: { type: String, trim: true, maxlength: 500, default: '' },
    deliveryTime: { type: String, trim: true, maxlength: 300, default: '' },
    validityPeriod: { type: String, trim: true, maxlength: 300, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: PROFORMA_STATUSES, default: 'pending', index: true },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' },
    supervisorApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    supervisorApprovedAt: { type: Date, default: null },
    adminApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    adminApprovedAt: { type: Date, default: null },
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

proformaSchema.index({ proformaNumber: 'text' });
proformaSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Proforma', proformaSchema);

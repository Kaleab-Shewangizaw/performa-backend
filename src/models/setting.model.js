const mongoose = require('mongoose');

// Single-document collection holding company/system settings.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    companyName: { type: String, default: 'Granite Factory PLC', maxlength: 200 },
    companyAddress: { type: String, default: '', maxlength: 500 },
    companyPhone: { type: String, default: '', maxlength: 50 },
    companyEmail: { type: String, default: '', maxlength: 200 },
    companyWebsite: { type: String, default: '', maxlength: 200 },
    logoUrl: { type: String, default: '', maxlength: 100000 },
    currency: { type: String, default: 'ETB', maxlength: 10 },
    defaultVatRate: { type: Number, default: 15, min: 0, max: 100 },
    defaultPaymentTerms: { type: String, default: '50% advance, 50% on delivery', maxlength: 500 },
    defaultValidityDays: { type: Number, default: 30, min: 1 },
    proformaPrefix: { type: String, default: 'PF', maxlength: 10 },
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

settingSchema.statics.get = async function get() {
  let doc = await this.findOne({ key: 'global' });
  if (!doc) doc = await this.create({ key: 'global' });
  return doc;
};

module.exports = mongoose.model('Setting', settingSchema);

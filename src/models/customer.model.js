const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    companyName: { type: String, trim: true, maxlength: 200, default: '' },
    phone: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    taxNumber: { type: String, trim: true, maxlength: 100, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

customerSchema.index({ fullName: 'text', companyName: 'text', phone: 'text', email: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
